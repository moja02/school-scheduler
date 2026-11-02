import sys
import json
import os
from PyQt6.QtWidgets import (QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
                             QPushButton, QLabel, QTableWidget, QTableWidgetItem, QTabWidget,
                             QLineEdit, QComboBox, QMessageBox, QHeaderView, QDialog, QCheckBox)
from PyQt6.QtCore import Qt

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from src.core.scheduler import generate_schedule

DATA_DIR = os.path.join(PROJECT_ROOT, "data")
DATA_FILE = os.path.join(DATA_DIR, "data.json")
DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu"]

class TeacherTimesDialog(QDialog):
    def __init__(self, teacher, parent=None):
        super().__init__(parent)
        self.teacher = teacher
        self.setWindowTitle(f"ضبط أوقات المعلم: {teacher['name']}")
        self.resize(800, 400)
        self.setStyleSheet("QDialog { background-color: #f5f6fa; }")
        
        self.layout = QVBoxLayout(self)
        
        title = QLabel(f"ضبط أوقات المعلم: {teacher['name']}\nحدد أيام العطل، والحصص المحظورة التي لا يمكن للمعلم التدريس فيها.")
        title.setStyleSheet("font-size: 16px; font-weight: bold; color: white; background-color: #0984e3; padding: 15px; border-radius: 5px;")
        title.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.layout.addWidget(title)
        
        self.table = QTableWidget()
        self.table.setColumnCount(9)
        self.table.setHorizontalHeaderLabels(["اليوم", "إجازة كاملة", "1", "2", "3", "4", "5", "6", "7"])
        self.table.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Stretch)
        self.table.setRowCount(len(DAYS))
        
        self.checkboxes = {}
        self.full_day_checkboxes = {}
        
        unwanted_set = set((u["day"], u["slot"]) for u in teacher.get("unwanted_slots", []))
        arabic_days = {"Sun": "الأحد", "Mon": "الاثنين", "Tue": "الثلاثاء", "Wed": "الأربعاء", "Thu": "الخميس"}
        
        for row, d in enumerate(DAYS):
            self.table.setItem(row, 0, QTableWidgetItem(arabic_days[d]))
            
            # Full day off checkbox
            full_day_cb = QCheckBox()
            full_day_widget = QWidget()
            fd_layout = QHBoxLayout(full_day_widget)
            fd_layout.addWidget(full_day_cb)
            fd_layout.setAlignment(Qt.AlignmentFlag.AlignCenter)
            fd_layout.setContentsMargins(0,0,0,0)
            self.table.setCellWidget(row, 1, full_day_widget)
            self.full_day_checkboxes[d] = full_day_cb
            
            self.checkboxes[d] = {}
            for slot in range(1, 8):
                cb = QCheckBox()
                if (d, slot) in unwanted_set:
                    cb.setChecked(True)
                
                cb_widget = QWidget()
                cb_layout = QHBoxLayout(cb_widget)
                cb_layout.addWidget(cb)
                cb_layout.setAlignment(Qt.AlignmentFlag.AlignCenter)
                cb_layout.setContentsMargins(0,0,0,0)
                self.table.setCellWidget(row, slot + 1, cb_widget)
                self.checkboxes[d][slot] = cb
                
            full_day_cb.toggled.connect(lambda checked, day=d: self.toggle_day(day, checked))
            
            if all((d, s) in unwanted_set for s in range(1, 8)):
                full_day_cb.setChecked(True)
                
        self.layout.addWidget(self.table)
        
        btn_layout = QHBoxLayout()
        btn_cancel = QPushButton("إلغاء الرجوع")
        btn_cancel.setStyleSheet("background-color: #dcdde1; color: black;")
        btn_cancel.clicked.connect(self.reject)
        
        btn_save = QPushButton("حفظ التفضيلات")
        btn_save.setStyleSheet("background-color: #0984e3;")
        btn_save.clicked.connect(self.save_times)
        
        btn_layout.addWidget(btn_cancel)
        btn_layout.addWidget(btn_save)
        self.layout.addLayout(btn_layout)

    def toggle_day(self, day, checked):
        for slot in range(1, 8):
            self.checkboxes[day][slot].setChecked(checked)
            self.checkboxes[day][slot].setEnabled(not checked)

    def save_times(self):
        new_unwanted = []
        for d in DAYS:
            for slot in range(1, 8):
                if self.checkboxes[d][slot].isChecked():
                    new_unwanted.append({"day": d, "slot": slot})
        self.teacher["unwanted_slots"] = new_unwanted
        self.accept()

