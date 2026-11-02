from flask import Flask, request, jsonify, send_from_directory
import json
import os
import sys
import datetime

# إضافة المجلد الرئيسي للمشروع لمسار النظام لضمان الاستيراد السليم
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from src.core.scheduler import generate_schedule

STATIC_DIR = os.path.join(PROJECT_ROOT, "static")
DATA_DIR = os.path.join(PROJECT_ROOT, "data")
DATA_FILE = os.path.join(DATA_DIR, "data.json")
OUTPUT_DIR = os.path.join(PROJECT_ROOT, "output")

app = Flask(__name__, static_folder=STATIC_DIR)

def load_data():
    default_structure = {
        "primary": [
            {"name": "الصف الأول", "active": False, "sections": []},
            {"name": "الصف الثاني", "active": False, "sections": []},
            {"name": "الصف الثالث", "active": False, "sections": []},
            {"name": "الصف الرابع", "active": False, "sections": []},
            {"name": "الصف الخامس", "active": False, "sections": []},
            {"name": "الصف السادس", "active": False, "sections": []}
        ],
        "preparatory": [
            {"name": "الصف الأول إعدادي", "active": False, "sections": []},
            {"name": "الصف الثاني إعدادي", "active": False, "sections": []},
            {"name": "الصف الثالث إعدادي", "active": False, "sections": []}
        ],
        "secondary": [
            {"name": "الصف الأول ثانوي", "active": False, "sections": []},
            {"name": "الصف الثاني ثانوي - علمي", "active": False, "sections": []},
            {"name": "الصف الثاني ثانوي - أدبي", "active": False, "sections": []},
            {"name": "الصف الثالث ثانوي - علمي", "active": False, "sections": []},
            {"name": "الصف الثالث ثانوي - أدبي", "active": False, "sections": []}
        ]
    }
    
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                if "grades" not in data:
                    data["grades"] = []
                if "school_structure" not in data:
                    data["school_structure"] = default_structure
                return data
        except Exception:
            pass
    return {"school_structure": default_structure, "grades": [], "teachers": [], "requirements": []}

def save_data(data):
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=4)

@app.route('/api/data', methods=['GET'])
def get_data():
    return jsonify(load_data())

@app.route('/api/data', methods=['POST'])
def update_data():
    data = request.json
    save_data(data)
    return jsonify({"status": "success"})

@app.route('/api/generate', methods=['POST'])
def api_generate_schedule():
    data = request.json if request.is_json and request.json else load_data()
    result = generate_schedule(data)
    
    if "error" not in result:
        os.makedirs(OUTPUT_DIR, exist_ok=True)
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        filename = f"schedule_{timestamp}.json"
        filepath = os.path.join(OUTPUT_DIR, filename)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False, indent=4)
            
        result["filename"] = filename
        
    return jsonify(result)

@app.route('/api/schedules', methods=['GET'])
def get_schedules_list():
    if not os.path.exists(OUTPUT_DIR):
        return jsonify([])
    
    files = [f for f in os.listdir(OUTPUT_DIR) if f.endswith('.json')]
    files.sort(reverse=True)
    return jsonify(files)

@app.route('/api/schedules/<filename>', methods=['GET'])
def get_schedule(filename):
    filepath = os.path.join(OUTPUT_DIR, filename)
    if os.path.exists(filepath):
        with open(filepath, 'r', encoding='utf-8') as f:
            return jsonify(json.load(f))
    return jsonify({"error": "الملف غير موجود"})

@app.route('/')
def serve_index():
    return send_from_directory(STATIC_DIR, 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory(STATIC_DIR, path)

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8000, debug=True)
