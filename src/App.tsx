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
  RefreshCw,
  Github,
  Folder,
  File,
  LogOut,
  ChevronLeft
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

const cliScript = `#!/usr/bin/env python3
import sys
import json
import os

def main():
    """
    Pattar Sentinel - CLI Bridge
    Pipes terminal output or file content into a format compatible with Pattar Bug Hunter.
    """
    if len(sys.argv) < 2:
        print("Usage: cat file.js | python3 sentinel.py [language/context]")
        sys.exit(1)

    context = sys.argv[1]
    content = sys.stdin.read()

    if not content.strip():
        print("Error: No input received from stdin.")
        sys.exit(1)

    payload = {
        "source": "CLI_SENTINEL",
        "context": context,
        "data": content,
        "timestamp": "2026-03-16T16:04:17Z"
    }

    print("\\n--- PATTAR SENTINEL PAYLOAD GENERATED ---")
    print(json.dumps(payload, indent=2))
    print("--- COPY ABOVE BLOB INTO PATTAR IMPORT FIELD ---")

if __name__ == "__main__":
    main()
`;

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
  
  // GitHub State
  const [isGithubAuthenticated, setIsGithubAuthenticated] = useState(false);
  const [repos, setRepos] = useState<any[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<any | null>(null);
  const [repoContents, setRepoContents] = useState<any[]>([]);
  const [currentPath, setCurrentPath] = useState('');
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  const [isLoadingContents, setIsLoadingContents] = useState(false);
  const [showRepoBrowser, setShowRepoBrowser] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check GitHub Auth Status
    checkGithubAuth();

    // Listen for OAuth success
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'GITHUB_AUTH_SUCCESS') {
        setIsGithubAuthenticated(true);
        fetchRepos();
      }
    };
    window.addEventListener('message', handleMessage);

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
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  const checkGithubAuth = async () => {
    try {
      const res = await fetch('/api/auth/github/status');
      const data = await res.json();
      setIsGithubAuthenticated(data.isAuthenticated);
      if (data.isAuthenticated) {
        fetchRepos();
      }
    } catch (err) {
      console.error("Failed to check GitHub auth", err);
    }
  };

  const handleGithubConnect = async () => {
    try {
      const res = await fetch('/api/auth/github/url');
      const { url } = await res.json();
      window.open(url, 'github_auth', 'width=600,height=700');
    } catch (err) {
      setError("Failed to initiate GitHub connection");
    }
  };

  const handleGithubLogout = async () => {
    try {
      await fetch('/api/auth/github/logout', { method: 'POST' });
      setIsGithubAuthenticated(false);
      setRepos([]);
      setSelectedRepo(null);
      setShowRepoBrowser(false);
    } catch (err) {
      console.error("Logout failed", err);
    }
  };

  const fetchRepos = async () => {
    setIsLoadingRepos(true);
    try {
      const res = await fetch('/api/github/repos');
      const data = await res.json();
      setRepos(data);
    } catch (err) {
      setError("Failed to fetch repositories");
    } finally {
      setIsLoadingRepos(false);
    }
  };

  const fetchContents = async (owner: string, repo: string, path: string = '') => {
    setIsLoadingContents(true);
    try {
      const res = await fetch(`/api/github/repos/${owner}/${repo}/contents?path=${path}`);
      const data = await res.json();
      setRepoContents(Array.isArray(data) ? data : []);
      setCurrentPath(path);
    } catch (err) {
      setError("Failed to fetch repository contents");
    } finally {
      setIsLoadingContents(false);
    }
  };

  const handleFileSelect = async (file: any) => {
    if (file.type === 'dir') {
      fetchContents(selectedRepo.owner.login, selectedRepo.name, file.path);
    } else {
      setIsScanning(true);
      try {
        const res = await fetch(`/api/github/repos/${selectedRepo.owner.login}/${selectedRepo.name}/file?path=${file.path}`);
        const content = await res.text();
        setCode(content);
        // Auto-detect language from extension
        const ext = file.name.split('.').pop();
        const langMap: any = { js: 'javascript', ts: 'javascript', py: 'python', sql: 'sql' };
        setLanguage(langMap[ext] || 'javascript');
        setShowRepoBrowser(false);
      } catch (err) {
        setError("Failed to fetch file content");
      } finally {
        setIsScanning(false);
      }
    }
  };

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

  const getErrorDetails = (errMessage: string) => {
    if (errMessage.includes('GEMINI_INVALID_KEY')) {
      return {
        title: 'Invalid API Key',
        message: 'The provided Gemini API key is incorrect or has expired. Please update it in your environment settings.',
        icon: ShieldAlert,
        color: 'text-red-400 border-red-500/20 bg-red-500/10'
      };
    }
    if (errMessage.includes('GEMINI_QUOTA_EXCEEDED')) {
      return {
        title: 'Quota Exceeded',
        message: 'You have reached the rate limit for the Gemini API. Please wait a few minutes before trying again.',
        icon: Zap,
        color: 'text-orange-400 border-orange-500/20 bg-orange-500/10'
      };
    }
    if (errMessage.includes('GEMINI_SAFETY_BLOCK')) {
      return {
        title: 'Safety Block',
        message: 'The engine refused to analyze this content due to safety policy restrictions. Try a less sensitive snippet.',
        icon: Shield,
        color: 'text-yellow-400 border-yellow-500/20 bg-yellow-500/10'
      };
    }
    if (errMessage.includes('GEMINI_PARSE_ERROR')) {
      return {
        title: 'Engine Desync',
        message: 'The AI returned a malformed response. This usually happens with extremely complex or obfuscated code.',
        icon: Bug,
        color: 'text-zinc-400 border-zinc-500/20 bg-zinc-500/10'
      };
    }
    return {
      title: 'Analysis Failed',
      message: errMessage.replace(/GEMINI_[A-Z_]+: /, '') || 'An unexpected error occurred during the security audit.',
      icon: AlertCircle,
      color: 'text-red-400 border-red-500/20 bg-red-500/10'
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
              {isGithubAuthenticated ? (
                <button 
                  onClick={() => setShowRepoBrowser(true)}
                  className="flex items-center gap-2 hover:text-[#00f2ff] transition-colors text-[#00f2ff]"
                >
                  <Github className="w-4 h-4" />
                  Browse Repos
                </button>
              ) : (
                <button 
                  onClick={handleGithubConnect}
                  className="flex items-center gap-2 hover:text-white transition-colors"
                >
                  <Github className="w-4 h-4" />
                  Connect GitHub
                </button>
              )}
              <button 
                onClick={handleDownloadPortable}
                className="flex items-center gap-2 hover:text-[#00f2ff] transition-colors"
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
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className={`p-4 rounded-xl border flex items-start gap-3 ${getErrorDetails(error).color}`}
            >
              {React.createElement(getErrorDetails(error).icon, { className: "w-5 h-5 shrink-0" })}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider mb-1">{getErrorDetails(error).title}</h4>
                <p className="text-xs opacity-80 leading-relaxed">{getErrorDetails(error).message}</p>
              </div>
            </motion.div>
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

              {/* Issues List or Details Pane */}
              <div className="glass-panel rounded-2xl flex-1 flex flex-col overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900/30 flex items-center justify-between">
                  <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                    {selectedIssue ? 'Vulnerability Details' : 'Vulnerability Feed'}
                  </h3>
                  {selectedIssue && (
                    <button 
                      onClick={() => setSelectedIssue(null)}
                      className="text-[10px] font-mono text-[#00f2ff] hover:underline flex items-center gap-1 uppercase"
                    >
                      <ChevronLeft className="w-3 h-3" /> Back to Feed
                    </button>
                  )}
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                  <AnimatePresence mode="wait">
                    {!selectedIssue ? (
                      <motion.div
                        key="feed"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-2"
                      >
                        {result.vulnerabilities.map((v, i) => {
                          const Icon = TYPE_ICONS[v.type];
                          return (
                            <button
                              key={i}
                              onClick={() => setSelectedIssue(v)}
                              className="w-full text-left p-3 rounded-xl border border-transparent hover:bg-zinc-800/50 transition-all flex items-start gap-3 group"
                            >
                              <div className={`p-2 rounded-lg border ${SEVERITY_COLORS[v.severity]}`}>
                                <Icon className="w-4 h-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs font-bold text-white truncate group-hover:text-[#00f2ff] transition-colors">{v.title}</span>
                                  <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border uppercase ${SEVERITY_COLORS[v.severity]}`}>
                                    {v.severity}
                                  </span>
                                </div>
                                <p className="text-[11px] text-zinc-500 line-clamp-1">{v.description}</p>
                              </div>
                              <ChevronRight className="w-4 h-4 text-zinc-700 shrink-0 mt-2 group-hover:text-[#00f2ff] transition-all" />
                            </button>
                          );
                        })}
                      </motion.div>
                    ) : (
                      <motion.div
                        key="details"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-6"
                      >
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
                            <h2 className="text-lg font-bold text-white leading-tight">{selectedIssue.title}</h2>
                          </div>
                        </div>

                        <div className="space-y-5">
                          <section>
                            <h4 className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                              <Info className="w-3 h-3" /> Description
                            </h4>
                            <p className="text-xs text-zinc-300 leading-relaxed">
                              {selectedIssue.description}
                            </p>
                          </section>

                          {selectedIssue.location && (
                            <section>
                              <h4 className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                                <Code2 className="w-3 h-3" /> Location
                              </h4>
                              <div className="bg-zinc-950 rounded-lg p-2 border border-zinc-800 font-mono text-[10px] text-emerald-500 break-all">
                                {selectedIssue.location}
                              </div>
                            </section>
                          )}

                          <section>
                            <h4 className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-2 flex items-center gap-2 text-[#00f2ff]">
                              <CheckCircle2 className="w-3 h-3" /> Recommended Fix
                            </h4>
                            <div className="bg-zinc-950 rounded-lg p-3 border border-[#00f2ff]/10 text-xs text-zinc-300 leading-relaxed markdown-body">
                              <Markdown>{selectedIssue.suggestion}</Markdown>
                            </div>
                          </section>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </main>

      {/* GitHub Repo Browser Modal */}
      <AnimatePresence>
        {showRepoBrowser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setShowRepoBrowser(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-panel rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Github className="w-6 h-6 text-[#00f2ff]" />
                  <h2 className="text-xl font-bold text-white">GitHub Repository Analysis</h2>
                </div>
                <div className="flex items-center gap-4">
                  <button 
                    onClick={handleGithubLogout}
                    className="text-[10px] font-mono text-zinc-500 hover:text-red-400 flex items-center gap-1 uppercase"
                  >
                    <LogOut className="w-3 h-3" /> Logout
                  </button>
                  <button onClick={() => setShowRepoBrowser(false)} className="text-zinc-500 hover:text-white">
                    <AlertCircle className="w-6 h-6 rotate-45" />
                  </button>
                </div>
              </div>

              <div className="flex-1 flex overflow-hidden">
                {/* Repos Sidebar */}
                <div className="w-1/3 border-r border-zinc-800 overflow-y-auto p-4 space-y-2">
                  <h3 className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-4">Your Repositories</h3>
                  {isLoadingRepos ? (
                    <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-zinc-600" /></div>
                  ) : (
                    repos.map(repo => (
                      <button
                        key={repo.id}
                        onClick={() => {
                          setSelectedRepo(repo);
                          fetchContents(repo.owner.login, repo.name);
                        }}
                        className={`w-full text-left p-3 rounded-xl border transition-all ${
                          selectedRepo?.id === repo.id 
                            ? 'bg-[#00f2ff]/10 border-[#00f2ff]/20 text-[#00f2ff]' 
                            : 'bg-transparent border-transparent hover:bg-zinc-800/50 text-zinc-400'
                        }`}
                      >
                        <div className="text-xs font-bold truncate">{repo.name}</div>
                        <div className="text-[9px] opacity-60 truncate">{repo.description || 'No description'}</div>
                      </button>
                    ))
                  )}
                </div>

                {/* File Browser */}
                <div className="flex-1 overflow-y-auto p-6">
                  {selectedRepo ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {currentPath && (
                            <button 
                              onClick={() => {
                                const parts = currentPath.split('/');
                                parts.pop();
                                fetchContents(selectedRepo.owner.login, selectedRepo.name, parts.join('/'));
                              }}
                              className="p-1 hover:bg-zinc-800 rounded text-zinc-400"
                            >
                              <ChevronLeft className="w-4 h-4" />
                            </button>
                          )}
                          <h4 className="text-sm font-bold text-white truncate max-w-md">
                            {selectedRepo.name} <span className="text-zinc-600 font-mono text-xs">/ {currentPath}</span>
                          </h4>
                        </div>
                      </div>

                      {isLoadingContents ? (
                        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-[#00f2ff]" /></div>
                      ) : (
                        <div className="grid grid-cols-1 gap-1">
                          {repoContents.map(item => (
                            <button
                              key={item.sha}
                              onClick={() => handleFileSelect(item)}
                              className="w-full text-left p-2 rounded-lg hover:bg-zinc-800/50 flex items-center gap-3 group transition-all"
                            >
                              {item.type === 'dir' ? (
                                <Folder className="w-4 h-4 text-yellow-500/60" />
                              ) : (
                                <File className="w-4 h-4 text-blue-500/60" />
                              )}
                              <span className="text-xs text-zinc-300 group-hover:text-white">{item.name}</span>
                              {item.type === 'file' && (
                                <span className="ml-auto text-[9px] font-mono text-zinc-600 opacity-0 group-hover:opacity-100 uppercase">Audit File</span>
                              )}
                            </button>
                          ))}
                          {repoContents.length === 0 && (
                            <div className="text-center py-12 text-zinc-600 text-xs font-mono uppercase">Empty Directory</div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center">
                      <div className="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center mb-4">
                        <Github className="w-8 h-8 text-zinc-700" />
                      </div>
                      <h3 className="text-lg font-bold text-white mb-2">Select a Repository</h3>
                      <p className="text-zinc-500 text-xs max-w-xs">Choose a repository from the sidebar to begin auditing its source code.</p>
                    </div>
                  )}
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

