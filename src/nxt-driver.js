// LEGO Mindstorms NXT Driver for Web Serial API
// Author: Antigravity

const OP_STARTPROGRAM = 0x00;
const OP_STOPPROGRAM = 0x01;
const OP_PLAYTONE = 0x03;
const OP_SETOUTPUTSTATE = 0x04;
const OP_SETINPUTMODE = 0x05;
const OP_GETOUTPUTSTATE = 0x06;
const OP_GETINPUTVALUES = 0x07;
const OP_RESETMOTORPOSITION = 0x0A;
const OP_GETBATTERYLEVEL = 0x0B;
const OP_KEEPALIVE = 0x0D;
const OP_LSGETSTATUS = 0x0E;
const OP_LSWRITE = 0x0F;
const OP_LSREAD = 0x10;
const OP_GETCURRENTPROGRAMNAME = 0x11;

// System Commands (Opcodes >= 0x80)
const OP_OPEN_WRITE = 0x81;
const OP_WRITE = 0x83;
const OP_CLOSE = 0x84;
const OP_DELETE = 0x85;
const OP_OPEN_WRITE_LINEAR = 0x89;

function encodeNxtFilename(name) {
  // Max 15.3 characters, null-terminated, padded to 20 bytes
  const buf = new Uint8Array(20);
  const encoder = new TextEncoder();
  const clean = name.trim();
  const bytes = encoder.encode(clean);
  for (let i = 0; i < Math.min(bytes.length, 19); i++) {
    buf[i] = bytes[i];
  }
  buf[19] = 0; // null terminator guaranteed
  return buf;
}

export const SENSOR_TYPES = {
  NONE: 0x00,
  TOUCH: 0x01,
  LIGHT_ACTIVE: 0x05,
  LIGHT_INACTIVE: 0x06,
  SOUND_DB: 0x07,
  SOUND_DBA: 0x08,
  LOWSPEED_9V: 0x0B
};

export const SENSOR_MODES = {
  RAW: 0x00,
  BOOL: 0x20,
  PERCENT: 0x80
};

export class NXTDriver {
  constructor() {
    this.port = null;
    this.writer = null;
    this.reader = null;
    this.connected = false;
    this.pendingReplies = new Map();
    this.logCallback = null;
    this.readLoopPromise = null;
    this.batteryInterval = null;
    this.batteryCallback = null;
    this.commandQueue = Promise.resolve();
  }

  setLogCallback(callback) {
    this.logCallback = callback;
  }

  setBatteryCallback(callback) {
    this.batteryCallback = callback;
  }

  log(message, type = 'system') {
    if (this.logCallback) {
      this.logCallback(message, type);
    } else {
      console.log(`[NXT ${type.toUpperCase()}] ${message}`);
    }
  }

  async connect() {
    if (this.connected) return;

    try {
      this.log("Requesting serial port (Bluetooth Classic paired device)...");
      // Prompt user to select port
      this.port = await navigator.serial.requestPort();

      this.log("Opening serial port...");
      await this.port.open({ baudRate: 115200 });

      this.writer = this.port.writable.getWriter();
      this.connected = true;

      // Start read loop
      this.readLoopPromise = this.readLoop();

      this.log("Testing connection (getting battery level)...");
      const voltage = await this.getBatteryLevel();
      this.log(`Connected successfully! Battery level: ${voltage.toFixed(2)}V`, 'success');

      if (this.batteryCallback) {
        this.batteryCallback(voltage);
      }

      // Start regular battery monitor and keep-alive
      this.batteryInterval = setInterval(async () => {
        try {
          const v = await this.getBatteryLevel();
          if (this.batteryCallback) this.batteryCallback(v);
          await this.keepAlive();
        } catch (e) {
          this.log(`Heartbeat error: ${e.message}`, 'error');
        }
      }, 15000);

    } catch (err) {
      this.log(`Connection failed: ${err.message}`, 'error');
      await this.disconnect();
      throw err;
    }
  }

