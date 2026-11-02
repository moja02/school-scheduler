import json
import sys
from ortools.sat.python import cp_model

DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu"]
NUM_DAYS = len(DAYS)
NUM_SLOTS = 7

def generate_schedule(input_data):
    teachers = input_data.get("teachers", [])
    requirements = input_data.get("requirements", [])

    model = cp_model.CpModel()

    # Parsed Data
    teacher_unwanted = {}
    for t in teachers:
        t_name = t["name"]
        unwanted = t.get("unwanted_slots", [])
        teacher_unwanted[t_name] = set((u["day"], u["slot"]) for u in unwanted)
    
    # Index requirements
    req_dict = {}
    for i, r in enumerate(requirements):
        req_dict[i] = r
    
    # x[(req_id, d, sl)] = 1 if req_id is scheduled on day d at slot sl
    x = {}
    for req_id, req in req_dict.items():
        for d in range(NUM_DAYS):
            for sl in range(1, NUM_SLOTS + 1):
                x[(req_id, d, sl)] = model.NewBoolVar(f'x_req{req_id}_d{d}_s{sl}')

    # 1. Hard Constraints
    
    # 1.a. Exact number of sessions
    for req_id, req in req_dict.items():
        model.Add(sum(x[(req_id, d, sl)] for d in range(NUM_DAYS) for sl in range(1, NUM_SLOTS + 1)) == req["sessions"])
    
    # 1.b. Teacher conflict: teacher at most 1 class per time slot
    teacher_to_reqs = {}
    for req_id, req in req_dict.items():
        t = req["teacher"]
        if t not in teacher_to_reqs:
            teacher_to_reqs[t] = []
        teacher_to_reqs[t].append(req_id)
        
    for t, reqs in teacher_to_reqs.items():
        for d in range(NUM_DAYS):
            for sl in range(1, NUM_SLOTS + 1):
                model.AddAtMostOne(x[(req_id, d, sl)] for req_id in reqs)

    # 1.c. Class conflict: class at most 1 subject per time slot
    class_to_reqs = {}
    for req_id, req in req_dict.items():
        c = req["class"]
        if c not in class_to_reqs:
            class_to_reqs[c] = []
        class_to_reqs[c].append(req_id)
        
    for c, reqs in class_to_reqs.items():
        for d in range(NUM_DAYS):
            for sl in range(1, NUM_SLOTS + 1):
                model.AddAtMostOne(x[(req_id, d, sl)] for req_id in reqs)
                
    # 1.d. Spread constraint:
    # If sessions <= 5: max 1 session per day per class per subject
    # If sessions > 5: max 2 sessions per day
    for req_id, req in req_dict.items():
        limit = 1 if req["sessions"] <= 5 else 2
        for d in range(NUM_DAYS):
            model.Add(sum(x[(req_id, d, sl)] for sl in range(1, NUM_SLOTS + 1)) <= limit)

    # 2. Soft Constraints & Objective Function
    objective_terms = []
    
    # 2.a. Teacher Preferences
    for req_id, req in req_dict.items():
        t = req["teacher"]
        unwanted_set = teacher_unwanted.get(t, set())
        for d in range(NUM_DAYS):
            day_str = DAYS[d]
            for sl in range(1, NUM_SLOTS + 1):
                if (day_str, sl) in unwanted_set:
                    # Penalize strongly
                    objective_terms.append(x[(req_id, d, sl)] * -10000)
                else:
                    # Normal slot reward
                    objective_terms.append(x[(req_id, d, sl)] * 10)

    # 2.b. Consecutive sessions for teachers
    for t, reqs in teacher_to_reqs.items():
        for d in range(NUM_DAYS):
            for sl in range(1, NUM_SLOTS):
                active_sl = model.NewBoolVar(f'active_{t}_d{d}_s{sl}')
                model.Add(sum(x[(req_id, d, sl)] for req_id in reqs) == active_sl)
                
                active_sl_next = model.NewBoolVar(f'active_{t}_d{d}_s{sl+1}')
                model.Add(sum(x[(req_id, d, sl+1)] for req_id in reqs) == active_sl_next)
                
                consecutive = model.NewBoolVar(f'consec_{t}_d{d}_s{sl}')
                model.Add(consecutive <= active_sl)
                model.Add(consecutive <= active_sl_next)
                model.Add(consecutive >= active_sl + active_sl_next - 1)
                
                objective_terms.append(consecutive * 50)
                
    # Maximize objective
    model.Maximize(sum(objective_terms))
    
    # Solve
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 25.0
    status = solver.Solve(model)
    
    if status == cp_model.OPTIMAL or status == cp_model.FEASIBLE:
        schedule = []
        for req_id, req in req_dict.items():
            for d in range(NUM_DAYS):
                for sl in range(1, NUM_SLOTS + 1):
                    if solver.Value(x[(req_id, d, sl)]):
                        schedule.append({
                            "class": req["class"],
                            "subject": req["subject"],
                            "teacher": req["teacher"],
                            "day": DAYS[d],
                            "slot": sl
                        })
        return {"schedule": schedule}
    else:
        return {"error": "فشل إنشاء الجدول. إجمالي عدد الحصص المطلوبة أو القيود تمنع إيجاد حل ممكن."}

if __name__ == "__main__":
    input_file = "input.json"
    output_file = "output.json"
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
