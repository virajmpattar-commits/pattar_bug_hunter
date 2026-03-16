# 🐉 Pattar Bug Hunter - Kali Edition

![PWA Support](https://img.shields.io/badge/PWA-Ready-00f2ff?style=for-the-badge&logo=pwa&logoColor=white)
![Security](https://img.shields.io/badge/Security-Offensive-red?style=for-the-badge&logo=kali-linux&logoColor=white)
![Engine](https://img.shields.io/badge/Engine-Gemini_3.1_Pro-blue?style=for-the-badge&logo=google-gemini&logoColor=white)

**Pattar Bug Hunter** is a high-performance, AI-driven offensive security code auditor designed for the Kali Linux ecosystem. It leverages the Gemini 3.1 Pro engine to identify vulnerabilities, logic flaws, and security leaks in real-time, while providing a robust offline heuristic engine for air-gapped environments.

---

## 🚀 Key Features

- **🧠 AI-Powered Auditing**: Deep contextual analysis using Gemini 3.1 Pro to find complex vulnerabilities (SQLi, XSS, RCE, Logic Flaws).
- **📶 Hybrid Engine (Offline Support)**: Automatically switches to a local heuristic engine when offline, detecting `eval()` usage, hardcoded secrets, and DOM-based XSS.
- **📱 PWA Ready**: Installable as a native application on Kali Linux, Windows, or macOS. Works completely offline once cached.
- **🛠️ CLI Bridge**: Includes a Python-based bridge to pipe terminal output directly into the analysis engine.
- **⚡ Portable Edition**: Export a single-file version of the tool that runs anywhere with just a browser.
- **🛡️ Auto-Remediation**: One-click "Fix" logic to generate hardened, secure versions of vulnerable code.

---

## 🛠️ Installation & Setup

### Web / PWA
1. Navigate to the deployed URL.
2. Click the **Install** icon in your browser's address bar.
3. Access Pattar directly from your application menu.

### Local Development
```bash
# Clone the repository
git clone https://github.com/your-username/pattar-bug-hunter.git

# Install dependencies
npm install

# Start the development server
npm run dev
```

---

## 📟 CLI Usage

Pattar includes a `sentinel.py` bridge for terminal integration.

```bash
# Scan a server-side script
cat server.js | python3 sentinel.py javascript

# Audit recent terminal history for leaked credentials
history | tail -n 50 | python3 sentinel.py terminal
```

---

## ⚙️ Configuration

To use the AI-powered features, you must provide a Gemini API Key.
1. Obtain a key from [Google AI Studio](https://aistudio.google.com/).
2. In the app, go to **Settings** and enter your key, or set it as an environment variable:
   `VITE_GEMINI_API_KEY=your_key_here`

---

## ⚖️ Legal Disclaimer

*This tool is intended for educational purposes and authorized security testing only. The authors are not responsible for any misuse or damage caused by this application. Always obtain explicit permission before auditing third-party code.*

---

<p align="center">
  Developed by <b>Pattar Bug Hunter Systems</b><br>
  <i>"Hunting bugs where they hide."</i>
</p>