  async disconnect() {
    if (this.batteryInterval) {
      clearInterval(this.batteryInterval);
      this.batteryInterval = null;
    }

    this.connected = false;
    this.commandQueue = Promise.resolve();

    // Clear pending replies
    for (const [opcode, pending] of this.pendingReplies.entries()) {
      clearTimeout(pending.timeoutId);
      pending.reject(new Error("Disconnected"));
    }
    this.pendingReplies.clear();

    if (this.reader) {
      try {
        await this.reader.cancel();
      } catch (e) { }
    }

    if (this.readLoopPromise) {
      await this.readLoopPromise;
      this.readLoopPromise = null;
    }

    if (this.writer) {
      this.writer.releaseLock();
      this.writer = null;
    }

    if (this.port) {
      try {
        await this.port.close();
      } catch (e) { }
      this.port = null;
    }

    this.log("Disconnected from NXT brick.", 'system');
  }

  sendCommand(opcode, payload, expectReply = true, isSystem = null, timeoutMs = 2500) {
    if (!this.connected || !this.writer) {
      return Promise.reject(new Error("NXT is not connected"));
    }

    const task = () => this._executeSendCommand(opcode, payload, expectReply, isSystem, timeoutMs);

    // Queue commands sequentially to prevent collisions on the NXT Bluetooth SPP link
    const queuedPromise = this.commandQueue.then(task, task);
    this.commandQueue = queuedPromise.catch(() => { });
    return queuedPromise;
  }

  async _executeSendCommand(opcode, payload, expectReply = true, isSystem = null, timeoutMs = 2500) {
    if (!this.connected || !this.writer) {
      throw new Error("NXT is not connected");
    }

    if (isSystem === null) {
      isSystem = (opcode >= 0x80);
    }

    const type = isSystem
      ? (expectReply ? 0x01 : 0x81)
      : (expectReply ? 0x00 : 0x80);

    const command = new Uint8Array([type, opcode, ...payload]);

    // Bluetooth SPP packet length header: 2 bytes little-endian
    const len = command.length;
    const packet = new Uint8Array(2 + len);
    packet[0] = len & 0xFF;
    packet[1] = (len >> 8) & 0xFF;
    packet.set(command, 2);

    // Write packet
    const hexSent = Array.from(packet).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
    this.log(`TX -> Opcode 0x${opcode.toString(16).padStart(2, '0').toUpperCase()} (${isSystem ? 'System' : 'Direct'}) | ${hexSent}`, 'tx');

    if (expectReply) {
      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          this.pendingReplies.delete(opcode);
          reject(new Error(`Timeout waiting for response to opcode 0x${opcode.toString(16).toUpperCase()}`));
        }, timeoutMs);

        this.pendingReplies.set(opcode, { resolve, reject, timeoutId });