class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("نظام الجدولة الذكي - المدارس")
        self.setGeometry(100, 100, 900, 600)
        self.setStyleSheet("""
            QMainWindow { background-color: #f5f6fa; }
            QTabWidget::pane { border: 1px solid #dcdde1; border-radius: 5px; background: white; }
            QTabBar::tab { background: #e1b12c; color: white; padding: 10px 20px; margin: 2px; border-radius: 5px; font-weight: bold; font-size: 14px;}
            QTabBar::tab:selected { background: #e84118; }
            QPushButton { background-color: #0097e6; color: white; padding: 10px; border-radius: 5px; font-weight: bold; font-size: 14px;}
            QPushButton:hover { background-color: #00a8ff; }
            QTableWidget { border: 1px solid #dcdde1; gridline-color: #dcdde1; }
            QHeaderView::section { background-color: #2f3640; color: white; padding: 5px; font-weight: bold; border: 1px solid #353b48;}
            QLabel { font-size: 14px; font-weight: bold; color: #2f3640;}
        """)

        self.teachers_data = []
        self.requirements_data = []
        
        self.load_data()

        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        main_layout = QVBoxLayout(central_widget)

        # Tabs
        self.tabs = QTabWidget()
        main_layout.addWidget(self.tabs)

        self.tab_teachers = QWidget()
        self.tab_requirements = QWidget()
        self.tab_schedule = QWidget()

        self.tabs.addTab(self.tab_teachers, "المعلمين والأوقات المرفوضة")
        self.tabs.addTab(self.tab_requirements, "المتطلبات (الفصول والمواد)")
        self.tabs.addTab(self.tab_schedule, "الجدول النهائي")

        self.setup_teachers_tab()
        self.setup_requirements_tab()
        self.setup_schedule_tab()

    def load_data(self):
        if os.path.exists(DATA_FILE):
            try:
                with open(DATA_FILE, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    self.teachers_data = data.get("teachers", [])
                    self.requirements_data = data.get("requirements", [])
            except Exception:
                pass

    def save_data(self):
        os.makedirs(DATA_DIR, exist_ok=True)
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump({
                "teachers": self.teachers_data,
                "requirements": self.requirements_data
            }, f, ensure_ascii=False, indent=4)

    def setup_teachers_tab(self):
        layout = QVBoxLayout(self.tab_teachers)
        
        # Add Teacher
        add_layout = QHBoxLayout()
        self.teacher_name_input = QLineEdit()
        self.teacher_name_input.setPlaceholderText("اسم المعلم")
        btn_add = QPushButton("إضافة معلم")
        btn_add.clicked.connect(self.add_teacher)
        add_layout.addWidget(QLabel("اسم المعلم:"))
        add_layout.addWidget(self.teacher_name_input)
        add_layout.addWidget(btn_add)
        layout.addLayout(add_layout)

        # Table
        self.teacher_table = QTableWidget()
        self.teacher_table.setColumnCount(3)
        self.teacher_table.setHorizontalHeaderLabels(["المعلم", "الأوقات المرفوضة", "إجراء"])
        self.teacher_table.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Stretch)
        layout.addWidget(self.teacher_table)
        self.refresh_teacher_table()

    def add_teacher(self):
        name = self.teacher_name_input.text().strip()
        if name:
            self.teachers_data.append({"name": name, "unwanted_slots": []})
            self.save_data()
            self.teacher_name_input.clear()
            self.refresh_teacher_table()

    def refresh_teacher_table(self):
        self.teacher_table.setRowCount(len(self.teachers_data))
        for row, teacher in enumerate(self.teachers_data):
            self.teacher_table.setItem(row, 0, QTableWidgetItem(teacher["name"]))
            
            unwanted_count = len(teacher.get("unwanted_slots", []))
            self.teacher_table.setItem(row, 1, QTableWidgetItem(f"{unwanted_count} حصة محظورة"))
            
            actions_layout = QHBoxLayout()
            actions_layout.setContentsMargins(0, 0, 0, 0)
            
            btn_edit = QPushButton("إعداد الأوقات")
            btn_edit.setStyleSheet("background-color: #0984e3; padding: 5px;")
            btn_edit.clicked.connect(lambda _, r=row: self.edit_teacher_times(r))
            
            btn_del = QPushButton("حذف")
            btn_del.setStyleSheet("background-color: #e84118; padding: 5px;")
            btn_del.clicked.connect(lambda _, r=row: self.delete_teacher(r))
            
            actions_layout.addWidget(btn_edit)
            actions_layout.addWidget(btn_del)
            
            actions_widget = QWidget()
            actions_widget.setLayout(actions_layout)
            
            self.teacher_table.setCellWidget(row, 2, actions_widget)

    def edit_teacher_times(self, row):
        teacher = self.teachers_data[row]
        dialog = TeacherTimesDialog(teacher, self)
        if dialog.exec():
            self.save_data()
            self.refresh_teacher_table()

    def delete_teacher(self, row):
        self.teachers_data.pop(row)
        self.save_data()
        self.refresh_teacher_table()

    def setup_requirements_tab(self):
        layout = QVBoxLayout(self.tab_requirements)
        
        add_layout = QHBoxLayout()
        self.class_input = QLineEdit(); self.class_input.setPlaceholderText("الفصل (مثال 1A)")
        self.subject_input = QLineEdit(); self.subject_input.setPlaceholderText("المادة")
        self.req_teacher_input = QComboBox()
        self.sessions_input = QLineEdit(); self.sessions_input.setPlaceholderText("عدد الحصص")
        
        btn_add = QPushButton("إضافة متطلب")
        btn_add.clicked.connect(self.add_requirement)
        
        add_layout.addWidget(self.class_input)
        add_layout.addWidget(self.subject_input)
        add_layout.addWidget(self.req_teacher_input)
        add_layout.addWidget(self.sessions_input)
        add_layout.addWidget(btn_add)
        layout.addLayout(add_layout)

        self.req_table = QTableWidget()
        self.req_table.setColumnCount(5)
        self.req_table.setHorizontalHeaderLabels(["الفصل", "المادة", "المعلم", "الحصص", "إجراء"])
        self.req_table.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Stretch)
        layout.addWidget(self.req_table)
        
        self.refresh_req_table()
        self.tabs.currentChanged.connect(self.update_teacher_dropdown)

    def update_teacher_dropdown(self):
        self.req_teacher_input.clear()
        for t in self.teachers_data:
            self.req_teacher_input.addItem(t["name"])

    def add_requirement(self):
        try:
            c = self.class_input.text().strip()
            s = self.subject_input.text().strip()
            t = self.req_teacher_input.currentText()
            sess = int(self.sessions_input.text().strip())
            if c and s and t and sess > 0:
                self.requirements_data.append({
                    "class": c, "subject": s, "teacher": t, "sessions": sess
                })
                self.save_data()
                self.refresh_req_table()
        except Exception:
            QMessageBox.warning(self, "خطأ", "تأكد من إدخال عدد الحصص كأرقام صحيحة")

    def refresh_req_table(self):
        self.req_table.setRowCount(len(self.requirements_data))
        for row, req in enumerate(self.requirements_data):
            self.req_table.setItem(row, 0, QTableWidgetItem(req["class"]))
            self.req_table.setItem(row, 1, QTableWidgetItem(req["subject"]))
            self.req_table.setItem(row, 2, QTableWidgetItem(req["teacher"]))
            self.req_table.setItem(row, 3, QTableWidgetItem(str(req["sessions"])))
            
            btn_del = QPushButton("حذف")
            btn_del.setStyleSheet("background-color: #e84118; padding: 5px;")
            btn_del.clicked.connect(lambda _, r=row: self.delete_req(r))
            self.req_table.setCellWidget(row, 4, btn_del)

    def delete_req(self, row):
        self.requirements_data.pop(row)
        self.save_data()
        self.refresh_req_table()

    def setup_schedule_tab(self):
        layout = QVBoxLayout(self.tab_schedule)
        
        btn_generate = QPushButton("بدء الذكاء الاصطناعي لتوليد الجدول (25 ثانية كحد أقصى)")
        btn_generate.setStyleSheet("background-color: #44bd32; font-size: 16px; padding: 15px;")
        btn_generate.clicked.connect(self.generate_schedule)
        layout.addWidget(btn_generate)

        self.schedule_table = QTableWidget()
        self.schedule_table.setColumnCount(8)
        self.schedule_table.setHorizontalHeaderLabels(["الفصل", "الحصة 1", "الحصة 2", "الحصة 3", "الحصة 4", "الحصة 5", "الحصة 6", "الحصة 7"])
        self.schedule_table.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Stretch)
        layout.addWidget(self.schedule_table)

    def generate_schedule(self):
        QMessageBox.information(self, "جارٍ العمل", "الخوارزمية تعمل الآن، يرجى الانتظار قد يستغرق الأمر بضع ثوانٍ...")
        QApplication.processEvents()
        
        input_data = {
            "teachers": self.teachers_data,
            "requirements": self.requirements_data
        }
        
        result = generate_schedule(input_data)
        
        if "error" in result:
            QMessageBox.critical(self, "فشل", result["error"])
        else:
            schedule = result["schedule"]
            QMessageBox.information(self, "نجاح", "تم إنشاء الجدول بنجاح!")
            self.display_schedule(schedule)

    def display_schedule(self, schedule):
        classes = list(set([s["class"] for s in schedule]))
        classes.sort()
        
        self.schedule_table.setRowCount(len(classes) * len(DAYS))
        row = 0
        for c in classes:
            for d in DAYS:
                self.schedule_table.setItem(row, 0, QTableWidgetItem(f"{c} - {d}"))
                day_slots = {s["slot"]: s for s in schedule if s["class"] == c and s["day"] == d}
                for sl in range(1, 8):
                    item = day_slots.get(sl)
                    if item:
                        text = f"{item['subject']}\n({item['teacher']})"
                        self.schedule_table.setItem(row, sl, QTableWidgetItem(text))
                    else:
                        self.schedule_table.setItem(row, sl, QTableWidgetItem(""))
                row += 1

if __name__ == "__main__":
    app = QApplication(sys.argv)
    window = MainWindow()
    window.show()
    sys.exit(app.exec())
