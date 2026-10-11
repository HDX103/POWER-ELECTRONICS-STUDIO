# POWER-ELECTRONICS-STUDIO
# Power Electronics Studio ⚡

An interactive, full-featured web-based power electronics converter simulator and analysis workbench designed to run directly in the browser and deploy seamlessly to GitHub Pages.

Inspired by academic virtual laboratories like [RectifierLab](https://hotaarpan-iitkgp.github.io/Rectfier-lab/), this studio expands far beyond simple rectifiers to cover **all four conversion families**, **multiple semiconductor switch technologies** (Diodes, Thyristors, MOSFETs, IGBTs, TRIACs), **real-time animated current paths**, **multi-channel oscilloscope waveforms**, **Fourier harmonic FFT analysis**, and **step-by-step mathematical theory derivations**.

---

## 🌟 Key Features

### 1. Converter Families & Topologies
- **AC-DC (Rectifiers)**:
  - Single-Phase Half-Wave Rectifier (Diode & Controlled SCR, R/RL/RLE loads, Freewheeling Diode FWD)
  - Single-Phase Full-Bridge Rectifier (Uncontrolled Diode Bridge & Fully-Controlled SCR Bridge)
  - Single-Phase Semi-Converter (Half-controlled bridge with intrinsic freewheeling action)
  - Three-Phase Half-Wave (3-Pulse) Rectifier
  - Three-Phase Full-Bridge (6-Pulse) Rectifier (Uncontrolled & Controlled 6-Pulse Converter)
- **DC-DC (Switch-Mode Converters)**:
  - Buck Converter (Step-Down, CCM & DCM with LC filter)
  - Boost Converter (Step-Up with energy storage inductor)
  - Buck-Boost Converter (Inverting Step-Up/Down)
- **DC-AC (Inverters)**:
  - Single-Phase Full-Bridge (H-Bridge) Inverter
  - Modulation schemes: Square-wave, Bipolar Sine PWM (SPWM), Unipolar SPWM
- **AC-AC (Controllers & Cycloconverters)**:
  - Single-Phase AC Voltage Controller (Phase angle control with antiparallel SCRs / TRIAC)
  - Single-Phase Cycloconverter (Direct AC-AC step-down frequency changer: $f_o = f_s/2, f_s/3, f_s/4$)

### 2. Semiconductor Switch Models
Easily select, configure, and inspect different power switches:
- **Diode**: Forward voltage drop $V_f$, internal resistance $R_{on}$, reverse blocking $R_{off}$, reverse recovery.
- **Thyristor (SCR)**: Phase-angle triggering, holding current $I_h$, latching current $I_l$, natural commutation.
- **MOSFET**: Gate-controlled fast switching, $R_{DS(on)}$, antiparallel body diode freewheeling.
- **IGBT**: High-voltage gate-controlled switching, saturation voltage $V_{CE(sat)}$.
- **TRIAC**: Bidirectional AC conduction for AC voltage regulators.
- **Ideal Switch**: Lossless, instantaneous switching benchmark.
- **Industry Presets**: 1N4007, 1N5408, MBR20100CT, BT151, TYN612, IRFP460, FGA25N120, BTA16.

### 3. Dynamic Animated Current Flow Schematics
- High-definition interactive SVG circuit schematics for every topology.
- Real-time **animated glowing flowing dashed lines** showing the physical path of current at each microsecond instant.
- Live device status badges: `ON` (green), `TRIGGERED` (cyan), `FREEWHEELING` (amber), `OFF` (gray).
- Clickable switches to directly open the device semiconductor manager.

### 4. Synchronized Multi-Channel Oscilloscope
- Multi-trace visualization:
  - Supply Voltage $V_s$ / $V_{in}$
  - Output Voltage $V_o$
  - Output Current $I_o$
  - Inductor Current $i_L$ / Capacitor Voltage $v_C$
  - Firing Pulses & PWM Carrier / Reference waves
- Interactive crosshair cursor with instant numerical readout.
- Animation controls: Play, Pause, Step forward, Time scrubber, Speed (0.25x to 2x).

### 5. Fourier Harmonic Spectrum & FFT
- Discrete Fourier Transform (DFT) up to 25th harmonic.
- Interactive spectrum bar chart showing fundamental and harmonic amplitudes (% of fundamental).
- Automatic calculation of Total Harmonic Distortion (THD %), Distortion Factor ($DF$), and Form Factor ($FF$).

### 6. Mathematical Theory & Derivation Engine
- Theoretical governing equations for $V_{dc}$, $V_{rms}$, $I_{dc}$, ripple factor, and efficiency.
- Step-by-step mathematical derivations with current user input numbers substituted in real time.
- Direct comparison table: Simulated vs Ideal Theory with percentage error metrics.

### 7. Parameter Sweeps & Export
- Parameter sweep analysis: Sweep firing angle $\alpha$, duty cycle $D$, modulation index $m_a$, or load $R$.
- Export simulation time-domain waveforms to CSV.
- Save and load circuit configurations as JSON.

---

## 🚀 100% Client-Side Simulation (GitHub Pages Ready)

The simulation engine is written in pure, optimized TypeScript with companion numerical integration. **No Python or server backend is required to run the simulator!** When you deploy to GitHub Pages, the entire application works immediately out of the box.

### Deploying to Your GitHub Pages:
1. Initialize git and commit:
   ```bash
   git init
   git add .
   git commit -m "Initial commit of Power Electronics Studio"
   ```
2. Add your GitHub repository remote:
   ```bash
   git remote add origin https://github.com/<your-username>/<your-repo>.git
   git branch -M main
   git push -u origin main
   ```
3. Enable GitHub Pages in your GitHub repository:
   - Go to **Settings** → **Pages**
   - Under **Build and deployment** > **Source**, select **GitHub Actions**
   - The included `.github/workflows/deploy.yml` workflow will automatically build and publish the studio to `https://<your-username>.github.io/<your-repo>/`!

---

## 💻 Local Development

### Frontend
```bash
cd frontend
npm install
npm run dev      # Starts Vite dev server at http://localhost:5173
npm run build    # Produces production distribution in frontend/dist/
npm test         # Runs automated Vitest test suite (130+ unit tests)
```

### Backend (Optional)
A FastAPI Python backend is also included for advanced MNA solver workflows:
```bash
cd backend
python -m venv venv
venv\Scripts\activate   # or source venv/bin/activate on Linux/macOS
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```
