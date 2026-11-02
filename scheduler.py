import os
import sys

PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from src.core.scheduler import generate_schedule

if __name__ == "__main__":
    import json
    input_file = os.path.join(PROJECT_ROOT, "data", "input_debug.json")
    output_file = os.path.join(PROJECT_ROOT, "data", "output_debug.json")
    if len(sys.argv) > 1:
        input_file = sys.argv[1]
    if len(sys.argv) > 2:
        output_file = sys.argv[2]
        
    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
        result = generate_schedule(data)
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False, indent=4)
            
        print("Done. Output saved to", output_file)
    except FileNotFoundError:
        print(f"Error: Could not find {input_file}")
    except Exception as e:
        print(f"Error: {str(e)}")
