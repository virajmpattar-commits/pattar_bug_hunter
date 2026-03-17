import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface ScanResult {
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  type: 'security' | 'bug' | 'performance' | 'best-practice';
  title: string;
  description: string;
  location?: string;
  suggestion: string;
}

export interface AuditResponse {
  summary: string;
  vulnerabilities: ScanResult[];
  score: number; // 0-100
}

export async function analyzeCode(code: string, language: string): Promise<AuditResponse> {
  let promptContext = `Analyze the following ${language} code for bugs, security vulnerabilities, and suspicious patterns.`;
  
  if (language === 'terminal') {
    promptContext = "Analyze these terminal logs/output for security risks, exposed credentials, and signs of compromise.";
  } else if (language === 'nmap') {
    promptContext = "Analyze this Nmap scan output. Identify open ports, service vulnerabilities, and suggest potential exploit vectors or hardening steps.";
  } else if (language === 'metasploit') {
    promptContext = "Analyze this Metasploit output/log. Identify successful exploits, failed attempts, and suggest next steps for post-exploitation or remediation.";
  } else if (language === 'burp') {
    promptContext = "Analyze this Burp Suite HTTP history/request. Look for IDOR, XSS, SQLi, and other web vulnerabilities.";
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: `${promptContext}
      Focus on identifying critical security flaws and providing actionable remediation steps.
      Provide a structured JSON response.
      
      Content to analyze:
      \`\`\`${language}
      ${code}
      \`\`\``,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            score: { type: Type.NUMBER },
            vulnerabilities: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  severity: { type: Type.STRING, enum: ['critical', 'high', 'medium', 'low', 'info'] },
                  type: { type: Type.STRING, enum: ['security', 'bug', 'performance', 'best-practice'] },
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  location: { type: Type.STRING },
                  suggestion: { type: Type.STRING }
                },
                required: ['severity', 'type', 'title', 'description', 'suggestion']
              }
            }
          },
          required: ['summary', 'score', 'vulnerabilities']
        },
        systemInstruction: language === 'terminal' 
          ? "You are an expert SOC analyst and forensics investigator. Analyze terminal logs for security risks, exposed credentials, and malicious activity."
          : "You are a world-class security researcher and senior software engineer. Your goal is to find deep logic bugs, security flaws, and performance bottlenecks. Be precise and provide actionable fixes."
      }
    });

    if (!response.text) {
      throw new Error("GEMINI_EMPTY_RESPONSE: The model returned an empty response. This might be due to safety filters.");
    }

    return JSON.parse(response.text);
  } catch (e: any) {
    console.error("Gemini Analysis Error:", e);
    
    if (e.message?.includes("API_KEY_INVALID") || e.message?.includes("API key not valid")) {
      throw new Error("GEMINI_INVALID_KEY: The provided API key is invalid. Please check your settings.");
    }
    if (e.message?.includes("429") || e.message?.includes("quota")) {
      throw new Error("GEMINI_QUOTA_EXCEEDED: API quota exceeded. Please try again later.");
    }
    if (e.message?.includes("safety") || e.message?.includes("blocked")) {
      throw new Error("GEMINI_SAFETY_BLOCK: The request was blocked by safety filters. The content might be too sensitive.");
    }
    if (e instanceof SyntaxError) {
      throw new Error("GEMINI_PARSE_ERROR: Failed to parse the engine's response. Please try again.");
    }
    
    throw new Error(e.message || "GEMINI_UNKNOWN_ERROR: An unexpected error occurred during analysis.");
  }
}

export async function fixCode(code: string, language: string, vulnerabilities: ScanResult[]): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: `Apply all the suggested fixes for the following vulnerabilities to the provided ${language} code. 
      Return ONLY the fixed code without any markdown formatting or explanations.
      
      Vulnerabilities to fix:
      ${JSON.stringify(vulnerabilities.map(v => ({ title: v.title, suggestion: v.suggestion })))}
      
      Original Code:
      ${code}`,
      config: {
        systemInstruction: "You are a senior software engineer. Your task is to apply security and bug fixes to code. Return only the corrected code. Do not include markdown code blocks."
      }
    });

    return response.text || code;
  } catch (e: any) {
    console.error("Gemini Fix Error:", e);
    throw new Error(e.message || "Failed to apply fixes.");
  }
}
