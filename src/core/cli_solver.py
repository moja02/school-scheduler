import sys
import json
import os

# Ensure project root is in sys.path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from src.core.scheduler import generate_schedule

def main():
    try:
        # Read JSON from stdin
        if sys.version_info >= (3, 0):
            import io
            sys.stdin = io.TextIOWrapper(sys.stdin.buffer, encoding='utf-8')
            sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
            
        raw_input = sys.stdin.read()
        if not raw_input.strip():
            print(json.dumps({"error": "No input data provided"}, ensure_ascii=False))
            return
            
        data = json.loads(raw_input)
        result = generate_schedule(data)
        print(json.dumps(result, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"error": f"Solver error: {str(e)}"}, ensure_ascii=False))

if __name__ == "__main__":
    main()
