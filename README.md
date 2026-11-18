# LEGO Mindstorms NXT Scratch IDE

A modern, web-based visual programming environment for the LEGO Mindstorms NXT control brick. It uses Google Blockly (the same visual blocks engine behind MIT Scratch) and communicates wirelessly with the brick via the **Web Serial API** (direct Bluetooth Classic RFCOMM connection).

## Key Features
- **Zero Install Driver:** Uses Bluetooth Classic SPP direct access via Web Serial API. No need to replace USB drivers using WinUSB/Zadig.
- **Dual Execution Modes:**
  - **Autonomous On-Brick Execution (`.rxe`):** Compile visual blocks to NXC and flash directly to the NXT's flash memory over Bluetooth, or upload precompiled `.rxe` files. The program runs natively and autonomously on the brick with zero wireless latency!
  - **Direct Command Mode:** Step-by-step interactive execution orchestrated by the browser, ideal for quick testing.
- **Real-Time Telemetry Dashboard:** Displays motor encoder counts (tachometers) and sensor values (Touch, Light, Sound, Ultrasonic) in real time.
- **Unified Stop Button:** Halts both browser-orchestrated Direct commands and active on-brick `.rxe` programs, braking all motors immediately.
- **NXC & JavaScript Transpilers:** View live NXC (Not eXactly C) and JavaScript code side-by-side as you build with blocks.
- **Program Save/Load & NXC Export:** Download programs as JSON or export standard `.nxc` source files.
- **Educational Log:** Displays raw hex transactions (TX/RX packets) to teach students how serial communication protocols work.

---

## Getting Started

### 1. Bluetooth Pairing (Windows)
Before launching the IDE, you must pair the LEGO NXT brick with your computer:
1. **On your LEGO NXT Brick:**
   - Turn on the NXT.
   - Navigate to the **Bluetooth** menu.
   - Ensure **Bluetooth** is set to **On** and **Visibility** is set to **Visible**.
2. **On your Windows PC:**
   - Go to **Windows Settings > Bluetooth & Devices**.
   - Click **Add Device > Bluetooth**.
   - Select your NXT brick (usually named `NXT`).
   - If prompted for a PIN code, enter `1234` (the default LEGO PIN) or `0000`. On the NXT screen, confirm the pairing and enter the same PIN code.
   - Wait until Windows confirms the device is successfully paired.

---

### 2. Installing and Running the Web App

To run the application locally:
1. Ensure you have **Node.js** installed on your system.
2. Open a command prompt/terminal in this project folder:
   ```bash
   # Install dependencies (Blockly and Vite)
   npm install

   # Start the local development server
   npm run dev
   ```
3. Open the output URL (usually `http://localhost:5173`) in a supported browser.
   > **Note:** Direct Bluetooth Web Serial access is supported in Chromium-based desktop browsers like **Google Chrome** or **Microsoft Edge** (version 117 or newer).

---

## Operating the IDE

1. **Configure Sensors:**
   - Look at the **Robot Telemetry** dashboard on the right.
   - Configure Ports S1 to S4 by selecting what sensor is connected using the dropdowns (e.g. S1: Touch Sensor, S4: Ultrasonic).
2. **Establish Connection:**
   - Click the blue **Connect NXT** button in the header.
   - Select the paired `NXT` device from the browser popup.
   - The status LED in the header will glow **green (Connected)**, and you will see the NXT's live battery voltage (e.g. `7.42V`).
   - You will see the **System Log** start printing raw transmission packages.
3. **Execution Modes:**
   - **Flash to NXT (Autonomous .rxe Mode):**
     Click **Flash to NXT** to compile your visual program into native NXC bytecode and upload it directly over Bluetooth into the NXT's flash memory. Once uploaded, the brick starts running the program autonomously with zero latency!
     *(To enable on-the-fly compilation, drop `nbc.exe` into the `tools/` directory in this project or ensure it is in your system PATH).*
   - **Upload .rxe:**
     Click **Upload .rxe** to upload and execute any precompiled `.rxe` file from your computer over Bluetooth.
   - **Run (Direct Commands Mode):**
     Click **Run (Direct)** to execute the blocks interactively step-by-step from your browser over Bluetooth.
   - **Stop:**
     Halts execution immediately. Works for both Direct Command runs and on-brick `.rxe` programs, stopping and braking all motors.
4. **NXC Code & Save/Load:**
   - Check the **NXC Code (C)** tab in the bottom panel to inspect the generated C-like source code.
   - Click **Export NXC** to download the `.nxc` file for editing in BricxCC.
   - Use **Save** and **Load** to save and restore your Blockly workspace.
