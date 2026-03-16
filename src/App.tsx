import React, { useState, useRef, useEffect } from 'react';
import { 
  Shield, 
  Bug, 
  Zap, 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle, 
  Info, 
  Code2, 
  Search, 
  ChevronRight,
  Terminal,
  FileCode,
  ShieldAlert,
  Loader2,
  ArrowRight,
  Download,
  Wifi,
  WifiOff,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { analyzeCode, fixCode, AuditResponse, ScanResult } from './services/geminiService';
import Markdown from 'react-markdown';

const SEVERITY_COLORS = {
  critical: 'text-red-500 bg-red-500/10 border-red-500/20',
  high: 'text-orange-500 bg-orange-500/10 border-orange-500/20',
  medium: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20',
  low: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
  info: 'text-zinc-400 bg-zinc-400/10 border-zinc-400/20',
};

const TYPE_ICONS = {
  security: ShieldAlert,
  bug: Bug,
  performance: Zap,
  'best-practice': CheckCircle2,
};

export default function App() {
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState<AuditResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<ScanResult | null>(null);
  const [showCliModal, setShowCliModal] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check for SW updates
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(registration => {
        registration.addEventListener('updatefound', () => {
          setUpdateAvailable(true);
        });
      });
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const runLocalHeuristics = (code: string): AuditResponse => {
    const vulnerabilities: ScanResult[] = [];
    
    // Simple regex-based offline checks
    if (code.includes('eval(')) {
      vulnerabilities.push({
        title: 'Dangerous eval() Usage',
        severity: 'critical',
        type: 'security',
        description: 'The eval() function is extremely dangerous as it executes arbitrary code.',
        suggestion: 'Use safer alternatives like JSON.parse() or direct property access.'
      });
    }
    if (code.match(/password\s*=\s*['"][^'"]+['"]/i)) {
      vulnerabilities.push({
        title: 'Hardcoded Credentials',
        severity: 'high',
        type: 'security',
        description: 'Hardcoded passwords detected in source code.',
        suggestion: 'Use environment variables or a secret management service.'
      });
    }
    if (code.includes('innerHTML')) {
      vulnerabilities.push({
        title: 'Potential XSS via innerHTML',
        severity: 'medium',
        type: 'security',
        description: 'Assigning to innerHTML can lead to Cross-Site Scripting (XSS).',
        suggestion: 'Use textContent or innerText instead.'
      });
    }

    return {
      summary: vulnerabilities.length > 0 
        ? `[OFFLINE MODE] Found ${vulnerabilities.length} potential issues using local heuristic analysis.`
        : "[OFFLINE MODE] No obvious vulnerabilities found via local heuristics. Connect to internet for deep AI analysis.",
      score: Math.max(0, 100 - (vulnerabilities.length * 20)),
      vulnerabilities
    };
  };

  const handleScan = async () => {
    if (!code.trim()) return;
    
    setIsScanning(true);
    setError(null);
    setResult(null);
    setSelectedIssue(null);

    if (!isOnline) {
      setTimeout(() => {
        setResult(runLocalHeuristics(code));
        setIsScanning(false);
      }, 800);
      return;
    }

    try {
      const data = await analyzeCode(code, language);
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred during scanning.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleFixAll = async () => {
    if (!result || !code.trim()) return;
    setIsFixing(true);
    try {
      const fixedCode = await fixCode(code, language, result.vulnerabilities);
      setCode(fixedCode);
      setResult(null); // Clear results as they are now outdated
      setError("Code has been updated with AI-suggested fixes. Run a new scan to verify.");
    } catch (err: any) {
      setError("Failed to apply fixes: " + err.message);
    } finally {
      setIsFixing(false);
    }
  };

  const handleDownloadPortable = () => {
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pattar Bug Hunter - Portable Kali Edition</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
    <style>
        body { background-color: #0f111a; color: #e0e0e0; font-family: 'Inter', sans-serif; }
        .kali-glow { box-shadow: 0 0 20px rgba(0, 242, 255, 0.1); }
        .glass-panel { background: rgba(26, 28, 37, 0.8); backdrop-filter: blur(12px); border: 1px solid #2d313d; }
        .scan-line { background: linear-gradient(to bottom, transparent, rgba(0, 242, 255, 0.15), transparent); height: 150px; width: 100%; position: absolute; top: -150px; animation: scan 4s linear infinite; pointer-events: none; }
        @keyframes scan { 0% { top: -150px; } 100% { top: 100%; } }
        .terminal-cursor { display: inline-block; width: 8px; height: 16px; background: #00f2ff; animation: blink 1s infinite; vertical-align: middle; margin-left: 4px; }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
    </style>
</head>
<body class="min-h-screen flex flex-col">
    <header class="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-md sticky top-0 z-50">
        <div class="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-[#00f2ff]/10 border border-[#00f2ff]/20 flex items-center justify-center kali-glow">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00f2ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                </div>
                <div>
                    <h1 class="text-lg font-bold tracking-tight text-white uppercase">Pattar Bug Hunter <span class="text-[9px] bg-[#00f2ff] text-black px-1 rounded ml-1">PORTABLE</span></h1>
                    <p class="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Standalone Offensive Engine</p>
                </div>
            </div>
            <div class="text-[10px] font-mono text-zinc-500">KALI LINUX PORTABLE EDITION v1.0</div>
        </div>
    </header>

    <main class="flex-1 max-w-7xl mx-auto w-full p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div class="lg:col-span-12 flex flex-col gap-4">
            <div class="glass-panel rounded-2xl p-6">
                <h2 class="text-sm font-bold text-white mb-4 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00f2ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3y-3.5 3.5"/></svg>
                    CONFIGURATION REQUIRED
                </h2>
                <div class="flex flex-col gap-2">
                    <label class="text-[10px] font-mono text-zinc-500 uppercase">Gemini API Key</label>
                    <input type="password" id="apiKey" placeholder="Enter your Gemini API Key..." class="bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-sm text-[#00f2ff] outline-none focus:border-[#00f2ff]/50 transition-all">
                    <p class="text-[10px] text-zinc-600">This portable version runs entirely in your browser. Your API key is never stored.</p>
                </div>
            </div>

            <div class="glass-panel rounded-2xl overflow-hidden flex flex-col h-[500px]">
                <div class="px-4 py-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/30">
                    <span class="text-xs font-mono text-zinc-300">PORTABLE_AUDIT.js</span>
                    <select id="language" class="bg-zinc-800 text-zinc-300 text-[10px] font-mono px-2 py-1 rounded border border-zinc-700 outline-none">
                        <option value="javascript">JAVASCRIPT</option>
                        <option value="python">PYTHON</option>
                        <option value="terminal">TERMINAL_LOGS</option>
                        <option value="nmap">NMAP_SCAN</option>
                    </select>
                </div>
                <textarea id="codeInput" placeholder="// Paste code here..." class="flex-1 bg-transparent p-4 font-mono text-sm text-zinc-300 resize-none outline-none"></textarea>
                <div class="p-4 border-t border-zinc-800 bg-zinc-900/30 flex justify-end">
                    <button id="scanBtn" class="px-6 py-2 rounded-xl bg-[#00f2ff] text-black font-bold text-sm kali-glow hover:scale-105 transition-all">INITIALIZE SCAN</button>
                </div>
            </div>

            <div id="results" class="hidden glass-panel rounded-2xl p-6">
                <div id="loading" class="hidden flex flex-col items-center justify-center py-12">
                    <div class="w-8 h-8 border-4 border-[#00f2ff]/20 border-t-[#00f2ff] rounded-full animate-spin mb-4"></div>
                    <p class="text-sm font-mono text-zinc-500">ANALYZING PAYLOAD...</p>
                </div>
                <div id="content" class="space-y-4"></div>
            </div>
        </div>
    </main>

    <script type="module">
        import { GoogleGenerativeAI } from "https://esm.run/@google/generative-ai";

        const scanBtn = document.getElementById('scanBtn');
        const results = document.getElementById('results');
        const loading = document.getElementById('loading');
        const content = document.getElementById('content');

        scanBtn.onclick = async () => {
            const key = document.getElementById('apiKey').value;
            const code = document.getElementById('codeInput').value;
            const lang = document.getElementById('language').value;

            if (!key) return alert('API Key required');
            if (!code) return alert('Input required');

            results.classList.remove('hidden');
            loading.classList.remove('hidden');
            content.innerHTML = '';

            try {
                const genAI = new GoogleGenerativeAI(key);
                const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
                
                const prompt = \`Analyze the following \${lang} code for vulnerabilities. Return a JSON object with 'summary' (string), 'score' (number 0-100), and 'vulnerabilities' (array of {title, severity, type, description, suggestion}).\\n\\n\${code}\`;
                
                const result = await model.generateContent(prompt);
                const response = await result.response;
                const text = response.text();
                
                // Clean JSON
                const jsonStr = text.match(/\\{.*\\}/s)[0];
                const data = JSON.parse(jsonStr);

                loading.classList.add('hidden');
                content.innerHTML = \`
                    <div class="flex items-center justify-between mb-6">
                        <div>
                            <h3 class="text-xs font-mono text-zinc-500 uppercase tracking-widest">Security Score</h3>
                            <div class="text-4xl font-bold text-[#00f2ff]">\${data.score}<span class="text-sm text-zinc-600">/100</span></div>
                        </div>
                    </div>
                    <p class="text-sm text-zinc-300 leading-relaxed mb-6">\${data.summary}</p>
                    <div class="space-y-3">
                        \${data.vulnerabilities.map(v => \`
                            <div class="p-4 rounded-xl border border-zinc-800 bg-zinc-900/30">
                                <div class="flex items-center justify-between mb-2">
                                    <span class="text-xs font-bold text-white uppercase">\${v.title}</span>
                                    <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-red-500/10 text-red-500 border border-red-500/20">\${v.severity}</span>
                                </div>
                                <p class="text-xs text-zinc-500">\${v.description}</p>
                            </div>
                        \`).join('')}
                    </div>
                \`;
            } catch (err) {
                loading.classList.add('hidden');
                content.innerHTML = \`<p class="text-red-500 font-mono text-xs">ERROR: \${err.message}</p>\`;
            }
        };
    </script>
</body>
</html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pattar-portable-kali.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#00f2ff]/10 border border-[#00f2ff]/20 flex items-center justify-center kali-glow">
              <Shield className="w-6 h-6 text-[#00f2ff]" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white uppercase">Pattar Bug Hunter <span className="text-[9px] bg-[#00f2ff] text-black px-1 rounded ml-1">KALI-EDITION</span></h1>
              <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Advanced Offensive Security Engine</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-6 text-sm font-medium text-zinc-400">
              <button 
                onClick={handleDownloadPortable}
                className="flex items-center gap-2 hover:text-[#00f2ff] transition-colors text-[#00f2ff]"
              >
                <Download className="w-4 h-4" />
                Download Portable
              </button>
              <button 
                onClick={() => setShowCliModal(true)}
                className="flex items-center gap-2 hover:text-white transition-colors"
              >
                <Terminal className="w-4 h-4" />
                CLI Access
              </button>
              <a href="#" className="hover:text-white transition-colors">Documentation</a>
              <a href="#" className="hover:text-white transition-colors">API</a>
              <a href="#" className="hover:text-white transition-colors">Settings</a>
            </div>
            <button className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium transition-all border border-zinc-700">
              Connect Repo
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Input */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="glass-panel rounded-2xl overflow-hidden flex flex-col h-[600px]">
            <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/30">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-zinc-400" />
                <span className="text-xs font-mono text-zinc-300">SOURCE_AUDIT.js</span>
              </div>
              <select 
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="bg-zinc-800 text-zinc-300 text-[10px] font-mono px-2 py-1 rounded border border-zinc-700 outline-none"
              >
                <option value="javascript">JAVASCRIPT</option>
                <option value="python">PYTHON</option>
                <option value="terminal">TERMINAL_LOGS</option>
                <option value="nmap">NMAP_SCAN</option>
                <option value="metasploit">METASPLOIT_LOG</option>
                <option value="burp">BURP_SUITE_HTTP</option>
                <option value="sql">SQL_INJECTION_TEST</option>
              </select>
            </div>
            
            <div className="flex-1 relative">
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="// Paste your code here for deep security analysis..."
                className="w-full h-full bg-transparent p-4 font-mono text-sm text-zinc-300 resize-none outline-none placeholder:text-zinc-600"
                spellCheck={false}
              />
              {isScanning && (
                <div className="absolute inset-0 bg-emerald-500/5 pointer-events-none overflow-hidden">
                  <div className="scan-line" />
                </div>
              )}
            </div>

            <div className="p-4 border-t border-zinc-800 bg-zinc-900/30 flex items-center justify-between">
              <div className="flex items-center gap-4 text-[10px] font-mono text-zinc-500">
                <span className="flex items-center gap-1"><Terminal className="w-3 h-3" /> READY</span>
                <span>{code.length} CHARS</span>
              </div>
              <button
                onClick={handleScan}
                disabled={isScanning || !code.trim()}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#00f2ff] hover:bg-[#00d8e6] disabled:bg-zinc-800 disabled:text-zinc-500 text-black font-bold text-sm transition-all shadow-[0_0_20px_rgba(0,242,255,0.2)]"
              >
                {isScanning ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    ANALYZING...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    INITIALIZE SCAN
                  </>
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3 text-red-400 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p>{error}</p>
            </div>
          )}
        </div>

        {/* Right Column: Results */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {!result && !isScanning && (
            <div className="glass-panel rounded-2xl p-8 flex flex-col items-center justify-center text-center h-full min-h-[400px]">
              <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mb-6">
                <Shield className="w-8 h-8 text-zinc-500" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Awaiting Analysis</h3>
              <p className="text-zinc-400 text-sm max-w-xs">
                Paste your code and click "Start Scan" to begin a comprehensive security and bug audit.
              </p>
            </div>
          )}

          {isScanning && (
            <div className="glass-panel rounded-2xl p-8 flex flex-col items-center justify-center text-center h-full min-h-[400px]">
              <div className="relative mb-8">
                <div className="w-20 h-20 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 animate-spin" />
                <Shield className="w-8 h-8 text-emerald-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Scanning Engine Active</h3>
              <p className="text-zinc-400 text-sm max-w-xs animate-pulse">
                Gemini 3.1 Pro is auditing your code for vulnerabilities, logic errors, and performance leaks...
              </p>
            </div>
          )}

          {result && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col gap-4 h-full"
            >
              {/* Score Card */}
              <div className="glass-panel rounded-2xl p-6 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-mono text-zinc-500 uppercase tracking-widest mb-1">Security Score</h3>
                  <div className="flex items-baseline gap-2">
                    <span className={`text-4xl font-bold ${result.score > 80 ? 'text-emerald-500' : result.score > 50 ? 'text-yellow-500' : 'text-red-500'}`}>
                      {result.score}
                    </span>
                    <span className="text-zinc-500 text-sm">/ 100</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <button
                    onClick={handleFixAll}
                    disabled={isFixing || result.vulnerabilities.length === 0}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#00f2ff]/10 hover:bg-[#00f2ff]/20 text-[#00f2ff] text-[10px] font-bold border border-[#00f2ff]/20 transition-all disabled:opacity-50"
                  >
                    {isFixing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                    AUTO-REMEDIATE ALL
                  </button>
                  <span className="text-[10px] font-mono text-zinc-400 uppercase">
                    {result.vulnerabilities.length} Issues Detected
                  </span>
                </div>
              </div>

              {/* Issues List */}
              <div className="glass-panel rounded-2xl flex-1 flex flex-col overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900/30">
                  <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Vulnerability Feed</h3>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-2 max-h-[500px]">
                  {result.vulnerabilities.map((v, i) => {
                    const Icon = TYPE_ICONS[v.type];
                    return (
                      <button
                        key={i}
                        onClick={() => setSelectedIssue(v)}
                        className={`w-full text-left p-3 rounded-xl border transition-all flex items-start gap-3 ${
                          selectedIssue === v 
                            ? 'bg-zinc-800 border-zinc-700 shadow-lg' 
                            : 'bg-transparent border-transparent hover:bg-zinc-800/50'
                        }`}
                      >
                        <div className={`p-2 rounded-lg border ${SEVERITY_COLORS[v.severity]}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-white truncate">{v.title}</span>
                            <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border uppercase ${SEVERITY_COLORS[v.severity]}`}>
                              {v.severity}
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-500 line-clamp-1">{v.description}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-zinc-700 shrink-0 mt-2" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </main>

      {/* Issue Detail Modal/Overlay */}
      <AnimatePresence>
        {selectedIssue && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setSelectedIssue(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-panel rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className={`h-2 w-full ${SEVERITY_COLORS[selectedIssue.severity].split(' ')[1]}`} />
              
              <div className="p-8">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-2xl border ${SEVERITY_COLORS[selectedIssue.severity]}`}>
                      {React.createElement(TYPE_ICONS[selectedIssue.type], { className: "w-6 h-6" })}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase ${SEVERITY_COLORS[selectedIssue.severity]}`}>
                          {selectedIssue.severity}
                        </span>
                        <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
                          {selectedIssue.type}
                        </span>
                      </div>
                      <h2 className="text-2xl font-bold text-white">{selectedIssue.title}</h2>
                    </div>
                  </div>
                  <button 
                    onClick={() => setSelectedIssue(null)}
                    className="p-2 hover:bg-zinc-800 rounded-full text-zinc-500 hover:text-white transition-colors"
                  >
                    <AlertCircle className="w-6 h-6 rotate-45" />
                  </button>
                </div>

                <div className="space-y-6">
                  <section>
                    <h4 className="text-xs font-mono text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <Info className="w-3 h-3" /> Description
                    </h4>
                    <p className="text-zinc-300 leading-relaxed">
                      {selectedIssue.description}
                    </p>
                  </section>

                  {selectedIssue.location && (
                    <section>
                      <h4 className="text-xs font-mono text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <Code2 className="w-3 h-3" /> Location
                      </h4>
                      <div className="bg-zinc-950 rounded-xl p-3 border border-zinc-800 font-mono text-xs text-emerald-500">
                        {selectedIssue.location}
                      </div>
                    </section>
                  )}

                  <section>
                    <h4 className="text-xs font-mono text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-2 text-emerald-500">
                      <CheckCircle2 className="w-3 h-3" /> Recommended Fix
                    </h4>
                    <div className="bg-zinc-950 rounded-xl p-4 border border-emerald-500/20 text-zinc-300 text-sm leading-relaxed markdown-body">
                      <Markdown>{selectedIssue.suggestion}</Markdown>
                    </div>
                  </section>
                </div>

                <div className="mt-8 pt-6 border-t border-zinc-800 flex justify-end">
                  <button
                    onClick={() => setSelectedIssue(null)}
                    className="px-6 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-sm transition-all"
                  >
                    Close Report
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CLI Integration Modal */}
      <AnimatePresence>
        {showCliModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setShowCliModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-panel rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <Terminal className="w-6 h-6 text-[#00f2ff]" />
                    <h2 className="text-2xl font-bold text-white">Kali Linux Integration</h2>
                  </div>
                  <button onClick={() => setShowCliModal(false)} className="text-zinc-500 hover:text-white">
                    <AlertCircle className="w-6 h-6 rotate-45" />
                  </button>
                </div>

                <p className="text-zinc-400 text-sm mb-6">
                  Deploy Pattar Bug Hunter as a native tool on your Kali machine. Run the following command to install the CLI bridge.
                </p>

                <div className="bg-zinc-950 rounded-xl p-4 border border-zinc-800 mb-6 font-mono text-[11px] text-[#00f2ff] relative group">
                  <code>curl -sSL {window.location.origin}/setup.sh | bash</code>
                  <button 
                    onClick={() => navigator.clipboard.writeText(`curl -sSL ${window.location.origin}/setup.sh | bash`)}
                    className="absolute top-4 right-4 px-3 py-1 bg-zinc-800 rounded text-[10px] font-bold text-zinc-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    COPY
                  </button>
                </div>

                <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">Manual Script (sentinel.py)</h4>

                <div className="bg-zinc-950 rounded-xl p-4 border border-zinc-800 mb-6 relative group">
                  <pre className="text-[11px] font-mono text-zinc-300 overflow-x-auto max-h-[300px]">
                    {cliScript}
                  </pre>
                  <button 
                    onClick={() => navigator.clipboard.writeText(cliScript)}
                    className="absolute top-4 right-4 px-3 py-1 bg-zinc-800 rounded text-[10px] font-bold text-zinc-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    COPY SCRIPT
                  </button>
                </div>

                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Usage Examples</h4>
                  <div className="grid grid-cols-1 gap-2">
                    <div className="bg-zinc-900 p-3 rounded-lg border border-zinc-800 font-mono text-[11px]">
                      <span className="text-zinc-500"># Scan a local file</span>
                      <br />
                      <span className="text-emerald-500">cat server.js | python3 sentinel.py javascript</span>
                    </div>
                    <div className="bg-zinc-900 p-3 rounded-lg border border-zinc-800 font-mono text-[11px]">
                      <span className="text-zinc-500"># Scan terminal history for leaks</span>
                      <br />
                      <span className="text-emerald-500">history | tail -n 50 | python3 sentinel.py terminal</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="border-t border-zinc-800 bg-zinc-900/30 py-4">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
            <span>&copy; 2026 Pattar Bug Hunter Systems</span>
            <span className="hidden md:inline">•</span>
            <span>Encrypted Connection</span>
          </div>
          <div className="flex items-center gap-6">
            {updateAvailable && (
              <button 
                onClick={() => window.location.reload()}
                className="flex items-center gap-2 px-2 py-1 rounded bg-[#00f2ff]/10 text-[#00f2ff] text-[10px] font-bold border border-[#00f2ff]/20 animate-bounce"
              >
                <RefreshCw className="w-3 h-3" />
                UPDATE AVAILABLE
              </button>
            )}
            <div className="flex items-center gap-2">
              {isOnline ? (
                <>
                  <Wifi className="w-3 h-3 text-emerald-500" />
                  <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-tighter">Online</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3 text-red-500" />
                  <span className="text-[10px] font-mono text-red-500 uppercase tracking-tighter">Offline Mode</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#00f2ff] animate-pulse" />
              <span className="text-[10px] font-mono text-zinc-400 uppercase">Engine Status: Optimal</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-[10px] font-mono text-zinc-400 uppercase">
                {isOnline ? 'Gemini 3.1 Pro Connected' : 'Local Heuristics Active'}
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

