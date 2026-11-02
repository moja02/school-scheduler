import os
import sys

# Ensure workspace root is in sys.path
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from src.api.app import app

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8000, debug=True)
