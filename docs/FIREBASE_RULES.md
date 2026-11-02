# حل مشكلة صلاحيات فايبربيس (Missing or insufficient permissions)

إذا ظهر لك الخطأ التالي أثناء تشغيل النظام أو تسجيل الدخول/إضافة البيانات:
`Missing or insufficient permissions`

هذا يعني أن قواعد الحماية في **Firebase Cloud Firestore** تمنع القراءة أو الكتابة في قاعدة البيانات.

---

## 🛠️ خطوات الحل بالصور والتفصيل (في لوحة تحكم Firebase)

1. **افتح لوحة تحكم فايبربيس:**
   توجّه إلى [Firebase Console](https://console.firebase.google.com/).

2. **اختر مشروعك:**
   اختر المشروع الخاص بك: **`schedules-82639`**.

3. **افتح قاعدة البيانات (Firestore Database):**
   من القائمة الجانبية اختر **Build** ثم **Firestore Database**.

4. **ادخل إلى تبويب القواعد (Rules):**
   اضغط على تبويب **Rules** أعلى الصفحة.

5. **استبدل القواعد الحالية بالكود التالي:**

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // إتاحة القراءة والكتابة لكافة المستخدمين المسجلين في النظام
    match /schools/{schoolId} {
      allow read, write: if request.auth != null;
      
      match /schedules/{scheduleId} {
        allow read, write: if request.auth != null;
      }
    }
    
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

6. **نشر القواعد:**
   اضغط على زر **Publish** (نشر) في أعلى اليمين.

---

## 💡 خيار الوضع المحلي (بدون فايبربيس)

إذا كنت ترغب في تشغيل النظام محلياً على جهازك دون الحاجة إلى الاتصال بـ Firebase:
- يمكنك تشغيل الخادم بواسطة `python app.py` أو تشغيل `run.bat`.
- النظام يقوم تلقائياً بالحفظ في ملفات محلية `data/data.json` في حال تعذر الاتصال بـ Firebase أو عدم توفر صلاحيات.