        this.writer.write(packet).catch(err => {
          clearTimeout(timeoutId);
          this.pendingReplies.delete(opcode);
          reject(err);
        });
      });
    } else {
      await this.writer.write(packet);
      // Brief yield between fire-and-forget commands so NXT SPP receiver is never overrun
      await new Promise(r => setTimeout(r, 10));
      return null;
    }
  }

  async readLoop() {
    let buffer = new Uint8Array(0);

    while (this.connected && this.port && this.port.readable) {
      try {
        this.reader = this.port.readable.getReader();
        while (this.connected) {
          const { value, done } = await this.reader.read();
          if (done) break;
          if (value) {
            // Concat to buffer
            const newBuf = new Uint8Array(buffer.length + value.length);
            newBuf.set(buffer, 0);
            newBuf.set(value, buffer.length);
            buffer = newBuf;

            // Process packets in buffer
            while (buffer.length >= 2) {
              const packetLen = buffer[0] | (buffer[1] << 8);
              if (buffer.length >= 2 + packetLen) {
                const packet = buffer.slice(2, 2 + packetLen);
                buffer = buffer.slice(2 + packetLen);
                this.handleIncomingPacket(packet);
              } else {
                break; // incomplete packet, wait for more data
              }
            }
          }
        }
      } catch (err) {
        if (this.connected) {
          this.log(`Read error: ${err.message}`, 'error');
          break;
        }
      } finally {
        if (this.reader) {
          this.reader.releaseLock();
          this.reader = null;
        }
      }
    }
  }

  handleIncomingPacket(packet) {
    if (packet.length < 3) return;
    const type = packet[0];
    const opcode = packet[1];
    const status = packet[2];

    const opcodeNames = {
      0x00: 'STARTPROGRAM',
      0x01: 'STOPPROGRAM',
      0x03: 'PLAYTONE',
      0x04: 'SETOUTPUTSTATE',
      0x05: 'SETINPUTMODE',
      0x06: 'GETOUTPUTSTATE',
      0x07: 'GETINPUTVALUES',
      0x0A: 'RESETMOTORPOSITION',
      0x0B: 'GETBATTERYLEVEL',
      0x0D: 'KEEPALIVE',
      0x0E: 'LSGETSTATUS',
      0x0F: 'LSWRITE',
      0x10: 'LSREAD',
      0x11: 'GETCURRENTPROGRAMNAME',
      0x81: 'OPEN_WRITE',
      0x83: 'WRITE',
      0x84: 'CLOSE',
      0x85: 'DELETE',
      0x86: 'FIND_FIRST',
      0x87: 'FIND_NEXT',
      0x88: 'GET_VERSIONS',
      0x89: 'OPEN_WRITE_LINEAR'
    };
    const opName = opcodeNames[opcode] || `0x${opcode.toString(16).padStart(2, '0').toUpperCase()}`;

    const hexRecv = Array.from(packet).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
    this.log(`RX <- ${opName} | Status: 0x${status.toString(16).padStart(2, '0').toUpperCase()} | ${hexRecv}`, 'rx');

    if (type === 0x02) { // Reply packet
      const pending = this.pendingReplies.get(opcode);
      if (pending) {
        clearTimeout(pending.timeoutId);
        this.pendingReplies.delete(opcode);
        if (status === 0x00) {
          pending.resolve(packet);
        } else {
          const err = new Error(`NXT Brick error 0x${status.toString(16).toUpperCase()} on ${opName}`);
          err.status = status;
          err.opcode = opcode;
          err.opName = opName;
          pending.reject(err);
        }
      }
    }
  }

  // --- API Methods ---

  async getBatteryLevel() {
    const packet = await this.sendCommand(OP_GETBATTERYLEVEL, new Uint8Array(0), true);
    const mv = packet[3] | (packet[4] << 8);
    return mv / 1000.0;
  }

  async keepAlive() {
    await this.sendCommand(OP_KEEPALIVE, new Uint8Array(0), true);
  }

  async playTone(frequency, durationMs) {
    const payload = new Uint8Array(4);
    payload[0] = frequency & 0xFF;
    payload[1] = (frequency >> 8) & 0xFF;
    payload[2] = durationMs & 0xFF;
    payload[3] = (durationMs >> 8) & 0xFF;
    await this.sendCommand(OP_PLAYTONE, payload, false);
  }

  async setMotorState(portChar, power, mode, regMode, turnRatio, runState, tachoLimit = 0) {
    const portMap = { 'A': 0x00, 'B': 0x01, 'C': 0x02, 'ALL': 0xFF };
    const port = portMap[portChar.toUpperCase()];
    if (port === undefined) throw new Error(`Invalid motor port: ${portChar}`);

    // Power must be -100 to 100
    let p = Math.max(-100, Math.min(100, Math.round(power)));
    const powerByte = p < 0 ? 256 + p : p;

    const payload = new Uint8Array(10);
    payload[0] = port;
    payload[1] = powerByte;
    payload[2] = mode;
    payload[3] = regMode;
    payload[4] = turnRatio;
    payload[5] = runState;
    payload[6] = tachoLimit & 0xFF;
    payload[7] = (tachoLimit >> 8) & 0xFF;
    payload[8] = (tachoLimit >> 16) & 0xFF;
    payload[9] = (tachoLimit >> 24) & 0xFF;

    await this.sendCommand(OP_SETOUTPUTSTATE, payload, false);
  }

  async setMotorPower(portChar, power) {
    if (power === 0) {
      await this.stopMotor(portChar, true); // Brake by default when speed is set to 0
    } else {
      // Mode: MOTORON (0x01) | REGULATED (0x04)
      // Regulation: REG_SPEED (0x01)
      // RunState: RUNNING (0x20)
      await this.setMotorState(portChar, power, 0x01 | 0x04, 0x01, 0, 0x20, 0);
    }
  }

  async stopMotor(portChar, brake = true) {
    // Mode: if brake: MOTORON | BRAKE (0x01 | 0x02) else: Coast (0x00)
    const mode = brake ? (0x01 | 0x02) : 0x00;
    await this.setMotorState(portChar, 0, mode, 0x00, 0, 0x00, 0);
  }

  async resetMotorPosition(portChar, relative = true) {
    const portMap = { 'A': 0x00, 'B': 0x01, 'C': 0x02 };
    const port = portMap[portChar.toUpperCase()];
    if (port === undefined) throw new Error(`Invalid motor port: ${portChar}`);

    const payload = new Uint8Array([port, relative ? 0x01 : 0x00]);
    await this.sendCommand(OP_RESETMOTORPOSITION, payload, false);
  }

  async getMotorState(portChar) {
    const portMap = { 'A': 0x00, 'B': 0x01, 'C': 0x02 };
    const port = portMap[portChar.toUpperCase()];
    if (port === undefined) throw new Error(`Invalid motor port: ${portChar}`);

    const packet = await this.sendCommand(OP_GETOUTPUTSTATE, new Uint8Array([port]), true);

    // Parse response
    const view = new DataView(packet.buffer, packet.byteOffset, packet.byteLength);
    const power = view.getInt8(4);
    const mode = view.getUint8(5);
    const regMode = view.getUint8(6);
    const turnRatio = view.getInt8(7);
    const runState = view.getUint8(8);
    const tachoLimit = view.getUint32(9, true);
    const tachoCount = view.getInt32(13, true);
    const blockTachoCount = view.getInt32(17, true);
    const rotationCount = view.getInt32(21, true);

    return {
      power, mode, regMode, turnRatio, runState, tachoLimit,
      tachoCount, blockTachoCount, rotationCount
    };
  }

  async setInputMode(portIndex, type, mode) {
    // portIndex is 0 to 3
    const payload = new Uint8Array([portIndex, type, mode]);
    await this.sendCommand(OP_SETINPUTMODE, payload, false);
  }

  async getInputValues(portIndex) {
    // portIndex is 0 to 3
    const packet = await this.sendCommand(OP_GETINPUTVALUES, new Uint8Array([portIndex]), true);

    const view = new DataView(packet.buffer, packet.byteOffset, packet.byteLength);
    const valid = view.getUint8(4) !== 0;
    const calibrated = view.getUint8(5) !== 0;
    const sensorType = view.getUint8(6);
    const sensorMode = view.getUint8(7);
    const rawValue = view.getUint16(8, true);
    const normalizedValue = view.getUint16(10, true);
    const scaledValue = view.getInt16(12, true);
    const calibratedValue = view.getInt16(14, true);

    return {
      valid, calibrated, sensorType, sensorMode,
      rawValue, normalizedValue, scaledValue, calibratedValue
    };
  }

  // --- I2C LowSpeed Methods (Ultrasonic) ---

  async writeI2C(portIndex, txData, rxLen) {
    const payload = new Uint8Array(3 + txData.length);
    payload[0] = portIndex;
    payload[1] = txData.length;
    payload[2] = rxLen;
    payload.set(txData, 3);
    await this.sendCommand(OP_LSWRITE, payload, false);
  }

  async getI2CStatus(portIndex) {
    const packet = await this.sendCommand(OP_LSGETSTATUS, new Uint8Array([portIndex]), true);
    return {
      status: packet[2],
      bytesReady: packet[3]
    };
  }

  async readI2C(portIndex) {
    const packet = await this.sendCommand(OP_LSREAD, new Uint8Array([portIndex]), true);
    const bytesRead = packet[3];
    const data = packet.slice(4, 4 + bytesRead);
    return data;
  }

  async readUltrasonic(portIndex) {
    // 1. Write request to I2C address 0x02, register 0x42
    // Read address is 0x02 (standard ultrasonic address), read register 0x42, read 1 byte
    await this.writeI2C(portIndex, new Uint8Array([0x02, 0x42]), 1);

    // 2. Poll for data ready
    let bytesReady = 0;
    for (let i = 0; i < 15; i++) {
      await new Promise(r => setTimeout(r, 8)); // Wait 8ms between polls
      const status = await this.getI2CStatus(portIndex);
      if (status.bytesReady > 0) {
        bytesReady = status.bytesReady;
        break;
      }
    }

    if (bytesReady === 0) {
      throw new Error("Ultrasonic reading timed out");
    }

    // 3. Read data buffer
    const data = await this.readI2C(portIndex);
    if (data.length > 0) {
      // 255 (0xFF) means out of range/cannot detect
      return data[0];
    }
    throw new Error("No data returned from Ultrasonic sensor");
  }

  // --- File System & Program Control (LCP) ---

  async openWriteLinear(filename, size) {
    const fnBytes = encodeNxtFilename(filename);
    const payload = new Uint8Array(24);
    payload.set(fnBytes, 0);
    payload[20] = size & 0xFF;
    payload[21] = (size >> 8) & 0xFF;
    payload[22] = (size >> 16) & 0xFF;
    payload[23] = (size >>> 24) & 0xFF;

    const packet = await this.sendCommand(OP_OPEN_WRITE_LINEAR, payload, true, true, 4000);
    const handle = packet[3];
    return handle;
  }

  async openWrite(filename, size) {
    const fnBytes = encodeNxtFilename(filename);
    const payload = new Uint8Array(24);
    payload.set(fnBytes, 0);
    payload[20] = size & 0xFF;
    payload[21] = (size >> 8) & 0xFF;
    payload[22] = (size >> 16) & 0xFF;
    payload[23] = (size >>> 24) & 0xFF;

    const packet = await this.sendCommand(OP_OPEN_WRITE, payload, true, true, 4000);
    const handle = packet[3];
    return handle;
  }

  async writeFile(handle, chunk) {
    const payload = new Uint8Array(1 + chunk.length);
    payload[0] = handle;
    payload.set(chunk, 1);

    const packet = await this.sendCommand(OP_WRITE, payload, true, true, 2000);
    // packet: [type(0x02), opcode(0x83), status(0x00), handle, writtenLSB, writtenMSB]
    const written = packet[4] | (packet[5] << 8);
    return written;
  }

  async closeFile(handle) {
    const payload = new Uint8Array([handle]);
    await this.sendCommand(OP_CLOSE, payload, true, true, 2000);
  }

  async closeAllHandles() {
    for (let h = 0; h < 4; h++) {
      try {
        await this.closeFile(h);
      } catch (e) {
        // Expected for handles that aren't open
      }
    }
  }

  async deleteFile(filename) {
    const fnBytes = encodeNxtFilename(filename);
    try {
      await this.sendCommand(OP_DELETE, fnBytes, true, true, 3000);
      this.log(`Deleted ${filename} from brick.`, 'system');
      return true;
    } catch (err) {
      if (err.status === 0x87) {
        // Try uppercase variant if lowercase wasn't found
        if (filename !== filename.toUpperCase()) {
          try {
            const upperBytes = encodeNxtFilename(filename.toUpperCase());
            await this.sendCommand(OP_DELETE, upperBytes, true, true, 3000);
            this.log(`Deleted ${filename.toUpperCase()} from brick.`, 'system');
            return true;
          } catch (upperErr) {
            return false;
          }
        }
        return false;
      }
      this.log(`Notice during delete of ${filename}: ${err.message}`, 'warning');
      return false;
    }
  }

  async listFiles(pattern = "*.*") {
    const fnBytes = encodeNxtFilename(pattern);
    const files = [];
    try {
      const packet = await this.sendCommand(0x86, fnBytes, true, true, 2500);
      const handle = packet[3];
      const decoder = new TextDecoder('ascii');

      const fnSlice = packet.slice(4, 24);
      let nullIdx = fnSlice.indexOf(0);
      if (nullIdx === -1) nullIdx = fnSlice.length;
      const fname = decoder.decode(fnSlice.slice(0, nullIdx)).trim();
      const size = packet[24] | (packet[25] << 8) | (packet[26] << 16) | (packet[27] << 24);
      if (fname) files.push({ name: fname, size });

      let searchOpen = true;
      while (searchOpen) {
        try {
          const nextPacket = await this.sendCommand(0x87, new Uint8Array([handle]), true, true, 2000);
          const nextFnSlice = nextPacket.slice(4, 24);
          let nNull = nextFnSlice.indexOf(0);
          if (nNull === -1) nNull = nextFnSlice.length;
          const nextName = decoder.decode(nextFnSlice.slice(0, nNull)).trim();
          const nextSize = nextPacket[24] | (nextPacket[25] << 8) | (nextPacket[26] << 16) | (nextPacket[27] << 24);
          if (nextName) files.push({ name: nextName, size: nextSize });
        } catch (e) {
          searchOpen = false;
        }
      }

      try {
        await this.closeFile(handle);
      } catch (e) { }
    } catch (e) {
      // Pattern not found
    }
    return files;
  }

  async startProgram(filename) {
    const clean = filename.trim();
    // In LEGO Mindstorms NXT Direct Command protocol (Opcode 0x00), the filename parameter
    // must be a fixed 20-byte ASCII field (null-terminated and padded with 0x00 to 20 bytes).
    const payload = encodeNxtFilename(clean);

    // Strategy 1: Standard Direct Command with reply (0x00)
    try {
      this.log(`Sending STARTPROGRAM for ${clean} (20-byte payload, reply requested)...`, 'system');
      await this.sendCommand(OP_STARTPROGRAM, payload, true, false, 3000);
      return;
    } catch (err) {
      this.log(`STARTPROGRAM on ${clean} returned error: ${err.message}`, 'warning');

      // If error indicates file not found (0xBD or 0x87) or illegal value (0xC0), try candidate variations
      const tryCandidates = [];

      // Variation 1: Uppercase (e.g. PROG.RXE)
      if (clean !== clean.toUpperCase()) {
        tryCandidates.push(clean.toUpperCase());
      }

      // Variation 2 & 3: Without .rxe extension (e.g. prog / PROG)
      if (clean.toLowerCase().endsWith('.rxe')) {
        const noExt = clean.replace(/\.rxe$/i, '');
        tryCandidates.push(noExt);
        if (noExt !== noExt.toUpperCase()) {
          tryCandidates.push(noExt.toUpperCase());
        }
      }

      for (const candidate of tryCandidates) {
        try {
          this.log(`Retrying STARTPROGRAM with candidate: "${candidate}"...`, 'system');
          const candPayload = encodeNxtFilename(candidate);
          await this.sendCommand(OP_STARTPROGRAM, candPayload, true, false, 2500);
          this.log(`Program "${candidate}" successfully started on brick!`, 'success');
          return;
        } catch (candErr) {
          // Continue to next candidate
        }
      }

      // Variation 4: Direct fire-and-forget (type 0x80) with 20-byte payload
      try {
        this.log(`Attempting STARTPROGRAM fire-and-forget (0x80) with 20-byte payload...`, 'system');
        await this.sendCommand(OP_STARTPROGRAM, payload, false, false, 500);
        await new Promise(r => setTimeout(r, 400));

        // Check if program is actively executing on the brick
        const active = await this.getCurrentProgramName();
        if (active) {
          this.log(`Verified active program running on brick: ${active}`, 'success');
          return;
        }
      } catch (e) { }

      // If all attempts failed, throw the original error
      throw err;
    }
  }

  async stopProgram() {
    // Direct command (type 0x00)
    try {
      await this.sendCommand(OP_STOPPROGRAM, new Uint8Array(0), true, false, 2000);
    } catch (err) {
      // 0xEC: No active program running
      if (err.status === 0xEC || (err.message && err.message.includes('0xEC'))) {
        return;
      }
      throw err;
    }
  }

  async getCurrentProgramName() {
    try {
      const packet = await this.sendCommand(OP_GETCURRENTPROGRAMNAME, new Uint8Array(0), true, false, 2500);
      const fnSlice = packet.slice(3, 23);
      let nullIdx = fnSlice.indexOf(0);
      if (nullIdx === -1) nullIdx = fnSlice.length;
      const decoder = new TextDecoder('ascii');
      const name = decoder.decode(fnSlice.slice(0, nullIdx)).trim();
      return name.length > 0 ? name : null;
    } catch (err) {
      // 0xEC (STAT_NO_ACTIVE_PROG) or any non-zero brick status indicates no user program is active
      if (err.status !== undefined && err.status !== 0x00) {
        return null;
      }
      if (err.message && (err.message.includes('0xEC') || err.message.toLowerCase().includes('no active program'))) {
        return null;
      }
      throw err;
    }
  }

  async uploadFile(filename, uint8Data, onProgress = null) {
    this.log(`Preparing to upload ${filename} (${uint8Data.length} bytes)...`, 'system');

    // Step 0: Stop any active program so target files are not busy/locked
    try {
      await this.stopProgram();
      await new Promise(r => setTimeout(r, 60));
    } catch (e) { }

    // Step 0.5: Close any dangling open file handles on the brick
    await this.closeAllHandles();
    await new Promise(r => setTimeout(r, 60));

    // Step 1: Clean existing file on brick if present
    this.log(`Cleaning existing ${filename} on brick if present...`, 'system');
    await this.deleteFile(filename);
    await new Promise(r => setTimeout(r, 120)); // Short pause for flash compaction

    // Step 2: Open file for writing (linear for .rxe executables)
    let handle;
    let targetName = filename;
    const isRxe = filename.toLowerCase().endsWith('.rxe');
    this.log(`Creating ${targetName} on brick (${uint8Data.length} bytes, linear=${isRxe})...`, 'system');
    try {
      handle = isRxe
        ? await this.openWriteLinear(targetName, uint8Data.length)
        : await this.openWrite(targetName, uint8Data.length);
    } catch (err) {
      // If error is 0x8F (File name exists), the file is locked in flash. Try alternate name:
      if (err.status === 0x8F || (err.message && err.message.includes('0x8F'))) {
        this.log(`File ${targetName} is locked in flash. Trying alternative name...`, 'warning');
        const altName = targetName.toLowerCase().startsWith('prog') ? 'robot.rxe' : 'prog1.rxe';
        await this.deleteFile(altName);
        await new Promise(r => setTimeout(r, 100));
        targetName = altName;
        handle = isRxe
          ? await this.openWriteLinear(targetName, uint8Data.length)
          : await this.openWrite(targetName, uint8Data.length);
        this.log(`Fallback file ${targetName} created!`, 'system');
      } else if (isRxe) {
        this.log(`Linear write open failed, falling back to standard open: ${err.message}`, 'warning');
        handle = await this.openWrite(targetName, uint8Data.length);
      } else {
        throw err;
      }
    }
    this.log(`File created with handle ID: ${handle}`, 'system');

    // Step 3: Write in chunks of up to 56 bytes
    const chunkSize = 56;
    let offset = 0;
    while (offset < uint8Data.length) {
      const end = Math.min(offset + chunkSize, uint8Data.length);
      const chunk = uint8Data.subarray(offset, end);
      const written = await this.writeFile(handle, chunk);
      if (written === 0) {
        throw new Error(`NXT brick failed to write bytes at offset ${offset} (flash may be full)`);
      }
      offset += (written > 0 ? written : chunk.length);
      if (onProgress) {
        onProgress(offset, uint8Data.length);
      }
      await new Promise(r => setTimeout(r, 12)); // 12ms pacing between Bluetooth SPP packets
    }

    // Step 4: Close file
    this.log(`Closing file handle ${handle} to finalize flash...`, 'system');
    await this.closeFile(handle);
    this.log(`Successfully uploaded and finalized ${targetName} on NXT!`, 'success');
    return targetName;
  }

  async uploadAndRunProgram(filename, uint8Data, onProgress = null) {
    const actualName = await this.uploadFile(filename, uint8Data, onProgress);
    await new Promise(r => setTimeout(r, 400)); // 400ms settling time for filesystem sync
    this.log(`Starting autonomous execution of ${actualName} on brick...`, 'system');
    await this.startProgram(actualName);
    this.log(`Program ${actualName} started on brick!`, 'success');
    return actualName;
  }

  // --- Display Logging Helpers ---
  async displayText(text, line) {
    this.log(`[NXT Display Line ${line}] ${text}`, 'display');
  }

  async displayClear() {
    this.log('[NXT Display] Cleared', 'display');
  }

  async displayClearLine(line) {
    this.log(`[NXT Display Line ${line}] Cleared`, 'display');
  }
}
