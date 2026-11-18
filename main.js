import * as Blockly from 'blockly';
import { javascriptGenerator } from 'blockly/javascript';
import { nxcGenerator } from './src/nxc-generator.js';
import { NXTDriver, SENSOR_TYPES, SENSOR_MODES } from './src/nxt-driver.js';
import { ExecutionEngine } from './src/execution-engine.js';
import { toolboxJson, generateJavaScript, nxtTheme } from './src/blockly-custom.js';

// Global instances
let workspace = null;
const nxt = new NXTDriver();
const engine = new ExecutionEngine(nxt);
let dashboardPollInterval = null;
let programCheckInterval = null;

// Execution and upload state
let onBrickProgramRunning = false;
let runningProgramName = null;
let isUploading = false;
let updateButtonStates = () => {};

// Sensor configurations mapping (from dropdowns)
const sensorConfigs = {
  0: 'none', // S1
  1: 'none', // S2
  2: 'none', // S3
  3: 'none'  // S4
};

// Default Demo Blockly Program with Start Hat Block
const DEMO_PROGRAM = {
  "blocks": {
    "languageVersion": 0,
    "blocks": [
      {
        "type": "nxt_start",
        "id": "start_program_init",
        "x": 40,
        "y": 40,
        "next": {
          "block": {
            "type": "nxt_play_tone",
            "id": "play_tone_init",
            "inputs": {
              "FREQUENCY": {
                "shadow": {
                  "type": "math_number",
                  "id": "freq_num",
                  "fields": { "NUM": 523 }
                }
              },
              "DURATION": {
                "shadow": {
                  "type": "math_number",
                  "id": "dur_num",
                  "fields": { "NUM": 300 }
                }
              }
            },
            "next": {
              "block": {
                "type": "nxt_wait",
                "id": "wait_init",
                "inputs": {
                  "SECONDS": {
                    "shadow": {
                      "type": "math_number",
                      "id": "sec_num",
                      "fields": { "NUM": 0.5 }
                    }
                  }
                },
                "next": {
                  "block": {
                    "type": "controls_repeat_ext",
                    "id": "repeat_loop",
                    "inputs": {
                      "TIMES": {
                        "shadow": {
                          "type": "math_number",
                          "id": "times_num",
                          "fields": { "NUM": 3 }
                        }
                      },
                      "DO": {
                        "block": {
                          "type": "nxt_motor_power",
                          "id": "motor_on",
                          "fields": { "PORT": "A" },
                          "inputs": {
                            "POWER": {
                              "shadow": {
                                "type": "math_number",
                                "id": "pwr_num",
                                "fields": { "NUM": 75 }
                              }
                            }
                          },
                          "next": {
                            "block": {
                              "type": "nxt_wait",
                              "id": "wait_loop1",
                              "inputs": {
                                "SECONDS": {
                                  "shadow": {
                                    "type": "math_number",
                                    "id": "sec_num1",
                                    "fields": { "NUM": 1 }
                                  }
                                }
                              },
                              "next": {
                                "block": {
                                  "type": "nxt_motor_stop",
                                  "id": "motor_off",
                                  "fields": { "PORT": "A", "MODE": "BRAKE" },
                                  "next": {
                                    "block": {
                                      "type": "nxt_wait",
                                      "id": "wait_loop2",
                                      "inputs": {
                                        "SECONDS": {
                                          "shadow": {
                                            "type": "math_number",
                                            "id": "sec_num2",
                                            "fields": { "NUM": 1 }
                                          }
                                        }
                                      }
                                    }
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    ]
  }
};

document.addEventListener('DOMContentLoaded', () => {
  initCustomDialogs();
  initUI();
  initBlockly();
  initDriver();
});

// --- Custom Modal Dialog System for Blockly (Variables, Prompts, Confirms) ---
function initCustomDialogs() {
  const backdrop = document.getElementById('custom-modal-backdrop');
  const titleEl = document.getElementById('modal-title');
  const msgEl = document.getElementById('modal-message');
  const inputEl = document.getElementById('modal-input');
  const btnConfirm = document.getElementById('modal-btn-confirm');
  const btnCancel = document.getElementById('modal-btn-cancel');
  const btnClose = document.getElementById('modal-btn-close');

  if (!backdrop) return;

  let activeCallback = null;

  function closeModal(result) {
    backdrop.style.display = 'none';
    const cb = activeCallback;
    activeCallback = null;
    if (cb) {
      cb(result);
    }
  }

  btnConfirm.addEventListener('click', () => {
    if (inputEl.style.display !== 'none') {
      const val = inputEl.value.trim();
      closeModal(val || null);
    } else {
      closeModal(true);
    }
  });

  btnCancel.addEventListener('click', () => {
    if (inputEl.style.display !== 'none') {
      closeModal(null);
    } else {
      closeModal(false);
    }
  });

  btnClose.addEventListener('click', () => {
    if (inputEl.style.display !== 'none') {
      closeModal(null);
    } else {
      closeModal(false);
    }
  });

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) {
      if (inputEl.style.display !== 'none') {
        closeModal(null);
      } else {
        closeModal(false);
      }
    }
  });

  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = inputEl.value.trim();
      closeModal(val || null);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeModal(null);
    }
  });

  // Custom Blockly Prompt Modal (Variable creation & renaming)
  Blockly.dialog.setPrompt((message, defaultValue, callback) => {
    activeCallback = callback;
    const isRename = message.toLowerCase().includes('rename');
    titleEl.textContent = isRename ? 'Rename Variable' : 'New Variable';
    msgEl.textContent = message;
    inputEl.style.display = 'block';
    btnCancel.style.display = 'inline-flex';
    btnConfirm.textContent = 'OK';
    inputEl.value = defaultValue || '';
    backdrop.style.display = 'flex';
    setTimeout(() => {
      inputEl.focus();
      inputEl.select();
    }, 50);
  });

  // Custom Blockly Confirm Modal (e.g. deleting variable in use)
  Blockly.dialog.setConfirm((message, callback) => {
    activeCallback = callback;
    titleEl.textContent = 'Confirm Action';
    msgEl.textContent = message;
    inputEl.style.display = 'none';
    btnCancel.style.display = 'inline-flex';
    btnConfirm.textContent = 'OK';
    backdrop.style.display = 'flex';
  });

  // Custom Blockly Alert Modal
  Blockly.dialog.setAlert((message, callback) => {
    activeCallback = callback;
    titleEl.textContent = 'Notice';
    msgEl.textContent = message;
    inputEl.style.display = 'none';
    btnCancel.style.display = 'none';
    btnConfirm.textContent = 'OK';
    backdrop.style.display = 'flex';
  });
}

// --- Initialize Blockly ---
function initBlockly() {
  workspace = Blockly.inject('blockly-editor', {
    toolbox: toolboxJson,
    media: 'media/',
    grid: {
      spacing: 20,
      length: 3,
      colour: '#2c3e50',
      snap: true
    },
    zoom: {
      controls: true,
      wheel: true,
      startScale: 0.9,
      maxScale: 3,
      minScale: 0.3,
      scaleSpeed: 1.2
    },
    theme: nxtTheme
  });

  // Load demo program
  try {
    Blockly.serialization.workspaces.load(DEMO_PROGRAM, workspace);
  } catch (e) {
    console.error("Could not load demo program:", e);
  }

  // Generate JavaScript & NXC live
  workspace.addChangeListener(() => {
    updateGeneratedOutputs();
  });

  // Initial code generation
  updateGeneratedOutputs();
}

function updateGeneratedOutputs() {
  if (!workspace) return;
  // 1. JavaScript Output
  try {
    const jsCode = generateJavaScript(workspace);
    document.getElementById('code-output').textContent = jsCode || '// Add blocks to see generated code';
  } catch (e) {
    document.getElementById('code-output').textContent = `// Error generating JavaScript: ${e.message}`;
  }

  // 2. NXC C Output
  try {
    const nxcCode = nxcGenerator.workspaceToCode(workspace);
    document.getElementById('nxc-output').textContent = nxcCode || '// Add blocks to see generated code';
  } catch (e) {
    document.getElementById('nxc-output').textContent = `// Error generating NXC: ${e.message}`;
  }
}

// --- Transfer Progress Helper ---
function setTransferProgress(visible, label = '', pct = 0) {
  const container = document.getElementById('transfer-progress-container');
  const labelEl = document.getElementById('transfer-progress-label');
  const pctEl = document.getElementById('transfer-progress-pct');
  const barEl = document.getElementById('transfer-progress-bar');

  if (!container) return;
  if (!visible) {
    container.style.display = 'none';
    isUploading = false;
    return;
  }

  isUploading = true;
  container.style.display = 'block';
  if (label) labelEl.textContent = label;
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  pctEl.textContent = `${clamped}%`;
  barEl.style.width = `${clamped}%`;
}

// --- Initialize Driver & Event Binding ---
function initDriver() {
  const connectionLed = document.getElementById('connection-led');
  const connectionStatus = document.getElementById('connection-status');
  const btnConnect = document.getElementById('btn-connect');
  const btnDisconnect = document.getElementById('btn-disconnect');
  const btnRun = document.getElementById('btn-run');
  const btnFlash = document.getElementById('btn-flash');
  const btnUploadRxe = document.getElementById('btn-upload-rxe');
  const btnStop = document.getElementById('btn-stop');
  const btnExportNxc = document.getElementById('btn-export-nxc');
  const rxeFileInput = document.getElementById('rxe-file-input');
  const batteryContainer = document.getElementById('battery-container');
  const batteryVoltage = document.getElementById('battery-voltage');
  const batteryFill = document.getElementById('battery-fill');

  updateButtonStates = function () {
    const connected = nxt.connected;
    const isDirectRunning = engine.isRunning;
    const isAutonomousRunning = onBrickProgramRunning;
    const isAnyRunning = isDirectRunning || isAutonomousRunning;

    btnRun.disabled = !connected || isAnyRunning;
    btnFlash.disabled = !connected || isAnyRunning;
    btnUploadRxe.disabled = !connected || isAnyRunning;
    btnStop.disabled = !connected || !isAnyRunning;

    if (isDirectRunning) {
      connectionLed.className = 'status-led running';
      connectionStatus.textContent = 'Running (Direct Mode)...';
    } else if (isAutonomousRunning) {
      connectionLed.className = 'status-led running';
      connectionStatus.textContent = `Running on Brick (${runningProgramName || 'Autonomous'})...`;
    } else if (connected) {
      connectionLed.className = 'status-led connected';
      connectionStatus.textContent = 'Connected';
    } else {
      connectionLed.className = 'status-led';
      connectionStatus.textContent = 'Disconnected';
      batteryContainer.style.display = 'none';
    }
  };

  // Terminal Logger Callback
  nxt.setLogCallback((message, type) => {
    const term = document.getElementById('terminal-output');
    const line = document.createElement('div');
    line.className = `terminal-line ${type}`;
    line.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    term.appendChild(line);
    term.scrollTop = term.scrollHeight; // Auto-scroll
  });

  // Battery Callback
  nxt.setBatteryCallback((voltage) => {
    batteryContainer.style.display = 'flex';
    batteryVoltage.textContent = `${voltage.toFixed(2)}V`;

    // Width represents percentage from 6.0V (empty) to 8.4V (full)
    const pct = Math.max(0, Math.min(100, ((voltage - 6.0) / 2.4) * 100));
    batteryFill.setAttribute('width', `${(pct / 100) * 12}`);

    if (voltage < 7.0) {
      batteryContainer.classList.add('low');
    } else {
      batteryContainer.classList.remove('low');
    }
  });

  // Execution Engine State callback (Direct Execution)
  engine.setStateChangeCallback((isRunning) => {
    updateButtonStates();
    if (isRunning) {
      stopDashboardPoll();
    } else {
      if (nxt.connected) {
        startDashboardPoll();
      }
    }
  });

  // Connect Button
  btnConnect.addEventListener('click', async () => {
    try {
      btnConnect.disabled = true;
      await nxt.connect();

      btnConnect.style.display = 'none';
      btnDisconnect.style.display = 'inline-flex';

      // Initialize configured sensor modes on NXT
      await initActiveSensors();
      updateButtonStates();
      startDashboardPoll();
    } catch (err) {
      btnConnect.disabled = false;
    }
  });

  // Disconnect Button
  btnDisconnect.addEventListener('click', async () => {
    stopDashboardPoll();
    stopProgramMonitor();
    engine.stop();
    onBrickProgramRunning = false;
    runningProgramName = null;
    await nxt.disconnect();

    btnConnect.style.display = 'inline-flex';
    btnConnect.disabled = false;
    btnDisconnect.style.display = 'none';
    updateButtonStates();
  });

  // Run Button (Direct Command Execution)
  btnRun.addEventListener('click', () => {
    const code = generateJavaScript(workspace);
    if (!code) {
      nxt.log("No blocks connected to 'when program starts' (or in workspace) to run!", "error");
      return;
    }
    nxt.log("Starting Direct Command execution...", "system");
    engine.run(code);
  });

  // Flash to NXT Button (Compile NXC -> Upload .rxe -> Start on brick)
  btnFlash.addEventListener('click', async () => {
    if (!nxt.connected) {
      alert("Please connect your NXT brick first via Bluetooth.");
      return;
    }

    const nxcCode = nxcGenerator.workspaceToCode(workspace);
    if (!nxcCode) {
      nxt.log("No blocks in workspace to compile!", "error");
      return;
    }

    isUploading = true;
    stopDashboardPoll();
    stopProgramMonitor();

    try {
      setTransferProgress(true, "Compiling NXC code via NBC...", 10);
      btnFlash.disabled = true;
      btnRun.disabled = true;
      btnUploadRxe.disabled = true;

      // Call Vite dev server compilation endpoint
      let res;
      try {
        res = await fetch('/api/compile-nxc', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nxcCode, filename: 'prog.rxe' })
        });
      } catch (networkErr) {
        setTransferProgress(false);
        nxt.log(`Network error connecting to compiler endpoint: ${networkErr.message}`, "error");
        alert(`Could not connect to Vite dev server: ${networkErr.message}`);
        updateButtonStates();
        return;
      }

      let data = null;
      const responseText = await res.text();
      try {
        if (responseText) {
          data = JSON.parse(responseText);
        }
      } catch (parseErr) {
        // Not valid JSON
      }

      if (!res.ok || !data) {
        setTransferProgress(false);
        if (res.status === 404) {
          const msg = "Compiler endpoint not found (HTTP 404).\n\n" +
            "Your Vite dev server was already running before vite.config.js was loaded.\n" +
            "Please RESTART Vite in your terminal:\n" +
            "1. In your terminal running Vite, press Ctrl+C to stop it.\n" +
            "2. Run 'npm run dev' again so the new vite.config.js is loaded.\n\n" +
            "Tip: You can also use 'Upload .rxe' to directly send any existing .rxe binary without restarting!";
          nxt.log("Endpoint /api/compile-nxc returned 404. Please restart the Vite dev server (Ctrl+C then 'npm run dev').", "error");
          alert(msg);
        } else {
          const msg = `Compiler server error (HTTP ${res.status}):\n${responseText || 'Empty response from server'}`;
          nxt.log(msg, "error");
          alert(msg);
        }
        updateButtonStates();
        return;
      }

      if (!data.success) {
        setTransferProgress(false);
        if (data.notFound) {
          alert("NBC compiler (nbc.exe) was not found on your system PATH or ./tools/ directory.\n\n" +
            "To enable automatic compilation:\n" +
            "Place 'nbc.exe' into the 'tools' folder in this project.\n\n" +
            "In the meantime, you can:\n" +
            "1. Click 'Export NXC' to save the code and compile it with BricxCC or command line.\n" +
            "2. Click 'Upload .rxe' to upload and run any precompiled .rxe binary directly to your NXT brick!");
          nxt.log("NBC compiler not found. Place nbc.exe in ./tools/ or use 'Upload .rxe'.", "error");
        } else {
          nxt.log(`NXC Compilation error:\n${data.error}`, "error");
          alert(`Compilation failed:\n${data.error}`);
        }
        updateButtonStates();
        return;
      }

      nxt.log(`Compilation successful (${data.size} bytes). Uploading to NXT...`, "success");
      setTransferProgress(true, "Uploading prog.rxe to NXT...", 25);

      // Convert base64 to Uint8Array
      const binaryString = atob(data.rxeBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Upload and start execution
      const actualName = await nxt.uploadAndRunProgram("prog.rxe", bytes, (sent, total) => {
        const pct = 25 + Math.round((sent / total) * 70);
        setTransferProgress(true, `Uploading prog.rxe (${sent}/${total} bytes)...`, pct);
      });

      setTransferProgress(true, "Program started successfully!", 100);
      setTimeout(() => setTransferProgress(false), 1200);

      onBrickProgramRunning = true;
      runningProgramName = actualName || "prog.rxe";
      updateButtonStates();
      startProgramMonitor();
      startDashboardPoll(); // Resume live telemetry while program is running on brick!

    } catch (err) {
      setTransferProgress(false);
      nxt.log(`Flash failed: ${err.message}`, "error");
      updateButtonStates();
      if (nxt.connected && !dashboardPollInterval) {
        startDashboardPoll();
      }
    } finally {
      isUploading = false;
    }
  });

  // Upload .rxe Button (Directly upload existing .rxe binary)
  btnUploadRxe.addEventListener('click', () => {
    if (!nxt.connected) {
      alert("Please connect your NXT brick first via Bluetooth.");
      return;
    }
    rxeFileInput.click();
  });

  rxeFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    isUploading = true;
    stopDashboardPoll();
    stopProgramMonitor();

    try {
      setTransferProgress(true, `Reading ${file.name}...`, 10);
      btnUploadRxe.disabled = true;
      btnRun.disabled = true;
      btnFlash.disabled = true;

      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);

      // Sanitize filename to 15.3 characters for NXT filesystem
      let brickFilename = file.name;
      if (brickFilename.length > 19) {
        brickFilename = brickFilename.substring(0, 15) + '.rxe';
      }

      const actualName = await nxt.uploadAndRunProgram(brickFilename, bytes, (sent, total) => {
        const pct = 10 + Math.round((sent / total) * 85);
        setTransferProgress(true, `Uploading ${brickFilename} (${sent}/${total} bytes)...`, pct);
      });

      setTransferProgress(true, "Program started on brick!", 100);
      setTimeout(() => setTransferProgress(false), 1200);

      onBrickProgramRunning = true;
      runningProgramName = actualName || brickFilename;
      updateButtonStates();
      startProgramMonitor();
      startDashboardPoll(); // Resume live telemetry while program is running on brick!

    } catch (err) {
      setTransferProgress(false);
      nxt.log(`Failed to upload ${file.name}: ${err.message}`, "error");
      updateButtonStates();
      if (nxt.connected && !dashboardPollInterval) {
        startDashboardPoll();
      }
    } finally {
      isUploading = false;
      rxeFileInput.value = '';
    }
  });

  // Stop Button (Unified: stops Direct Engine, stops on-brick program, and brakes all motors)
  btnStop.addEventListener('click', async () => {
    btnStop.disabled = true;
    try {
      if (engine.isRunning) {
        engine.stop();
      }
      if (onBrickProgramRunning) {
        nxt.log("Sending stop command to on-brick program...", "system");
        await nxt.stopProgram();
        onBrickProgramRunning = false;
        runningProgramName = null;
        stopProgramMonitor();
        await initActiveSensors();
      }
      // Guarantee all motors are stopped with active braking
      await nxt.stopMotor('ALL', true);
      nxt.log("All robot execution stopped.", "system");
      if (nxt.connected && !dashboardPollInterval) {
        startDashboardPoll();
      }
    } catch (err) {
      nxt.log(`Error stopping robot: ${err.message}`, "error");
    } finally {
      updateButtonStates();
    }
  });

  // Export NXC Button
  btnExportNxc.addEventListener('click', () => {
    const nxcCode = nxcGenerator.workspaceToCode(workspace);
    if (!nxcCode) {
      nxt.log("No blocks in workspace to export!", "error");
      return;
    }
    const blob = new Blob([nxcCode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'program.nxc';
    a.click();
    URL.revokeObjectURL(url);
    nxt.log("Exported program.nxc successfully.", "success");
  });
}

// --- Autonomous Program Completion Monitor ---
function startProgramMonitor() {
  stopProgramMonitor();
  programCheckInterval = setInterval(async () => {
    if (!nxt.connected || !onBrickProgramRunning || isUploading) {
      stopProgramMonitor();
      return;
    }
    // If telemetry dashboard is actively polling, let dashboard poll handle the check to prevent SPP queue contention
    if (dashboardPollInterval) return;

    try {
      const activeName = await nxt.getCurrentProgramName();
      if (!activeName) {
        // Brick reports no active running program
        nxt.log(`Autonomous program execution finished on brick.`, "system");
        onBrickProgramRunning = false;
        runningProgramName = null;
        stopProgramMonitor();
        updateButtonStates();
        // Restore configured sensor modes after brick program finishes
        await initActiveSensors();
      }
    } catch (e) {
      // Ignore transient errors
    }
  }, 1000);
}

function stopProgramMonitor() {
  if (programCheckInterval) {
    clearInterval(programCheckInterval);
    programCheckInterval = null;
  }
}

// --- Initialize sensor configs on NXT ---
async function initActiveSensors() {
  if (!nxt.connected) return;
  nxt.log("Initializing sensor ports on brick...", "system");
  for (let port = 0; port < 4; port++) {
    await configureSensorOnBrick(port, sensorConfigs[port]);
  }
}

async function configureSensorOnBrick(portIndex, sensorType) {
  if (!nxt.connected) return;

  try {
    switch (sensorType) {
      case 'touch':
        await nxt.setInputMode(portIndex, SENSOR_TYPES.TOUCH, SENSOR_MODES.BOOL);
        break;
      case 'light_active':
        await nxt.setInputMode(portIndex, SENSOR_TYPES.LIGHT_ACTIVE, SENSOR_MODES.PERCENT);
        break;
      case 'light_inactive':
        await nxt.setInputMode(portIndex, SENSOR_TYPES.LIGHT_INACTIVE, SENSOR_MODES.PERCENT);
        break;
      case 'sound':
        await nxt.setInputMode(portIndex, SENSOR_TYPES.SOUND_DBA, SENSOR_MODES.PERCENT);
        break;
      case 'ultrasonic':
        await nxt.setInputMode(portIndex, SENSOR_TYPES.LOWSPEED_9V, SENSOR_MODES.RAW);
        break;
      case 'none':
      default:
        await nxt.setInputMode(portIndex, SENSOR_TYPES.NONE, SENSOR_MODES.RAW);
        break;
    }
    nxt.log(`Configured Port S${portIndex + 1} as ${sensorType.toUpperCase()}`, "system");
  } catch (err) {
    nxt.log(`Failed to configure S${portIndex + 1}: ${err.message}`, "error");
  }
}

// --- Telemetry Dashboard Background Polling ---
let dashboardPollCycle = 0;

function startDashboardPoll() {
  stopDashboardPoll();

  nxt.log("Starting real-time dashboard updates...", "system");
  let activePoll = false;

  dashboardPollInterval = setInterval(async () => {
    // Only pause polling during active flash upload or Direct step execution
    if (activePoll || !nxt.connected || engine.isRunning || isUploading) return;
    activePoll = true;
    dashboardPollCycle++;

    try {
      // Periodic check for autonomous program completion on brick (every ~1.05s / 3 poll cycles)
      if (onBrickProgramRunning && (dashboardPollCycle % 3 === 0)) {
        try {
          const activeName = await nxt.getCurrentProgramName();
          if (!activeName) {
            nxt.log(`Autonomous program execution finished on brick.`, "system");
            onBrickProgramRunning = false;
            runningProgramName = null;
            stopProgramMonitor();
            updateButtonStates();
            await initActiveSensors();
          }
        } catch (progErr) {
          // SPP timeout or temporary glitch, ignore and keep polling
        }
      }

      // 1. Poll configured sensors S1 - S4
      for (let i = 0; i < 4; i++) {
        const type = sensorConfigs[i];
        const valElem = document.getElementById(`val-s${i + 1}`);
        const barElem = document.getElementById(`bar-s${i + 1}`);

        if (type === 'none') {
          valElem.textContent = '--';
          barElem.style.width = '0%';
          continue;
        }

        try {
          if (type === 'ultrasonic') {
            const dist = await nxt.readUltrasonic(i);
            if (dist === 255) {
              valElem.textContent = '∞';
              barElem.style.width = '100%';
            } else {
              valElem.textContent = `${dist} cm`;
              const pct = Math.max(0, Math.min(100, (dist / 200) * 100));
              barElem.style.width = `${pct}%`;
            }
          } else {
            const data = await nxt.getInputValues(i);
            const val = data.scaledValue;

            if (type === 'touch') {
              valElem.textContent = val === 1 ? 'PRESSED' : 'RELEASED';
              barElem.style.width = val === 1 ? '100%' : '0%';
              barElem.style.backgroundColor = val === 1 ? 'var(--color-success)' : 'transparent';
            } else {
              valElem.textContent = `${val}%`;
              barElem.style.width = `${val}%`;
            }
          }
        } catch (sensorErr) {
          // Keep current reading on transient communication glitch
        }
      }

      // 2. Poll motors A, B, C
      const motorPorts = ['A', 'B', 'C'];
      for (const p of motorPorts) {
        try {
          const state = await nxt.getMotorState(p);

          const tachoElem = document.getElementById(`val-motor-${p}`);
          const badgeElem = document.getElementById(`badge-motor-${p}`);
          const barElem = document.getElementById(`bar-motor-${p}`);

          tachoElem.textContent = `${state.rotationCount}°`;

          if (state.runState === 0x20) { // running
            badgeElem.textContent = `${state.power}%`;
            badgeElem.className = 'motor-speed-badge active';
            barElem.style.width = `${Math.abs(state.power)}%`;
          } else {
            badgeElem.textContent = 'Idle';
            badgeElem.className = 'motor-speed-badge';
            barElem.style.width = '0%';
          }
        } catch (motorErr) {
          // Keep current reading on transient communication glitch
        }
      }

    } catch (err) {
      // Ignore dashboard drop
    } finally {
      activePoll = false;
    }
  }, 350); // Poll every 350ms
}

function stopDashboardPoll() {
  if (dashboardPollInterval) {
    clearInterval(dashboardPollInterval);
    dashboardPollInterval = null;
    nxt.log("Paused dashboard updates.", "system");
  }
}

// --- UI Binding and Tabs ---
function initUI() {
  // Tabs switching
  const tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach(t => {
    t.addEventListener('click', () => {
      tabs.forEach(btn => btn.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

      t.classList.add('active');
      const targetId = t.getAttribute('data-tab');
      document.getElementById(targetId).classList.add('active');
    });
  });

  // Sensor Port config dropdown changes
  for (let i = 0; i < 4; i++) {
    const configDropdown = document.getElementById(`config-s${i + 1}`);
    configDropdown.addEventListener('change', async (e) => {
      const type = e.target.value;
      sensorConfigs[i] = type;
      if (nxt.connected) {
        await configureSensorOnBrick(i, type);
      }
    });
  }

  // Blockly Save Program XML/JSON
  document.getElementById('btn-save').addEventListener('click', () => {
    const state = Blockly.serialization.workspaces.save(workspace);
    const jsonStr = JSON.stringify(state, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'nxt_program.json';
    a.click();
    URL.revokeObjectURL(url);
    nxt.log("Visual program downloaded.", "success");
  });

  // Blockly Load Program
  const fileInput = document.getElementById('file-input');
  document.getElementById('btn-load').addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const jsonStr = event.target.result;
        const state = JSON.parse(jsonStr);
        Blockly.serialization.workspaces.load(state, workspace);
        nxt.log(`Loaded program: ${file.name}`, "success");
      } catch (err) {
        nxt.log(`Failed to load file: ${err.message}`, "error");
      }
      fileInput.value = ''; // Reset input
    };
    reader.readAsText(file);
  });

  // Blockly Clear Canvas
  document.getElementById('btn-clear').addEventListener('click', () => {
    if (confirm("Are you sure you want to clear the Blockly workspace?")) {
      workspace.clear();
      nxt.log("Blockly workspace cleared.", "system");
    }
  });
}
