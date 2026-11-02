from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
import json
import os
import sys
import datetime

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from src.core.scheduler import generate_schedule

app = FastAPI()

STATIC_DIR = os.path.join(PROJECT_ROOT, "static")
DATA_DIR = os.path.join(PROJECT_ROOT, "data")
DATA_FILE = os.path.join(DATA_DIR, "data.json")
OUTPUT_DIR = os.path.join(PROJECT_ROOT, "output")

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
            return {"school_structure": default_structure, "grades": [], "teachers": [], "requirements": []}
    return {"school_structure": default_structure, "grades": [], "teachers": [], "requirements": []}

def save_data(data):
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=4)

@app.get("/api/data")
def get_data():
    return load_data()

@app.post("/api/data")
async def update_data(request: Request):
    data = await request.json()
    save_data(data)
    return {"status": "success"}

@app.post("/api/generate")
async def api_generate_schedule():
    data = load_data()
    result = generate_schedule(data)
    
    if "error" not in result:
        os.makedirs(OUTPUT_DIR, exist_ok=True)
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        filename = f"schedule_{timestamp}.json"
        filepath = os.path.join(OUTPUT_DIR, filename)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False, indent=4)
            
        result["filename"] = filename
        
    return result

@app.get("/api/schedules")
def get_schedules_list():
    if not os.path.exists(OUTPUT_DIR):
        return []
    
    files = [f for f in os.listdir(OUTPUT_DIR) if f.endswith('.json')]
    files.sort(reverse=True)
    return files

@app.get("/api/schedules/{filename}")
def get_schedule(filename: str):
    filepath = os.path.join(OUTPUT_DIR, filename)
    if os.path.exists(filepath):
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {"error": "الملف غير موجود"}

app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("src.api.server:app", host="127.0.0.1", port=8000, reload=True)
