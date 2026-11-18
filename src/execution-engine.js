// Asynchronous Program Execution Engine for NXT-Scratch
// Author: Antigravity

export class AbortError extends Error {
  constructor(message = "Program stopped by user") {
    super(message);
    this.name = "AbortError";
  }
}

export class ExecutionEngine {
  constructor(driver) {
    this.driver = driver;
    this.isRunning = false;
    this.currentPromise = null;
    this.resolveRun = null;
    this.onStateChange = null; // Callback for UI updates
  }

  setStateChangeCallback(callback) {
    this.onStateChange = callback;
  }

  checkAborted() {
    if (!this.isRunning) {
      throw new AbortError();
    }
  }

  async run(codeString) {
    if (this.isRunning) {
      this.stop();
    }

    this.isRunning = true;
    if (this.onStateChange) this.onStateChange(true);
    
    this.driver.log("Starting program execution...", "system");

    // Create abortable wait helper
    const wait = async (seconds) => {
      const ms = seconds * 1000;
      const interval = 50; // Check for stop every 50ms
      let elapsed = 0;
      while (elapsed < ms) {
        this.checkAborted();
        await new Promise(r => setTimeout(r, Math.min(interval, ms - elapsed)));
        elapsed += interval;
      }
      this.checkAborted();
    };

    // Create wrapped driver with abort checks
    const nxtWrapper = {
      playTone: async (freq, dur) => {
        this.checkAborted();
        await this.driver.playTone(freq, dur);
        // Small delay so successive play tones do not override instantly
        await wait(dur / 1000.0 + 0.05); 
      },
      setMotorPower: async (port, power) => {
        this.checkAborted();
        await this.driver.setMotorPower(port, power);
        await new Promise(r => setTimeout(r, 10)); // Yield to serial line
      },
      turnMotorIndefinite: async (port, direction, power) => {
        this.checkAborted();
        const p = direction === 'REVERSE' ? -Math.abs(power) : Math.abs(power);
        await this.driver.setMotorPower(port, p);
        await new Promise(r => setTimeout(r, 10));
      },
      turnMotorFraction: async (port, direction, power, turns, brake = true) => {
        this.checkAborted();
        const numTurns = Number(turns) || 0;
        const numPower = Number(power) || 0;
        const targetDegrees = Math.round(Math.abs(numTurns) * 360);
        if (targetDegrees <= 0 || numPower === 0) return;

        const shouldBrake = !(brake === false || brake === 'false' || brake === 'COAST');
        const p = direction === 'REVERSE' ? -Math.abs(numPower) : Math.abs(numPower);
        const targetPorts = port.toUpperCase() === 'ALL' ? ['A', 'B', 'C'] : [port.toUpperCase()];

        const startTacho = {};
        const lastTacho = {};
        const lastProgressTime = {};
        const now = Date.now();

        // 1. Capture baseline encoder positions and reset relative counters
        for (const pt of targetPorts) {
          try {
            await this.driver.resetMotorPosition(pt, true);
            await new Promise(r => setTimeout(r, 15));
            const state = await this.driver.getMotorState(pt);
            startTacho[pt] = state.tachoCount;
            lastTacho[pt] = state.tachoCount;
            lastProgressTime[pt] = now;
            await new Promise(r => setTimeout(r, 15));
          } catch (e) {
            startTacho[pt] = 0;
            lastTacho[pt] = 0;
            lastProgressTime[pt] = now;
          }
        }

        this.checkAborted();

        // 2. Start motor(s) with limit on individual ports
        // Mode bitfield: MOTORON (0x01) | REGULATED (0x04) = 0x05; include BRAKE (0x02) = 0x07 if braking
        const runMode = shouldBrake ? (0x01 | 0x02 | 0x04) : (0x01 | 0x04);
        for (const pt of targetPorts) {
          await this.driver.setMotorState(pt, p, runMode, 0x01, 0, 0x20, targetDegrees);
          await new Promise(r => setTimeout(r, 15));
        }

        const pollInterval = 40;
        const activePorts = new Set(targetPorts);
        let consecutiveErrors = 0;

        // 3. Supervised position tracking loop
        while (activePorts.size > 0) {
          this.checkAborted();
          const currentTime = Date.now();

          for (const pt of Array.from(activePorts)) {
            try {
              const state = await this.driver.getMotorState(pt);
              consecutiveErrors = 0;

              const distanceTraveled = Math.abs(state.tachoCount - startTacho[pt]);

              // Check if motor has made progress
              if (state.tachoCount !== lastTacho[pt]) {
                lastTacho[pt] = state.tachoCount;
                lastProgressTime[pt] = currentTime;
              }

              // In "ALL" mode, drop ports that have never moved after 400ms while other ports are active
              const anyOtherMoved = targetPorts.some(other => other !== pt && Math.abs((lastTacho[other] ?? 0) - (startTacho[other] ?? 0)) > 10);
              if (anyOtherMoved && distanceTraveled === 0 && (currentTime - now > 400)) {
                activePorts.delete(pt);
                continue;
              }

              // Determine completion conditions
              const reachedTarget = distanceTraveled >= targetDegrees;
              const brickStopped = state.runState === 0 && distanceTraveled >= (targetDegrees - 15);
              const stalled = (currentTime - lastProgressTime[pt] > 1200);

              if (reachedTarget || brickStopped || stalled) {
                await this.driver.stopMotor(pt, shouldBrake);
                activePorts.delete(pt);
                if (stalled && distanceTraveled < (targetDegrees - 15)) {
                  this.driver.log(`Motor ${pt} seems stalled or disconnected.`, 'warning');
                }
              }
            } catch (err) {
              consecutiveErrors++;
              // Only abort if communication fails multiple times consecutively
              if (consecutiveErrors > 5) {
                this.driver.log(`Lost communication while waiting for motor ${pt}`, 'error');
                activePorts.delete(pt);
              }
            }
          }

          if (activePorts.size > 0) {
            await new Promise(r => setTimeout(r, pollInterval));
          }
        }

        this.checkAborted();
        for (const pt of targetPorts) {
          try {
            await this.driver.stopMotor(pt, shouldBrake);
            await new Promise(r => setTimeout(r, 10));
          } catch (e) {}
        }
      },
      stopMotor: async (port, brake) => {
        this.checkAborted();
        await this.driver.stopMotor(port, brake);
        await new Promise(r => setTimeout(r, 10));
      },
      resetMotorPosition: async (port) => {
        this.checkAborted();
        await this.driver.resetMotorPosition(port);
        await new Promise(r => setTimeout(r, 10));
      },
      readTouch: async (portIndex) => {
        this.checkAborted();
        const res = await this.driver.getInputValues(portIndex);
        // Standard polling delay to prevent serial congestion
        await new Promise(r => setTimeout(r, 20));
        return res.scaledValue === 1;
      },
      readLight: async (portIndex) => {
        this.checkAborted();
        const res = await this.driver.getInputValues(portIndex);
        await new Promise(r => setTimeout(r, 20));
        return res.scaledValue;
      },
      readSound: async (portIndex) => {
        this.checkAborted();
        const res = await this.driver.getInputValues(portIndex);
        await new Promise(r => setTimeout(r, 20));
        return res.scaledValue;
      },
      readUltrasonic: async (portIndex) => {
        this.checkAborted();
        const dist = await this.driver.readUltrasonic(portIndex);
        await new Promise(r => setTimeout(r, 20));
        return dist;
      },
      log: (message, type = 'system') => {
        this.driver.log(message, type);
      },
      displayText: async (text, line) => {
        this.checkAborted();
        this.driver.log(`[NXT Display Line ${line}] ${text}`, 'display');
        await new Promise(r => setTimeout(r, 10));
      },
      displayClear: async () => {
        this.checkAborted();
        this.driver.log('[NXT Display] Cleared', 'display');
        await new Promise(r => setTimeout(r, 10));
      },
      displayClearLine: async (line) => {
        this.checkAborted();
        this.driver.log(`[NXT Display Line ${line}] Cleared`, 'display');
        await new Promise(r => setTimeout(r, 10));
      }
    };

    // Run using async evaluator
    try {
      const asyncFn = new Function('nxt', 'wait', `
        return (async () => {
          ${codeString}
        })();
      `);
      
      this.currentPromise = asyncFn(nxtWrapper, wait);
      await this.currentPromise;
      
      this.driver.log("Program completed successfully.", "success");
    } catch (err) {
      if (err instanceof AbortError) {
        this.driver.log("Program stopped.", "system");
      } else {
        this.driver.log(`Execution Error: ${err.message}`, "error");
        console.error(err);
      }
    } finally {
      // Ensure all motors are stopped on finish/abort for safety
      try {
        if (this.driver.connected) {
          await this.driver.stopMotor('ALL', true);
        }
      } catch (e) {}

      this.isRunning = false;
      this.currentPromise = null;
      if (this.onStateChange) this.onStateChange(false);
    }
  }

  stop() {
    if (!this.isRunning) return;
    this.isRunning = false;
    this.driver.log("Stopping program...", "system");
  }
}
