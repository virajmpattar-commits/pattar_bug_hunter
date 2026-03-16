#!/bin/bash

# Pattar Bug Hunter - Kali Linux Installation Script
# This script installs the Pattar Bug Hunter CLI bridge on your Kali machine.

echo -e "\e[1;34m[*] Initializing Pattar Bug Hunter CLI Setup...\e[0m"

# Check for python3
if ! command -v python3 &> /dev/null; then
    echo -e "\e[1;31m[!] Python3 is not installed. Please install it with: sudo apt install python3\e[0m"
    exit 1
fi

# Check for requests library
if ! python3 -c "import requests" &> /dev/null; then
    echo -e "\e[1;33m[*] Installing 'requests' library...\e[0m"
    pip3 install requests --quiet
fi

# Create the script
cat << 'EOF' > /usr/local/bin/pattar
#!/usr/bin/env python3
import os
import sys
import json
import requests

# Pattar Bug Hunter CLI Bridge
API_KEY = "YOUR_GEMINI_API_KEY" # Replace with your key if not in ENV

def analyze():
    lang = sys.argv[1] if len(sys.argv) > 1 else "terminal"
    code = sys.stdin.read()
    
    if not code.strip():
        print("Error: No input provided via stdin.")
        return

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent?key={API_KEY}"
    payload = {
        "contents": [{
            "parts": [{"text": f"Analyze this {lang} code for vulnerabilities. Return JSON with 'summary', 'score', and 'vulnerabilities' list.\\n\\n{code}"}]
        }],
        "generationConfig": {
            "responseMimeType": "application/json"
        }
    }
    
    try:
        response = requests.post(url, json=payload)
        print(json.dumps(response.json(), indent=2))
    except Exception as e:
        print(f"Error connecting to Pattar Engine: {e}")

if __name__ == "__main__":
    analyze()
EOF

# Make it executable
sudo chmod +x /usr/local/bin/pattar

echo -e "\e[1;32m[+] Installation Complete!\e[0m"
echo -e "\e[1;34m[*] You can now use 'pattar' command to scan logs and code.\e[0m"
echo -e "\e[1;34m[*] Example: history | tail -n 50 | pattar terminal\e[0m"
