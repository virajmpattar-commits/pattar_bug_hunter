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

    # In a real scenario, this might send data to an API.
    # For this portable version, it generates a JSON blob that can be 
    # pasted into the Pattar "Import" field.
    
    payload = {
        "source": "CLI_SENTINEL",
        "context": context,
        "data": content,
        "timestamp": "2026-03-16T16:04:17Z"
    }

    print("\n--- PATTAR SENTINEL PAYLOAD GENERATED ---")
    print(json.dumps(payload, indent=2))
    print("--- COPY ABOVE BLOB INTO PATTAR IMPORT FIELD ---")

if __name__ == "__main__":
    main()
