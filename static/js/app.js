const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu"];
const ARABIC_DAYS = {"Sun": "الأحد", "Mon": "الاثنين", "Tue": "الثلاثاء", "Wed": "الأربعاء", "Thu": "الخميس"};
const DEFAULT_SUBJECTS = [
    "التربية الإسلامية", "اللغة العربية", "اللغة الإنجليزية", "الرياضيات", 
    "الحاسوب", "العلوم", "الاجتماعيات", "التاريخ", "الجغرافيا", 
    "تربية وطنية", "تربية فنية", "تدبير منزلي", "تربية بدنية"
];

let appData = null;
let currentTeacherEditIndex = null;
let currentScheduleData = [];
let sectionSeqPreferences = {};
let currentUser = null;
let isSuperAdmin = false;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupTabs();
    
    if (window.auth) {
        window.auth.onAuthStateChanged(async (user) => {
            if (user) {
                currentUser = user;
                document.getElementById('logged-out-view').style.display = 'none';
                document.getElementById('logged-in-view').style.display = 'flex';
                
                // Check Admin status
                if ((user.email && user.email.toLowerCase().includes('admin')) || isSuperAdmin) {
                    isSuperAdmin = true;
                    document.getElementById('admin-switch-buttons').style.display = 'flex';
                } else {
                    isSuperAdmin = false;
                    document.getElementById('admin-switch-buttons').style.display = 'none';
                }
                
                try {
                    const schoolDoc = await window.db.collection('schools').doc(user.uid).get();
                    if (schoolDoc.exists) {
                        const schoolData = schoolDoc.data();
                        document.getElementById('current-school-name').textContent = schoolData.schoolName || user.email;
                        if (schoolData.isAdmin) {
                            isSuperAdmin = true;
                            document.getElementById('admin-switch-buttons').style.display = 'flex';
                        }
                    } else {
                        document.getElementById('current-school-name').textContent = user.email;
                    }
                } catch (e) {
                    console.error("Error fetching school doc", e);
                }
                
                const roleEl = document.getElementById('current-school-role');
                if (roleEl) {
                    roleEl.textContent = isSuperAdmin ? '👑 مدير المنظومة' : '🏫 مدرسة مفعلة';
                }
                
                loadSchoolLogo();
                
                if (isSuperAdmin) {
                    if (document.getElementById('school-name-badge')) document.getElementById('school-name-badge').style.display = 'none';
                    switchMainView('admin');
                } else {
                    if (document.getElementById('school-name-badge')) document.getElementById('school-name-badge').style.display = 'inline-block';
                    switchMainView('scheduler');
                    await loadData();
                    await loadSchedulesList();
                }
            } else {
                currentUser = null;
                isSuperAdmin = false;
                document.getElementById('logged-out-view').style.display = 'flex';
                document.getElementById('logged-in-view').style.display = 'none';
                document.getElementById('admin-switch-buttons').style.display = 'none';
                document.getElementById('current-school-name').textContent = 'زائر المنظومة';
                const roleEl = document.getElementById('current-school-role');
                if (roleEl) roleEl.textContent = 'غير مسجل';
                loadSchoolLogo();
                openAuthModal('login');
            }
        });
    } else {
        loadSchoolLogo();
        switchMainView('scheduler');
        loadData();
        loadSchedulesList();
    }
});

// SweetAlert Helpers
function formatFirebaseError(err) {
    if (!err) return "";
    const msg = typeof err === 'string' ? err : (err.message || err.toString());
    const code = err.code || "";
    
    if (code === 'auth/email-already-in-use' || msg.includes('email-already-in-use')) {
        return "هذا البريد الإلكتروني مسجل مسبقاً في نظام المستخدمين (Firebase Authentication).\n\n💡 سبب المشكلة:\nحذف مستند المدرسة من قاعدة البيانات (Firestore) لا يحذف حساب البريد الإلكتروني نفسه من قائمة المستخدِمين المسجلين في Firebase Auth.\n\n🛠️ الحلول:\n1. قم بـ (تسجيل الدخول) مباشرة باستخدام هذا البريد وكلمة المرور.\n2. أو من لوحة تحكم فايبربيس: التوجه إلى (Authentication -> Users) وحذف البريد من قائمة المستخدمين ثم المحاولة مجدداً.";
    }
    
    if (code === 'auth/wrong-password' || code === 'auth/user-not-found' || code === 'auth/invalid-credential' || msg.includes('wrong-password') || msg.includes('user-not-found')) {
        return "البريد الإلكتروني أو كلمة المرور غير صحيحة. يرجى التثبت والمحاولة مجدداً.";
    }
    
    if (code === 'auth/weak-password' || msg.includes('weak-password')) {
        return "كلمة المرور ضعيفة جداً. يرجى استخدام 6 أحرف أو أرقام على الأقل.";
    }

    if (msg.includes('permission') || msg.includes('Permission') || code === 'permission-denied') {
        return "خطأ في صلاحيات فايبربيس (Missing or insufficient permissions).\n\nيرجى فتح لوحة تحكم فايبربيس (Firebase Console) وتحديث قواعد حماية Firestore Security Rules لتمكين القراءة والكتابة، أو مراجعة الملف docs/FIREBASE_RULES.md.";
    }
    return msg;
}

function showSuccess(msg) { Swal.fire({ title: 'نجاح', text: msg, icon: 'success', background: '#1e293b', color: '#fff', confirmButtonColor: '#3b82f6', confirmButtonText: 'حسناً' }); }
function showError(msg) { 
    const formattedMsg = formatFirebaseError(msg);
    Swal.fire({ title: 'خطأ', text: formattedMsg, icon: 'error', background: '#1e293b', color: '#fff', confirmButtonColor: '#ef4444', confirmButtonText: 'حسناً' }); 
}
function showWarning(msg) { Swal.fire({ title: 'تنبيه', text: msg, icon: 'warning', background: '#1e293b', color: '#fff', confirmButtonColor: '#f59e0b', confirmButtonText: 'حسناً' }); }

function setupTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    const contents = document.querySelectorAll('.tab-content');
    const pageTitle = document.getElementById('page-main-title');
    const pageDesc = document.getElementById('page-main-desc');
    
    const descriptions = {
        'settings-tab': 'حدد المراحل الدراسية المتوفرة في مدرستك فقط',
        'grades-tab': 'إدارة صفوف وشعب المدرسة وتعيين الترتيب المكاني',
        'subjects-tab': 'تحديد المواد الدراسية المعتمدة لكل مرحلة',
        'sessions-tab': 'توزيع نصاب الحصص الأسبوعية لكل مادة',
        'teachers-tab': 'تسجيل المعلمين وضبط حصصهم وأيام عطلهم المحظورة',
        'reqs-tab': 'إسناد المعلمين للفصول وتوزيع الحصص الأسبوعية',
        'teacher-tasks-tab': 'مراجعة نصاب ومهام كل معلم في المدرسة',
        'schedule-tab': 'توليد الجدول الأسبوعي الذكي وحل كافة التعارضات'
    };
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => {
                c.classList.remove('active');
                c.style.display = '';
            });
            
            tab.classList.add('active');
            const targetId = tab.dataset.target;
            const targetContent = document.getElementById(targetId);
            if (targetContent) {
                targetContent.classList.add('active');
            }
            
            if (pageTitle) {
                const navTextEl = tab.querySelector('.nav-text');
                pageTitle.textContent = navTextEl ? navTextEl.textContent.trim() : tab.textContent.trim();
            }
            if (pageDesc && descriptions[targetId]) {
                pageDesc.textContent = descriptions[targetId];
            }
        });
    });
}

async function loadData() {
    let loadedFromFirestore = false;
    if (currentUser && window.db) {
        try {
            const doc = await window.db.collection('schools').doc(currentUser.uid).get();
            if (doc.exists) {
                appData = doc.data();
                loadedFromFirestore = true;
            } else {
                appData = {};
                loadedFromFirestore = true;
            }
        } catch (e) {
            console.warn("Firestore load error, falling back to local server data:", e);
        }
    }
    
    if (!loadedFromFirestore) {
        try {
            const res = await fetch('api/data');
            appData = await res.json();
        } catch (e) {
            console.error("Failed to load local data", e);
        }
    }
    
    if (!appData) appData = {};
    
    // Check if account active
    if (appData.active === false && !isSuperAdmin) {
        showWarning("حساب هذه المدرسة موقوف حالياً من الإدارة. يرجى التواصل مع الدعم الفني للتفعيل.");
    }
    
    if (!appData.school_structure) appData.school_structure = {};
    if (!appData.teachers) appData.teachers = [];
    if (!appData.requirements) appData.requirements = [];
    if (!appData.grades) appData.grades = [];
    
    renderStructure();
    renderGrades();
    renderTeachers();
    renderRequirementsTab();
    renderTeacherTasksFilter();
    renderSubjectSessions();
    loadSchoolLogo();
}

async function saveData() {
    if (currentUser && window.db) {
        try {
            await window.db.collection('schools').doc(currentUser.uid).set(appData, { merge: true });
        } catch (e) {
            console.warn("Firestore save error, falling back to local API save:", e);
            try {
                await fetch('api/data', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(appData)
                });
            } catch (err) {
                console.error("Failed to save local data", err);
            }
        }
    } else {
        try {
            await fetch('api/data', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(appData)
            });
        } catch (e) {
            console.error("Failed to save local data", e);
        }
    }
}

// Auth UI Functions
function openAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) modal.style.display = 'flex';
    const loginForm = document.getElementById('login-form');
    if (loginForm) loginForm.style.display = 'block';
}

function closeAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) modal.style.display = 'none';
}

function useLocalMode() {
    currentUser = null;
    isSuperAdmin = false;
    closeAuthModal();
    if (document.getElementById('logged-out-view')) document.getElementById('logged-out-view').style.display = 'none';
    if (document.getElementById('logged-in-view')) document.getElementById('logged-in-view').style.display = 'flex';
    if (document.getElementById('admin-switch-buttons')) document.getElementById('admin-switch-buttons').style.display = 'none';
    if (document.getElementById('school-name-badge')) document.getElementById('school-name-badge').style.display = 'inline-block';
    if (document.getElementById('current-school-name')) document.getElementById('current-school-name').textContent = 'الوضع المحلي (Offline)';
    switchMainView('scheduler');
    loadData();
    loadSchedulesList();
    showSuccess('تم الدخول بنجاح في وضع العمل المحلي (حفظ البيانات على الجهاز).');
}

function switchAuthTab(tab) {
    const loginForm = document.getElementById('login-form');
    const regForm = document.getElementById('register-form');
    const title = document.getElementById('auth-modal-title');
    
    if (tab === 'login') {
        if (title) title.textContent = 'تسجيل الدخول للمنظومة';
        if (loginForm) loginForm.style.display = 'block';
        if (regForm) regForm.style.display = 'none';
    } else {
        if (title) title.textContent = 'حساب مدرسة جديد';
        if (loginForm) loginForm.style.display = 'none';
        if (regForm) regForm.style.display = 'block';
    }
}

async function handleLogin(e) {
    e.preventDefault();
    if (!window.auth) {
        showError("لم يتم إضافة إعدادات Firebase بشكل صحيح في firebase-config.js");
        return;
    }
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    
    try {
        await window.auth.signInWithEmailAndPassword(email, password);
        closeAuthModal();
        showSuccess('تم تسجيل الدخول بنجاح!');
    } catch (err) {
        showError(err.message || 'فشل تسجيل الدخول. تحقق من البيانات.');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    if (!window.auth || !window.db) {
        showError("لم يتم إضافة إعدادات Firebase بشكل صحيح في firebase-config.js");
        return;
    }
    const schoolName = document.getElementById('reg-school-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    
    try {
        const cred = await window.auth.createUserWithEmailAndPassword(email, password);
        const uid = cred.user.uid;
        
        const defaultStructure = {
            primary: [
                {name: "الصف الأول", active: false, sections: []},
                {name: "الصف الثاني", active: false, sections: []},
                {name: "الصف الثالث", active: false, sections: []},
                {name: "الصف الرابع", active: false, sections: []},
                {name: "الصف الخامس", active: false, sections: []},
                {name: "الصف السادس", active: false, sections: []}
            ],
            preparatory: [
                {name: "الصف الأول إعدادي", active: false, sections: []},
                {name: "الصف الثاني إعدادي", active: false, sections: []},
                {name: "الصف الثالث إعدادي", active: false, sections: []}
            ],
            secondary: [
                {name: "الصف الأول ثانوي", active: false, sections: []},
                {name: "الصف الثاني ثانوي - علمي", active: false, sections: []},
                {name: "الصف الثاني ثانوي - أدبي", active: false, sections: []},
                {name: "الصف الثالث ثانوي - علمي", active: false, sections: []},
                {name: "الصف الثالث ثانوي - أدبي", active: false, sections: []}
            ]
        };
        
        const initialData = {
            schoolName: schoolName,
            email: email,
            active: true,
            createdAt: new Date().toISOString(),
            school_structure: defaultStructure,
            grades: [],
            teachers: [],
            requirements: []
        };
        
        await window.db.collection('schools').doc(uid).set(initialData);
        closeAuthModal();
        showSuccess('تم إنشاء حساب المدرسة بنجاح! مرحباً بك.');
    } catch (err) {
        showError(err.message || 'حدث خطأ أثناء إنشاء الحساب.');
    }
}

async function handleLogout() {
    const isLoggedIn = (currentUser !== null) || (window.auth && window.auth.currentUser !== null) || (document.getElementById('logged-in-view') && document.getElementById('logged-in-view').style.display !== 'none');
    
    if (!isLoggedIn) {
        const res = await Swal.fire({
            title: 'غير مسجل الدخول',
            text: 'أنت غير مسجل الدخول حالياً. هل ترغب في تسجيل الدخول للمنظومة؟',
            icon: 'info',
            showCancelButton: true,
            confirmButtonColor: '#10b981',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'نعم، تسجيل الدخول',
            cancelButtonText: 'إلغاء',
            background: '#1e293b',
            color: '#ffffff'
        });
        if (res.isConfirmed) {
            openAuthModal('login');
        }
        return;
    }

    const result = await Swal.fire({
        title: 'تسجيل الخروج',
        text: 'هل أنت متأكد من رغبتك في تسجيل الخروج من المنظومة؟',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'نعم، تسجيل الخروج',
        cancelButtonText: 'إلغاء',
        background: '#1e293b',
        color: '#ffffff'
    });

    if (result.isConfirmed) {
        try {
            if (window.auth && window.auth.currentUser) {
                await window.auth.signOut();
            }
        } catch (e) {
            console.warn("Sign out error:", e);
        }

        currentUser = null;
        isSuperAdmin = false;
        appData = null;
        currentScheduleData = [];

        if (document.getElementById('logged-in-view')) document.getElementById('logged-in-view').style.display = 'none';
        if (document.getElementById('logged-out-view')) document.getElementById('logged-out-view').style.display = 'flex';
        if (document.getElementById('admin-switch-buttons')) document.getElementById('admin-switch-buttons').style.display = 'none';
        if (document.getElementById('current-school-name')) document.getElementById('current-school-name').textContent = 'زائر المنظومة';
        if (document.getElementById('current-school-role')) document.getElementById('current-school-role').textContent = 'غير مسجل';

        switchMainView('scheduler');

        await Swal.fire({
            title: 'تم تسجيل الخروج',
            text: 'تم تسجيل الخروج من المنظومة بنجاح.',
            icon: 'success',
            timer: 1500,
            showConfirmButton: false,
            background: '#1e293b',
            color: '#ffffff'
        });

        window.location.reload();
    }
}

function loadSchoolLogo() {
    const imgEl = document.getElementById('system-logo-img');
    if (!imgEl) return;
    
    if (appData && appData.logoUrl) {
        imgEl.src = appData.logoUrl;
        imgEl.style.display = 'block';
    } else {
        imgEl.style.display = 'none';
        imgEl.src = '';
    }
}

async function changeSchoolLogo(schoolId, schoolName) {
    if (!isSuperAdmin || !window.db) return;
    
    const { value: formValues } = await Swal.fire({
        title: `تخصيص شعار مدرسة "${schoolName}"`,
        html: `
            <div style="text-align: right; margin-bottom: 10px;">
                <label style="display:block; margin-bottom:6px; font-weight:bold;">اختر صورة الشعار من جهازك:</label>
                <input type="file" id="swal-logo-file" accept="image/*" class="swal2-file" style="margin:0 0 15px 0; width:100%;">
                
                <p style="text-align:center; font-weight:bold; color:#aaa; margin:10px 0;">-- أو ضع رابط صورة الشعار المباشر --</p>
                
                <input id="swal-logo-url" class="swal2-input" placeholder="https://example.com/logo.png" style="margin:0; width:100%; box-sizing:border-box;">
            </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'حفظ الشعار',
        cancelButtonText: 'إلغاء',
        confirmButtonColor: '#8b5cf6',
        background: '#1e293b',
        color: '#fff',
        preConfirm: () => {
            const fileInput = document.getElementById('swal-logo-file');
            const urlInput = document.getElementById('swal-logo-url');
            
            return new Promise((resolve) => {
                if (fileInput.files && fileInput.files[0]) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        resolve({ logoUrl: e.target.result });
                    };
                    reader.readAsDataURL(fileInput.files[0]);
                } else if (urlInput.value.trim()) {
                    resolve({ logoUrl: urlInput.value.trim() });
                } else {
                    resolve(null);
                }
            });
        }
    });

    if (formValues && formValues.logoUrl) {
        try {
            await window.db.collection('schools').doc(schoolId).set({
                logoUrl: formValues.logoUrl
            }, { merge: true });
            
            showSuccess(`تم حفظ وتحديث شعار مدرسة "${schoolName}" بنجاح!`);
            loadAdminSchoolsList();
        } catch (err) {
            showError("حدث خطأ أثناء حفظ الشعار.");
        }
    }
}

function switchMainView(viewName) {
    const adminSection = document.getElementById('admin-page-section');
    const dashboardWrapper = document.getElementById('scheduler-dashboard-wrapper');
    const navAdmin = document.getElementById('nav-btn-admin');
    const navScheduler = document.getElementById('nav-btn-scheduler');
    const pageTitle = document.getElementById('page-main-title');
    const pageDesc = document.getElementById('page-main-desc');
    
    const descriptions = {
        'settings-tab': 'حدد المراحل الدراسية المتوفرة في مدرستك فقط',
        'grades-tab': 'إدارة صفوف وشعب المدرسة وتعيين الترتيب المكاني',
        'subjects-tab': 'تحديد المواد الدراسية المعتمدة لكل مرحلة',
        'sessions-tab': 'توزيع نصاب الحصص الأسبوعية لكل مادة',
        'teachers-tab': 'تسجيل المعلمين وضبط حصصهم وأيام عطلهم المحظورة',
        'reqs-tab': 'إسناد المعلمين للفصول وتوزيع الحصص الأسبوعية',
        'teacher-tasks-tab': 'مراجعة نصاب ومهام كل معلم في المدرسة',
        'schedule-tab': 'توليد الجدول الأسبوعي الذكي وحل كافة التعارضات'
    };
    
    if (viewName === 'admin') {
        if (adminSection) adminSection.style.display = 'block';
        if (dashboardWrapper) dashboardWrapper.style.display = 'none';
        
        if (navAdmin) { navAdmin.className = 'btn-action-purple'; }
        if (navScheduler) { navScheduler.className = 'btn-secondary'; }
        
        if (pageTitle) pageTitle.textContent = 'لوحة الإدارة العامة';
        if (pageDesc) pageDesc.textContent = 'إدارة وتأسيس حسابات المدارس والتحكم بالصلاحيات والاشتراكات';
        
        loadAdminSchoolsList();
    } else {
        if (adminSection) adminSection.style.display = 'none';
        if (dashboardWrapper) dashboardWrapper.style.display = 'block';
        
        // Find which tab button is active or default to first
        let activeTab = document.querySelector('.sidebar-menu .tab-btn.active');
        if (!activeTab) {
            activeTab = document.querySelector('.sidebar-menu .tab-btn[data-target="settings-tab"]');
            if (activeTab) activeTab.classList.add('active');
        }
        const targetId = activeTab ? activeTab.dataset.target : 'settings-tab';
        
        document.querySelectorAll('.tab-content').forEach(el => {
            el.style.display = '';
            if (el.id === targetId) {
                el.classList.add('active');
            } else {
                el.classList.remove('active');
            }
        });
        
        if (navAdmin) { navAdmin.className = 'btn-secondary'; }
        if (navScheduler) { navScheduler.className = 'btn-action-dark'; }
        
        if (activeTab && pageTitle) {
            const navTextEl = activeTab.querySelector('.nav-text');
            pageTitle.textContent = navTextEl ? navTextEl.textContent.trim() : activeTab.textContent.trim();
        }
        if (pageDesc && descriptions[targetId]) {
            pageDesc.textContent = descriptions[targetId];
        }
    }
}

async function loadAdminSchoolsList() {
    const tbody = document.getElementById('admin-schools-list-page') || document.getElementById('admin-schools-list');
    if (!tbody || !window.db) return;
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px;">جاري تحميل المدارس المسجلة...</td></tr>';
    
    try {
        const snapshot = await window.db.collection('schools').get();
        tbody.innerHTML = '';
        
        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px;">لا توجد مدارس مسجلة حتى الآن.</td></tr>';
            return;
        }
        
        snapshot.forEach(doc => {
            const school = doc.data();
            const schoolId = doc.id;
            
            if (school.isAdmin || (school.email && school.email.toLowerCase().includes('admin'))) {
                return;
            }
            
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
            
            const isActive = school.active !== false;
            const statusBadge = isActive 
                ? '<span style="color:#10b981; font-weight:bold;"><i class="fas fa-check-circle"></i> مفعل</span>'
                : '<span style="color:#ef4444; font-weight:bold;"><i class="fas fa-ban"></i> معطل</span>';
                
            const btnText = isActive ? 'تعطيل' : 'تفعيل';
            const btnClass = isActive ? 'btn-danger' : 'btn-primary';
            const btnStyle = isActive ? 'padding: 5px 12px; font-size: 0.8rem;' : 'padding: 5px 12px; font-size: 0.8rem; background: #10b981;';
            
            const createdDate = school.createdAt ? school.createdAt.substring(0, 10) : 'سابق';
            
            tr.innerHTML = `
                <td style="padding:12px; font-weight:bold; color:#feca57; font-size:1rem;"><i class="fas fa-school"></i> ${school.schoolName || 'مدرسة'}</td>
                <td style="padding:12px; color:#e2e8f0;">${school.email || '-'}</td>
                <td style="padding:12px; font-size:0.85rem; color:#aaa;">${createdDate}</td>
                <td style="padding:12px;">${statusBadge}</td>
                <td style="padding:12px; display:flex; gap:6px; justify-content:center; align-items:center; flex-wrap:wrap;">
                    <button class="btn-primary" style="padding: 5px 10px; font-size: 0.8rem; background: #06b6d4;" onclick="inspectSchoolData('${schoolId}', '${(school.schoolName || '').replace(/'/g, "\\'")}')"><i class="fas fa-eye"></i> إدارة بياناتها</button>
                    <button class="btn-secondary" style="padding: 5px 10px; font-size: 0.8rem; background: rgba(139, 92, 246, 0.3);" onclick="changeSchoolLogo('${schoolId}', '${(school.schoolName || '').replace(/'/g, "\\'")}')"><i class="fas fa-camera"></i> الشعار</button>
                    <button class="btn-secondary" style="padding: 5px 10px; font-size: 0.8rem;" onclick="editSchoolInfo('${schoolId}', '${(school.schoolName || '').replace(/'/g, "\\'")}', '${school.email || ''}')"><i class="fas fa-edit"></i> تعديل</button>
                    <button class="btn-primary" style="padding: 5px 10px; font-size: 0.8rem; background: #6366f1;" onclick="sendSchoolPasswordReset('${school.email || ''}')" title="إرسال رابط تغيير كلمة المرور"><i class="fas fa-key"></i> كلمة المرور</button>
                    <button class="${btnClass}" style="${btnStyle}" onclick="toggleSchoolStatus('${schoolId}', ${isActive})">${btnText}</button>
                    <button class="btn-danger" style="padding: 5px 10px; font-size: 0.8rem; background: #dc2626;" onclick="deleteSchool('${schoolId}', '${(school.schoolName || '').replace(/'/g, "\\'")}')" title="حذف المدرسة"><i class="fas fa-trash-alt"></i> حذف</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error("Admin fetch error", err);
        const errText = formatFirebaseError(err);
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px; color:#ef4444; font-weight:bold;">${errText.replace(/\n/g, '<br>')}</td></tr>`;
    }
}

async function deleteSchool(schoolId, schoolName) {
    if (!window.db) return;
    
    const result = await Swal.fire({
        title: 'تأكيد حذف المدرسة!',
        text: `هل أنت أصل متأكد من حذف مدرسة "${schoolName}"؟ سيتم مسح كافة البيانات والجداول الخاصة بها نهائياً ولا يمكن التراجع.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'نعم، قم بالحذف النهائي',
        cancelButtonText: 'إلغاء',
        background: '#1e293b',
        color: '#fff'
    });
    
    if (result.isConfirmed) {
        try {
            await window.db.collection('schools').doc(schoolId).delete();
            showSuccess(`تم حذف مدرسة "${schoolName}" بنجاح.`);
            loadAdminSchoolsList();
        } catch (err) {
            showError("حدث خطأ أثناء عملية حذف المدرسة.");
        }
    }
}

async function inspectSchoolData(schoolId, schoolName) {
    if (!window.db) return;
    try {
        const doc = await window.db.collection('schools').doc(schoolId).get();
        if (doc.exists) {
            appData = doc.data();
            if (document.getElementById('school-name-badge')) document.getElementById('school-name-badge').style.display = 'inline-block';
            document.getElementById('current-school-name').textContent = `[إدارة] ${schoolName}`;
            switchMainView('scheduler');
            
            if (!appData.school_structure) appData.school_structure = {};
            if (!appData.teachers) appData.teachers = [];
            if (!appData.requirements) appData.requirements = [];
            if (!appData.grades) appData.grades = [];
            
            renderStructure();
            renderGrades();
            renderTeachers();
            renderRequirementsTab();
            renderTeacherTasksFilter();
            renderSubjectSessions();
            loadSchoolLogo();
            
            showSuccess(`أنت الآن تعاين وتدير بيانات مدرسة "${schoolName}" كاملة!`);
        }
    } catch (e) {
        showError("حدث خطأ أثناء تحميل بيانات المدرسة.");
    }
}

async function handleAdminCreateSchool(e) {
    e.preventDefault();
    if (!window.auth || !window.db) return;
    
    const schoolNameEl = document.getElementById('admin-school-name-page') || document.getElementById('admin-school-name');
    const emailEl = document.getElementById('admin-school-email-page') || document.getElementById('admin-school-email');
    const passwordEl = document.getElementById('admin-school-password-page') || document.getElementById('admin-school-password');
    
    const schoolName = schoolNameEl.value.trim();
    const email = emailEl.value.trim();
    const password = passwordEl.value;
    
    try {
        const cred = await window.auth.createUserWithEmailAndPassword(email, password);
        const uid = cred.user.uid;
        
        const defaultStructure = {
            primary: [
                {name: "الصف الأول", active: false, sections: []},
                {name: "الصف الثاني", active: false, sections: []},
                {name: "الصف الثالث", active: false, sections: []},
                {name: "الصف الرابع", active: false, sections: []},
                {name: "الصف الخامس", active: false, sections: []},
                {name: "الصف السادس", active: false, sections: []}
            ],
            preparatory: [
                {name: "الصف الأول إعدادي", active: false, sections: []},
                {name: "الصف الثاني إعدادي", active: false, sections: []},
                {name: "الصف الثالث إعدادي", active: false, sections: []}
            ],
            secondary: [
                {name: "الصف الأول ثانوي", active: false, sections: []},
                {name: "الصف الثاني ثانوي - علمي", active: false, sections: []},
                {name: "الصف الثاني ثانوي - أدبي", active: false, sections: []},
                {name: "الصف الثالث ثانوي - علمي", active: false, sections: []},
                {name: "الصف الثالث ثانوي - أدبي", active: false, sections: []}
            ]
        };
        
        const initialData = {
            schoolName: schoolName,
            email: email,
            active: true,
            createdAt: new Date().toISOString(),
            school_structure: defaultStructure,
            grades: [],
            teachers: [],
            requirements: []
        };
        
        await window.db.collection('schools').doc(uid).set(initialData);
        
        if (document.getElementById('admin-create-school-form-page')) document.getElementById('admin-create-school-form-page').reset();
        showSuccess(`تم تأسيس وإضافة حساب مدرسة "${schoolName}" بنجاح!`);
        loadAdminSchoolsList();
    } catch (err) {
        showError(err.message || "حدث خطأ أثناء إنشاء حساب المدرسة.");
    }
}

async function editSchoolInfo(schoolId, currentName, currentEmail) {
    const { value: formValues } = await Swal.fire({
        title: 'تعديل بيانات المدرسة',
        html: `
            <div style="text-align: right; margin-bottom: 10px;">
                <label style="display:block; margin-bottom:4px; font-weight:bold;">اسم المدرسة:</label>
                <input id="swal-school-name" class="swal2-input" value="${currentName}" style="margin:0 0 15px 0; width:100%; box-sizing:border-box;">
                
                <label style="display:block; margin-bottom:4px; font-weight:bold;">البريد الإلكتروني:</label>
                <input id="swal-school-email" type="email" class="swal2-input" value="${currentEmail}" style="margin:0 0 10px 0; width:100%; box-sizing:border-box;">
            </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'حفظ التعديلات',
        cancelButtonText: 'إلغاء',
        confirmButtonColor: '#10b981',
        background: '#1e293b',
        color: '#fff',
        preConfirm: () => {
            return {
                newSchoolName: document.getElementById('swal-school-name').value.trim(),
                newEmail: document.getElementById('swal-school-email').value.trim()
            };
        }
    });

    if (formValues) {
        try {
            await window.db.collection('schools').doc(schoolId).update({
                schoolName: formValues.newSchoolName,
                email: formValues.newEmail
            });
            showSuccess("تم تحديث اسم المدرسة والبريد الإلكتروني بنجاح!");
            loadAdminSchoolsList();
        } catch (err) {
            showError("حدث خطأ أثناء تحديث بيانات المدرسة.");
        }
    }
}

async function sendSchoolPasswordReset(email) {
    if (!email || email === '-') {
        showError("البريد الإلكتروني لهذه المدرسة غير متوفر.");
        return;
    }
    if (!window.auth) return;
    
    try {
        await window.auth.sendPasswordResetEmail(email);
        showSuccess(`تم إرسال رابط لإعادة تعيين كلمة المرور بنجاح إلى البريد الإلكتروني:\n(${email})`);
    } catch (err) {
        showError(err.message || "حدث خطأ أثناء إرسال رابط كلمة المرور.");
    }
}

async function toggleSchoolStatus(schoolId, currentActiveStatus) {
    if (!window.db) return;
    const newStatus = !currentActiveStatus;
    
    try {
        await window.db.collection('schools').doc(schoolId).update({
            active: newStatus
        });
        showSuccess(newStatus ? "تم تفعيل حساب المدرسة بنجاح!" : "تم تعطيل حساب المدرسة.");
        loadAdminSchoolsList();
    } catch (err) {
        showError("حدث خطأ أثناء تعديل حالة المدرسة.");
    }
}

function renderStructure() {
    if (!appData.school_structure) return;
    
    const stages = [
        { id: 'primary-switches', data: appData.school_structure.primary, key: 'primary' },
        { id: 'prep-switches', data: appData.school_structure.preparatory, key: 'preparatory' },
        { id: 'sec-switches', data: appData.school_structure.secondary, key: 'secondary' }
    ];
    
    stages.forEach(stage => {
        const container = document.getElementById(stage.id);
        if(!container) return;
        container.innerHTML = '';
        
        stage.data.forEach((grade, index) => {
            const div = document.createElement('div');
            div.className = 'structure-item';
            div.innerHTML = `
                <label class="toggle-switch">
                    <input type="checkbox" id="struct-${stage.key}-${index}" ${grade.active ? 'checked' : ''}>
                    <span class="slider"></span>
                </label>
                <span>${grade.name}</span>
            `;
            container.appendChild(div);
        });
    });
}

function saveStructure() {
    const stages = ['primary', 'preparatory', 'secondary'];
    
    stages.forEach(stageKey => {
        if(!appData.school_structure[stageKey]) return;
        appData.school_structure[stageKey].forEach((grade, index) => {
            const cb = document.getElementById(`struct-${stageKey}-${index}`);
            if (cb) {
                grade.active = cb.checked;
            }
        });
    });
    
    saveData();
    renderGrades();
    renderRequirementsTab();
    showSuccess("تم حفظ الهيكلية بنجاح!");
}

function renderGrades() {
    const tbody = document.querySelector('#grades-table tbody');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    if (!appData.school_structure) return;
    
    const stages = ['primary', 'preparatory', 'secondary'];
    
    stages.forEach(stageKey => {
        if(!appData.school_structure[stageKey]) return;
        appData.school_structure[stageKey].forEach((g, index) => {
            if (!g.active) return;
            
            const row = document.createElement('tr');
            
            const tagsHtml = g.sections.map((sec, secIndex) => `
                <div class="tag">
                    ${sec} <span onclick="deleteSection('${stageKey}', ${index}, ${secIndex})">&times;</span>
                </div>
            `).join('');
            
            row.innerHTML = `
                <td><strong>${g.name}</strong></td>
                <td>
                    <div class="tags-container" style="margin-bottom: 10px;">
                        ${tagsHtml}
                    </div>
                    <div style="display: flex; gap: 10px; align-items: center; justify-content: flex-end;">
                        <select class="seq-select" id="seq-${stageKey}-${index}" onchange="saveSeqPreference('${stageKey}', ${index}, this.value)">
                            <option value="ar" ${(sectionSeqPreferences[stageKey + '-' + index] || 'ar') === 'ar' ? 'selected' : ''}>حروف عربية (أ، ب، ج..)</option>
                            <option value="num" ${(sectionSeqPreferences[stageKey + '-' + index] || 'ar') === 'num' ? 'selected' : ''}>أرقام (1، 2، 3..)</option>
                            <option value="en" ${(sectionSeqPreferences[stageKey + '-' + index] || 'ar') === 'en' ? 'selected' : ''}>حروف إنجليزية (A, B, C..)</option>
                        </select>
                        <button class="btn-primary btn-sm" onclick="addAutoSection('${stageKey}', ${index})">+ إضافة شعبة</button>
                    </div>
                </td>
                <td>
                    <span style="color:var(--text-muted);font-size:0.9rem;">مفعل من الإعدادات</span>
                </td>
            `;
            tbody.appendChild(row);
        });
    });
    
    populateSubjectGradeSelect();
}

function saveSeqPreference(stageKey, index, value) {
    sectionSeqPreferences[stageKey + '-' + index] = value;
}

function addAutoSection(stageKey, index) {
    const seqType = document.getElementById(`seq-${stageKey}-${index}`).value;
    saveSeqPreference(stageKey, index, seqType);
    const seqMap = {
        'ar': ['أ', 'ب', 'ج', 'د', 'هـ', 'و', 'ز', 'ح', 'ط', 'ي', 'ك', 'ل', 'م', 'ن'],
        'num': ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15'],
        'en': ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O']
    };
    const seq = seqMap[seqType];
    const currentSections = appData.school_structure[stageKey][index].sections;
    
    let nextVal = null;
    for (let i = 0; i < seq.length; i++) {
        if (!currentSections.includes(seq[i])) {
            nextVal = seq[i];
            break;
        }
    }
    
    if (nextVal) {
        currentSections.push(nextVal);
        
        const allInSeq = currentSections.every(s => seq.includes(s));
        if (allInSeq) {
            currentSections.sort((a, b) => seq.indexOf(a) - seq.indexOf(b));
        }
        
        saveData();
        renderGrades();
    } else {
        showWarning('تم الوصول للحد الأقصى المسموح به للشعب!');
    }
}

function handleSectionEnter(e, stageKey, gradeIndex, inputEl) {
    if (e.key === 'Enter') {
        const val = inputEl.value.trim();
        if (val) {
            appData.school_structure[stageKey][gradeIndex].sections.push(val);
            saveData();
            renderGrades();
        }
    }
}

function deleteSection(stageKey, gradeIndex, sectionIndex) {
    appData.school_structure[stageKey][gradeIndex].sections.splice(sectionIndex, 1);
    saveData();
    renderGrades();
    renderRequirementsTab();
}

function populateSubjectGradeSelect() {
    const select = document.getElementById('subject-grade-select');
    if (!select) return;
    select.innerHTML = '<option value="">-- اختر الصف الدراسي --</option>';
    
    if (!appData.school_structure) return;
    const stages = ['primary', 'preparatory', 'secondary'];
    stages.forEach(stageKey => {
        appData.school_structure[stageKey].forEach((g, index) => {
            if (g.active) {
                const opt = document.createElement('option');
                opt.value = `${stageKey}-${index}`;
                opt.textContent = g.name;
                select.appendChild(opt);
            }
        });
    });
}

function loadGradeSubjects() {
    const val = document.getElementById('subject-grade-select').value;
    const container = document.getElementById('subjects-container');
    const grid = document.getElementById('subjects-grid');
    
    if (!val) {
        container.style.display = 'none';
        return;
    }
    
    container.style.display = 'block';
    const [stageKey, index] = val.split('-');
    const grade = appData.school_structure[stageKey][index];
    if (!grade.subjects) grade.subjects = [];
    
    const allSubjects = new Set([...DEFAULT_SUBJECTS, ...grade.subjects]);
    
    grid.innerHTML = '';
    allSubjects.forEach(sub => {
        const isChecked = grade.subjects.includes(sub);
        const div = document.createElement('div');
        div.className = 'subject-item';
        div.innerHTML = `
            <input type="checkbox" id="sub-${sub}" value="${sub}" ${isChecked ? 'checked' : ''} onchange="toggleSubject('${stageKey}', ${index}, '${sub}', this.checked)">
            <label for="sub-${sub}">${sub}</label>
        `;
        grid.appendChild(div);
    });
}

function toggleSubject(stageKey, index, subject, isChecked) {
    const grade = appData.school_structure[stageKey][index];
    if (!grade.subjects) grade.subjects = [];
    
    if (isChecked) {
        if (!grade.subjects.includes(subject)) grade.subjects.push(subject);
    } else {
        grade.subjects = grade.subjects.filter(s => s !== subject);
    }
    saveData();
    updateReqSubjects();
}

function addCustomSubject() {
    const input = document.getElementById('custom-subject-name');
    const subject = input.value.trim();
    const val = document.getElementById('subject-grade-select').value;
    
    if (!val) {
        showWarning("الرجاء اختيار الصف أولاً");
        return;
    }
    
    if (subject) {
        const [stageKey, index] = val.split('-');
        const grade = appData.school_structure[stageKey][index];
        if (!grade.subjects) grade.subjects = [];
        
        if (!grade.subjects.includes(subject)) {
            grade.subjects.push(subject);
            saveData();
            loadGradeSubjects(); 
            updateReqSubjects();
            input.value = '';
        } else {
            showWarning("هذه المادة موجودة بالفعل!");
        }
    }
}

function confirmSaveSubjects() {
    saveData();
    renderRequirementsTab();
    renderSubjectSessions();
    showSuccess("تم حفظ وتأكيد المواد الدراسية بنجاح!");
}

function renderSubjectSessions() {
    const select = document.getElementById('sessions-grade-filter');
    const tbody = document.querySelector('#sessions-table tbody');
    if (!select || !tbody) return;
    
    const currentFilter = select.value;
    select.innerHTML = '<option value="">-- عرض مواد جميع الصفوف --</option>';
    tbody.innerHTML = '';
    
    if (!appData.school_structure) return;
    
    const stages = ['primary', 'preparatory', 'secondary'];
    let allRowsHtml = '';
    
    stages.forEach(stageKey => {
        if(!appData.school_structure[stageKey]) return;
        appData.school_structure[stageKey].forEach((g, index) => {
            if (!g.active || !g.subjects || g.subjects.length === 0) return;
            
            const opt = document.createElement('option');
            opt.value = `${stageKey}-${index}`;
            opt.textContent = g.name;
            select.appendChild(opt);
            
            if (!g.subject_sessions) g.subject_sessions = {};
            
            g.subjects.forEach(sub => {
                const sess = g.subject_sessions[sub] || '';
                allRowsHtml += `
                    <tr class="session-row" data-grade="${stageKey}-${index}">
                        <td>
                            <strong>${sub}</strong>
                            <span class="badge-grade">${g.name}</span>
                        </td>
                        <td>
                            <input type="number" class="sessions-input" min="1" max="15" value="${sess}" onchange="updateSessionCount('${stageKey}', ${index}, '${sub}', this.value)">
                        </td>
                    </tr>
                `;
            });
        });
    });
    
    tbody.innerHTML = allRowsHtml;
    
    if (currentFilter) {
        select.value = currentFilter;
        filterSubjectSessions();
    }
}

function filterSubjectSessions() {
    const val = document.getElementById('sessions-grade-filter').value;
    const rows = document.querySelectorAll('.session-row');
    rows.forEach(row => {
        if (!val || row.dataset.grade === val) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

function resetSessionsFilter() {
    const select = document.getElementById('sessions-grade-filter');
    if (select) select.value = '';
    filterSubjectSessions();
}

function updateSessionCount(stageKey, index, subject, value) {
    const grade = appData.school_structure[stageKey][index];
    if (!grade.subject_sessions) grade.subject_sessions = {};
    grade.subject_sessions[subject] = parseInt(value) || 0;
    saveData();
}

function renderTeachers() {
    const tbody = document.querySelector('#teachers-table tbody');
    
    if(tbody) tbody.innerHTML = '';
    
    appData.teachers.forEach((t, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${t.name}</td>
            <td>${t.unwanted_slots ? t.unwanted_slots.length : 0} حصة محظورة</td>
            <td>
                <button class="btn-primary" onclick="openTimesModal(${index})">إعداد الأوقات</button>
                <button class="btn-secondary" style="margin-right: 5px; margin-left: 5px;" onclick="editTeacher(${index})">تعديل الاسم</button>
                <button class="btn-danger" onclick="deleteTeacher(${index})">حذف</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function addTeacher() {
    const input = document.getElementById('teacher-name');
    const name = input.value.trim();
    if (name) {
        appData.teachers.push({name, unwanted_slots: []});
        input.value = '';
        saveData();
        renderTeachers();
    }
}

function editTeacher(index) {
    const teacher = appData.teachers[index];
    const oldName = teacher.name;
    
    Swal.fire({
        title: 'تعديل اسم المعلم',
        input: 'text',
        inputValue: oldName,
        showCancelButton: true,
        confirmButtonText: 'حفظ التعديل',
        cancelButtonText: 'إلغاء',
        confirmButtonColor: '#3b82f6',
        cancelButtonColor: '#ef4444',
        background: '#1e293b',
        color: '#fff',
        inputValidator: (value) => {
            const newName = value.trim();
            if (!newName) {
                return 'يجب كتابة اسم المعلم!';
            }
            if (newName !== oldName && appData.teachers.some(t => t.name === newName)) {
                return 'هذا المعلم موجود بالفعل!';
            }
        }
    }).then((result) => {
        if (result.isConfirmed) {
            const newName = result.value.trim();
            if (newName !== oldName) {
                teacher.name = newName;
                if (appData.requirements) {
                    appData.requirements.forEach(req => {
                        if (req.teacher === oldName) {
                            req.teacher = newName;
                        }
                    });
                }
                saveData();
                renderTeachers();
                renderRequirementsTab(); 
                renderTeacherTasks();
                showSuccess('تم تعديل اسم المعلم وتحديث جداوله بنجاح!');
            }
        }
    });
}

function deleteTeacher(index) {
    appData.teachers.splice(index, 1);
    saveData();
    renderTeachers();
    renderRequirementsTab();
    renderTeacherTasksFilter();
}

function renderRequirementsTab() {
    const teacherSelect = document.getElementById('req-batch-teacher');
    const subjectSelect = document.getElementById('req-batch-subject');
    const classesContainer = document.getElementById('req-batch-classes-container');
    
    if (!teacherSelect || !subjectSelect) return;
    
    teacherSelect.innerHTML = '<option value="">-- اختر المعلم --</option>';
    appData.teachers.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.name;
        opt.textContent = t.name;
        teacherSelect.appendChild(opt);
    });
    
    const uniqueSubjects = new Set();
    const stages = ['primary', 'preparatory', 'secondary'];
    stages.forEach(stageKey => {
        if(!appData.school_structure[stageKey]) return;
        appData.school_structure[stageKey].forEach(g => {
            if (g.active && g.subjects) {
                g.subjects.forEach(sub => uniqueSubjects.add(sub));
            }
        });
    });
    
    subjectSelect.innerHTML = '<option value="">-- اختر المادة --</option>';
    Array.from(uniqueSubjects).sort().forEach(sub => {
        const opt = document.createElement('option');
        opt.value = sub;
        opt.textContent = sub;
        subjectSelect.appendChild(opt);
    });
    
    classesContainer.innerHTML = '<p style="color: #64748b; grid-column: 1 / -1;">يرجى اختيار المادة لظهور الفصول المرتبطة بها...</p>';
}

function renderTargetClasses() {
    const subject = document.getElementById('req-batch-subject').value;
    const container = document.getElementById('req-batch-classes-container');
    
    if (!subject) {
        container.innerHTML = '<p style="color: #64748b; grid-column: 1 / -1;">يرجى اختيار المادة لظهور الفصول المرتبطة بها...</p>';
        return;
    }
    
    container.innerHTML = '';
    let foundAny = false;
    
    const stages = ['primary', 'preparatory', 'secondary'];
    stages.forEach(stageKey => {
        if(!appData.school_structure[stageKey]) return;
        appData.school_structure[stageKey].forEach(g => {
            if (g.active && g.subjects && g.subjects.includes(subject)) {
                
                let classNames = [];
                if (g.sections && g.sections.length > 0) {
                    g.sections.forEach(sec => classNames.push(`${g.name} - ${sec}`));
                } else {
                    classNames.push(g.name);
                }
                
                const sessions = (g.subject_sessions && g.subject_sessions[subject]) ? g.subject_sessions[subject] : 0;
                
                classNames.forEach(cName => {
                    foundAny = true;
                    const existingReq = appData.requirements.find(r => r.class === cName && r.subject === subject);
                    
                    const div = document.createElement('div');
                    div.className = 'subject-item';
                    if (existingReq) {
                        div.style.border = '1px solid #f59e0b';
                        div.title = `مسندة مسبقاً للمعلم: ${existingReq.teacher}`;
                    }
                    
                    div.innerHTML = `
                        <input type="checkbox" class="batch-class-cb" value="${cName}" data-grade="${g.name}" data-sessions="${sessions}" id="cb-${cName}">
                        <label for="cb-${cName}">
                            <strong>${cName}</strong><br>
                            <small style="color: var(--text-muted);">${sessions > 0 ? sessions + ' حصص' : '<span style="color:#ef4444">لم تحدد الحصص</span>'}</small>
                        </label>
                    `;
                    container.appendChild(div);
                });
            }
        });
    });
    
    if (!foundAny) {
        container.innerHTML = '<p style="color: #ef4444; grid-column: 1 / -1;">لا توجد فصول تدرس هذه المادة حالياً.</p>';
    }
}

function assignBatchRequirements() {
    const teacher = document.getElementById('req-batch-teacher').value;
    const subject = document.getElementById('req-batch-subject').value;
    const cbs = document.querySelectorAll('.batch-class-cb:checked');
    
    if (!teacher) return showWarning('يرجى اختيار المعلم أولاً!');
    if (!subject) return showWarning('يرجى اختيار المادة أولاً!');
    if (cbs.length === 0) return showWarning('يرجى تحديد فصل واحد على الأقل لإسناده!');
    
    let addedCount = 0;
    
    cbs.forEach(cb => {
        const className = cb.value;
        const sessions = parseInt(cb.dataset.sessions);
        
        if (sessions === 0) {
            showWarning(`لم يتم تحديد عدد حصص مادة ${subject} لـ ${className} في شاشة حصص المواد. سيتم تجاهله.`);
            return;
        }
        
        const existingIndex = appData.requirements.findIndex(r => r.class === className && r.subject === subject);
        if (existingIndex > -1) {
            appData.requirements.splice(existingIndex, 1);
        }
        
        appData.requirements.push({
            class: className,
            subject: subject,
            teacher: teacher,
            sessions: sessions
        });
        addedCount++;
    });
    
    if (addedCount > 0) {
        saveData();
        showSuccess(`تم إسناد ${addedCount} فصل للمعلم ${teacher} بنجاح!`);
        cbs.forEach(cb => cb.checked = false);
        renderTargetClasses();
        renderTeacherTasksFilter(); 
    }
}

function renderTeacherTasksFilter() {
    const select = document.getElementById('tasks-teacher-filter');
    if (!select) return;
    const currentVal = select.value;
    
    select.innerHTML = '<option value="">-- اختر المعلم --</option>';
    appData.teachers.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.name;
        opt.textContent = t.name;
        select.appendChild(opt);
    });
    
    if (currentVal && appData.teachers.find(t => t.name === currentVal)) {
        select.value = currentVal;
        renderTeacherTasks();
    } else {
        document.getElementById('teacher-tasks-summary').style.display = 'none';
        document.getElementById('teacher-tasks-empty').style.display = 'block';
    }
}

function renderTeacherTasks() {
    const teacherName = document.getElementById('tasks-teacher-filter').value;
    const summaryDiv = document.getElementById('teacher-tasks-summary');
    const emptyDiv = document.getElementById('teacher-tasks-empty');
    
    if (!teacherName) {
        summaryDiv.style.display = 'none';
        emptyDiv.style.display = 'block';
        return;
    }
    
    summaryDiv.style.display = 'block';
    emptyDiv.style.display = 'none';
    
    document.getElementById('tt-name').textContent = `الجدول المسند لـ: ${teacherName}`;
    
    const tbody = document.querySelector('#teacher-tasks-table tbody');
    tbody.innerHTML = '';
    
    let totalSessions = 0;
    
    appData.requirements.forEach((req, index) => {
        if (req.teacher === teacherName) {
            totalSessions += parseInt(req.sessions);
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${req.class}</td>
                <td>${req.subject}</td>
                <td>${req.sessions}</td>
                <td><button class="btn-danger" style="padding: 5px 10px; font-size: 0.9rem;" onclick="deleteTeacherTask(${index})">إزالة من النصاب</button></td>
            `;
            tbody.appendChild(row);
        }
    });
    
    document.getElementById('tt-total-sessions').textContent = totalSessions;
}

function deleteTeacherTask(globalIndex) {
    Swal.fire({
        title: 'هل أنت متأكد؟',
        text: 'هل تريد إزالة هذه المادة من نصاب المعلم؟',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#3b82f6',
        confirmButtonText: 'نعم، قم بالإزالة',
        cancelButtonText: 'إلغاء',
        background: '#1e293b',
        color: '#fff',
    }).then((result) => {
        if (result.isConfirmed) {
            appData.requirements.splice(globalIndex, 1);
            saveData();
            renderTeacherTasks();
            renderTargetClasses();
            showSuccess('تمت الإزالة بنجاح');
        }
    });
}

function openTimesModal(index) {
    currentTeacherEditIndex = index;
    const teacher = appData.teachers[index];
    document.getElementById('modal-title').textContent = `ضبط أوقات المعلم: ${teacher.name}`;
    
    const tbody = document.getElementById('times-tbody');
    tbody.innerHTML = '';
    
    const unwanted = teacher.unwanted_slots || [];
    const isUnwanted = (d, s) => unwanted.some(u => u.day === d && u.slot === s);
    
    DAYS.forEach(day => {
        const row = document.createElement('tr');
        
        const tdDay = document.createElement('td');
        tdDay.textContent = ARABIC_DAYS[day];
        row.appendChild(tdDay);
        
        const tdFull = document.createElement('td');
        const isFullDay = [1,2,3,4,5,6,7].every(s => isUnwanted(day, s));
        tdFull.innerHTML = `
            <label class="toggle-switch">
                <input type="checkbox" id="full-${day}" ${isFullDay ? 'checked' : ''} onchange="toggleFullDay('${day}')">
                <span class="slider"></span>
            </label>
        `;
        row.appendChild(tdFull);
        
        for(let s=1; s<=7; s++){
            const tdSlot = document.createElement('td');
            const checked = isUnwanted(day, s) ? 'checked' : '';
            const disabled = isFullDay ? 'disabled' : '';
            tdSlot.innerHTML = `<input type="checkbox" class="slot-cb-${day}" data-day="${day}" data-slot="${s}" ${checked} ${disabled}>`;
            row.appendChild(tdSlot);
        }
        
        tbody.appendChild(row);
    });
    
    const tfoot = document.getElementById('times-tfoot');
    if (tfoot) {
        tfoot.innerHTML = '';
        const footRow = document.createElement('tr');
        
        const tdTitle = document.createElement('td');
        tdTitle.innerHTML = '<strong style="color: var(--primary);">حظر حصة محددة</strong>';
        footRow.appendChild(tdTitle);
        
        const tdEmpty = document.createElement('td');
        footRow.appendChild(tdEmpty);
        
        for(let s=1; s<=7; s++) {
            const tdSlot = document.createElement('td');
            const isFullSlot = DAYS.every(d => isUnwanted(d, s));
            tdSlot.innerHTML = `
                <label class="toggle-switch" style="transform: scale(0.8);">
                    <input type="checkbox" id="full-slot-${s}" ${isFullSlot ? 'checked' : ''} onchange="toggleFullSlot(${s})">
                    <span class="slider"></span>
                </label>
            `;
            footRow.appendChild(tdSlot);
        }
        tfoot.appendChild(footRow);
    }
    
    document.getElementById('times-modal').classList.add('active');
}

function toggleFullDay(day) {
    const fullCb = document.getElementById(`full-${day}`);
    const checked = fullCb.checked;
    const slots = document.querySelectorAll(`.slot-cb-${day}`);
    
    slots.forEach(cb => {
        cb.checked = checked;
        cb.disabled = checked;
    });
}

function toggleFullSlot(slotNum) {
    const isChecked = document.getElementById(`full-slot-${slotNum}`).checked;
    
    DAYS.forEach(day => {
        const slotCb = document.querySelector(`.slot-cb-${day}[data-slot="${slotNum}"]`);
        if (slotCb && !slotCb.disabled) {
            slotCb.checked = isChecked;
        }
    });
}

function closeModal() {
    document.getElementById('times-modal').classList.remove('active');
}

function saveTimes() {
    const teacher = appData.teachers[currentTeacherEditIndex];
    const newUnwanted = [];
    
    DAYS.forEach(day => {
        const slots = document.querySelectorAll(`.slot-cb-${day}`);
        slots.forEach(cb => {
            if (cb.checked) {
                newUnwanted.push({ day: day, slot: parseInt(cb.dataset.slot) });
            }
        });
    });
    
    teacher.unwanted_slots = newUnwanted;
    saveData();
    renderTeachers();
    closeModal();
}

function resetTimesUI() {
    Swal.fire({
        title: 'إعادة تعيين الأوقات',
        text: 'سيتم مسح كافة الأوقات المحظورة لهذا المعلم، هل أنت متأكد؟',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#3b82f6',
        confirmButtonText: 'نعم، مسح الكل',
        cancelButtonText: 'إلغاء',
        background: '#1e293b',
        color: '#fff',
    }).then((result) => {
        if (result.isConfirmed) {
            appData.teachers[currentTeacherEditIndex].unwanted_slots = [];
            saveData();
            renderTeachers();
            openTimesModal(currentTeacherEditIndex);
        }
    });
}

async function generateSchedule() {
    document.getElementById('loading-msg').style.display = 'block';
    document.getElementById('classes-schedule-container').style.display = 'none';
    document.getElementById('teachers-schedule-container').style.display = 'none';
    document.getElementById('schedule-controls').style.display = 'none';
    
    try {
        const res = await fetch('api/generate', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(appData)
        });
        const result = await res.json();
        
        document.getElementById('loading-msg').style.display = 'none';
        
        if (result.error) {
            showError(result.error);
        } else {
            currentScheduleData = result.schedule;
            document.getElementById('schedule-controls').style.display = 'flex';
            populateScheduleTeacherFilter();
            switchScheduleView();
            document.getElementById('btn-export-pdf').style.display = 'inline-block';
            document.getElementById('btn-export-excel').style.display = 'inline-block';
            
            if (currentUser && window.db) {
                try {
                    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
                    const schedDocId = `schedule_${timestamp}`;
                    await window.db.collection('schools').doc(currentUser.uid)
                        .collection('schedules').doc(schedDocId).set({
                            filename: schedDocId,
                            createdAt: new Date().toISOString(),
                            schedule: result.schedule
                        });
                    result.filename = schedDocId;
                } catch (err) {
                    console.error("Failed to save schedule to Firestore", err);
                }
            }
            
            await loadSchedulesList();
            if (result.filename) {
                document.getElementById('schedule-history-filter').value = result.filename;
            }
        }
    } catch (e) {
        document.getElementById('loading-msg').style.display = 'none';
        showError("حدث خطأ أثناء الاتصال بالخادم.");
    }
}

async function loadSchedulesList() {
    const select = document.getElementById('schedule-history-filter');
    if (!select) return;
    select.innerHTML = '<option value="">-- الجداول المحفوظة --</option>';
    
    if (currentUser && window.db) {
        try {
            const snapshot = await window.db.collection('schools').doc(currentUser.uid)
                .collection('schedules').orderBy('createdAt', 'desc').get();
            snapshot.forEach(doc => {
                const data = doc.data();
                const opt = document.createElement('option');
                opt.value = doc.id;
                let name = doc.id.replace('schedule_', '');
                const parts = name.split('T');
                if (parts.length === 2) {
                    name = parts[0] + ' ' + parts[1];
                }
                opt.textContent = name;
                select.appendChild(opt);
            });
        } catch (e) {
            console.error("Failed to load schedules from Firestore", e);
        }
    } else {
        try {
            const res = await fetch('api/schedules');
            const files = await res.json();
            
            files.forEach(file => {
                const opt = document.createElement('option');
                opt.value = file;
                let name = file.replace('schedule_', '').replace('.json', '');
                const parts = name.split('_');
                if (parts.length === 2) {
                    name = parts[0] + ' الساعة ' + parts[1].replace(/-/g, ':');
                }
                opt.textContent = name;
                select.appendChild(opt);
            });
        } catch (e) {
            console.error("Failed to load schedules list", e);
        }
    }
}

async function loadSavedSchedule() {
    const select = document.getElementById('schedule-history-filter');
    const filename = select.value;
    if (!filename) {
        document.getElementById('classes-schedule-container').style.display = 'none';
        document.getElementById('teachers-schedule-container').style.display = 'none';
        document.getElementById('schedule-controls').style.display = 'none';
        document.getElementById('btn-export-pdf').style.display = 'none';
        document.getElementById('btn-export-excel').style.display = 'none';
        return;
    }
    
    document.getElementById('loading-msg').style.display = 'block';
    
    try {
        let result = null;
        if (currentUser && window.db) {
            const doc = await window.db.collection('schools').doc(currentUser.uid)
                .collection('schedules').doc(filename).get();
            if (doc.exists) {
                result = doc.data();
            } else {
                result = { error: "الملف غير موجود" };
            }
        } else {
            const res = await fetch(`api/schedules/${filename}`);
            result = await res.json();
        }
        
        document.getElementById('loading-msg').style.display = 'none';
        
        if (result.error) {
            showError(result.error);
        } else {
            currentScheduleData = result.schedule || result;
            document.getElementById('schedule-controls').style.display = 'flex';
            populateScheduleTeacherFilter();
            switchScheduleView();
            document.getElementById('btn-export-pdf').style.display = 'inline-block';
            document.getElementById('btn-export-excel').style.display = 'inline-block';
            showSuccess('تم تحميل الجدول المحفوظ بنجاح!');
        }
    } catch (e) {
        document.getElementById('loading-msg').style.display = 'none';
        showError("حدث خطأ أثناء تحميل الجدول.");
    }
}

function renderSchedule(schedule) {
    const container = document.getElementById('classes-schedule-container');
    container.innerHTML = '';
    
    const classesSet = new Set(schedule.map(s => s.class));
    const classes = Array.from(classesSet).sort();
    
    classes.forEach(c => {
        const classSchedule = schedule.filter(s => s.class === c);
        
        const wrapper = document.createElement('div');
        wrapper.className = 'table-container mt-2';
        wrapper.style.marginBottom = '30px';
        
        const title = document.createElement('h3');
        title.style.color = '#10b981';
        title.style.marginBottom = '10px';
        title.style.textAlign = 'center';
        title.innerHTML = `<i class="fas fa-users"></i> جدول فصل: ${c}`;
        wrapper.appendChild(title);
        
        const table = document.createElement('table');
        const thead = document.createElement('thead');
        thead.innerHTML = `
            <tr>
                <th>اليوم</th>
                <th>الحصة 1</th>
                <th>الحصة 2</th>
                <th>الحصة 3</th>
                <th>الحصة 4</th>
                <th>الحصة 5</th>
                <th>الحصة 6</th>
                <th>الحصة 7</th>
            </tr>
        `;
        table.appendChild(thead);
        
        const tbody = document.createElement('tbody');
        DAYS.forEach(day => {
            const row = document.createElement('tr');
            const tdDay = document.createElement('td');
            tdDay.innerHTML = `<strong>${ARABIC_DAYS[day]}</strong>`;
            row.appendChild(tdDay);
            
            for(let sl=1; sl<=7; sl++) {
                const td = document.createElement('td');
                const item = classSchedule.find(s => s.day === day && s.slot === sl);
                
                if (item) {
                    td.innerHTML = `<span style="color:#feca57;font-weight:bold;font-size:1.1rem;text-shadow: 1px 1px 2px rgba(0,0,0,0.5);">${item.subject}</span><br><small style="color:#ffffff;font-weight:bold;">${item.teacher}</small>`;
                    td.style.background = 'rgba(59, 130, 246, 0.15)';
                } else {
                    td.textContent = '-';
                }
                
                row.appendChild(td);
            }
            tbody.appendChild(row);
        });
        table.appendChild(tbody);
        wrapper.appendChild(table);
        container.appendChild(wrapper);
    });
}

function populateScheduleTeacherFilter() {
    const select = document.getElementById('schedule-teacher-filter');
    select.innerHTML = '<option value="all">-- عرض جميع المعلمين --</option>';
    
    const teachersSet = new Set(currentScheduleData.map(s => s.teacher));
    const teachers = Array.from(teachersSet).sort();
    
    teachers.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t;
        opt.textContent = t;
        select.appendChild(opt);
    });
}

function switchScheduleView() {
    const viewType = document.getElementById('schedule-view-type').value;
    const filterContainer = document.getElementById('teacher-filter-container');
    const classesContainer = document.getElementById('classes-schedule-container');
    const teachersContainer = document.getElementById('teachers-schedule-container');
    
    if (viewType === 'classes') {
        filterContainer.style.display = 'none';
        teachersContainer.style.display = 'none';
        classesContainer.style.display = 'block';
        renderSchedule(currentScheduleData);
    } else {
        filterContainer.style.display = 'flex';
        classesContainer.style.display = 'none';
        teachersContainer.style.display = 'block';
        renderTeachersSchedule();
    }
}

function renderTeachersSchedule() {
    const container = document.getElementById('teachers-schedule-container');
    container.innerHTML = '';
    
    const selectedTeacher = document.getElementById('schedule-teacher-filter').value;
    
    const teachersSet = new Set(currentScheduleData.map(s => s.teacher));
    let teachers = Array.from(teachersSet).sort();
    
    if (selectedTeacher !== 'all') {
        teachers = [selectedTeacher];
    }
    
    teachers.forEach(t => {
        const teacherSchedule = currentScheduleData.filter(s => s.teacher === t);
        
        const wrapper = document.createElement('div');
        wrapper.className = 'table-container mt-2';
        wrapper.style.marginBottom = '30px';
        
        const title = document.createElement('h3');
        title.style.color = '#3b82f6';
        title.style.marginBottom = '10px';
        title.style.textAlign = 'center';
        title.innerHTML = `<i class="fas fa-chalkboard-teacher"></i> جدول المعلم: ${t}`;
        wrapper.appendChild(title);
        
        const table = document.createElement('table');
        const thead = document.createElement('thead');
        thead.innerHTML = `
            <tr>
                <th>اليوم</th>
                <th>الحصة 1</th>
                <th>الحصة 2</th>
                <th>الحصة 3</th>
                <th>الحصة 4</th>
                <th>الحصة 5</th>
                <th>الحصة 6</th>
                <th>الحصة 7</th>
            </tr>
        `;
        table.appendChild(thead);
        
        const tbody = document.createElement('tbody');
        DAYS.forEach(day => {
            const row = document.createElement('tr');
            const tdDay = document.createElement('td');
            tdDay.innerHTML = `<strong>${ARABIC_DAYS[day]}</strong>`;
            row.appendChild(tdDay);
            
            for (let s = 1; s <= 7; s++) {
                const td = document.createElement('td');
                const slotData = teacherSchedule.find(x => x.day === day && x.slot === s);
                
                if (slotData) {
                    td.innerHTML = `<span style="color:#feca57;font-weight:bold;">${slotData.subject}</span><br><small>${slotData.class}</small>`;
                } else {
                    td.innerHTML = '-';
                }
                
                row.appendChild(td);
            }
            tbody.appendChild(row);
        });
        table.appendChild(tbody);
        wrapper.appendChild(table);
        container.appendChild(wrapper);
    });
}

function exportScheduleToPDF() {
    const viewType = document.getElementById('schedule-view-type').value;
    let targetElementId = viewType === 'classes' ? 'classes-schedule-container' : 'teachers-schedule-container';
    
    const targetElement = document.getElementById(targetElementId);
    if (!targetElement) return;

    const printContainer = document.createElement('div');
    printContainer.style.direction = 'rtl';
    printContainer.style.fontFamily = "'Tajawal', sans-serif";
    printContainer.style.padding = '20px';
    printContainer.style.background = '#ffffff';
    
    const mainTitle = document.createElement('h1');
    if (viewType === 'classes') {
        mainTitle.textContent = 'الجدول الدراسي العام (جداول الفصول)';
    } else {
        const selectedTeacher = document.getElementById('schedule-teacher-filter').value;
        mainTitle.textContent = selectedTeacher === 'all' ? 'الجدول الدراسي العام (جداول جميع المعلمين)' : `الجدول الدراسي للمعلم: ${selectedTeacher}`;
    }
    mainTitle.style.textAlign = 'center';
    mainTitle.style.color = '#000000';
    mainTitle.style.marginBottom = '20px';
    printContainer.appendChild(mainTitle);
    
    const clone = targetElement.cloneNode(true);
    clone.style.display = 'block';
    
    const wrappers = clone.querySelectorAll('.table-container');
    wrappers.forEach((w, index) => {
        w.style.pageBreakInside = 'avoid';
        w.style.breakInside = 'avoid';
        w.style.display = 'block';
        
        if (index > 0) {
            const pageBreakDiv = document.createElement('div');
            pageBreakDiv.className = 'html2pdf__page-break';
            w.parentNode.insertBefore(pageBreakDiv, w);
        }
    });
    
    const tables = clone.querySelectorAll('table');
    tables.forEach(tableClone => {
        tableClone.style.width = '100%';
        tableClone.style.borderCollapse = 'collapse';
        tableClone.style.color = '#000000';
        tableClone.style.marginBottom = '20px';
        tableClone.style.direction = 'rtl';
        tableClone.style.pageBreakInside = 'avoid';
        
        const ths = tableClone.querySelectorAll('th');
        ths.forEach(th => {
            th.style.border = '1px solid #000000';
            th.style.padding = '8px';
            th.style.backgroundColor = '#e2e8f0';
            th.style.color = '#000000';
            th.style.fontWeight = 'bold';
            th.style.fontSize = '14px';
        });
        
        const tds = tableClone.querySelectorAll('td');
        tds.forEach(td => {
            td.style.border = '1px solid #000000';
            td.style.padding = '6px';
            td.style.color = '#000000';
            td.style.fontSize = '13px';
        });
        
        const h3s = clone.querySelectorAll('h3');
        h3s.forEach(h3 => {
            h3.style.color = '#000000';
            h3.style.textAlign = 'center';
            h3.style.marginBottom = '10px';
            h3.style.fontSize = '18px';
        });
    });
    
    printContainer.appendChild(clone);
    
    const opt = {
        margin:       10,
        filename:     'الجدول_الدراسي.pdf',
        image:        { type: 'jpeg', quality: 1.0 },
        html2canvas:  { scale: 2, useCORS: true },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' },
        pagebreak:    { mode: ['css', 'legacy'] }
    };
    
    html2pdf().set(opt).from(printContainer).save();
}

function exportScheduleToExcel() {
    if (!currentScheduleData || currentScheduleData.length === 0) {
        showWarning("لا يوجد جدول لتصديره!");
        return;
    }
    
    const wb = XLSX.utils.book_new();
    
    let ws_data_classes = [];
    const classesSet = new Set(currentScheduleData.map(s => s.class));
    const classes = Array.from(classesSet).sort();
    
    classes.forEach(c => {
        ws_data_classes.push([`فصل: ${c}`, "", "", "", "", "", "", ""]);
        ws_data_classes.push(["اليوم", "الحصة 1", "الحصة 2", "الحصة 3", "الحصة 4", "الحصة 5", "الحصة 6", "الحصة 7"]);
        
        DAYS.forEach(day => {
            let row = [ARABIC_DAYS[day]];
            for(let sl=1; sl<=7; sl++) {
                const item = currentScheduleData.find(s => s.class === c && s.day === day && s.slot === sl);
                if(item) {
                    row.push(`${item.subject} (${item.teacher})`);
                } else {
                    row.push("-");
                }
            }
            ws_data_classes.push(row);
        });
        
        ws_data_classes.push(["", "", "", "", "", "", "", ""]);
    });
    
    const ws_classes = XLSX.utils.aoa_to_sheet(ws_data_classes);
    ws_classes['!dir'] = 'rtl';
    XLSX.utils.book_append_sheet(wb, ws_classes, "جداول الفصول");
    
    let ws_data_teachers = [];
    const teachersSet = new Set(currentScheduleData.map(s => s.teacher));
    const teachers = Array.from(teachersSet).sort();
    
    teachers.forEach(t => {
        ws_data_teachers.push([`المعلم: ${t}`, "", "", "", "", "", "", ""]);
        ws_data_teachers.push(["اليوم", "الحصة 1", "الحصة 2", "الحصة 3", "الحصة 4", "الحصة 5", "الحصة 6", "الحصة 7"]);
        
        DAYS.forEach(day => {
            let row = [ARABIC_DAYS[day]];
            for(let sl=1; sl<=7; sl++) {
                const item = currentScheduleData.find(s => s.teacher === t && s.day === day && s.slot === sl);
                if(item) {
                    row.push(`${item.subject} (${item.class})`);
                } else {
                    row.push("-");
                }
            }
            ws_data_teachers.push(row);
        });
        
        ws_data_teachers.push(["", "", "", "", "", "", "", ""]);
    });
    
    const ws_teachers = XLSX.utils.aoa_to_sheet(ws_data_teachers);
    ws_teachers['!dir'] = 'rtl';
    XLSX.utils.book_append_sheet(wb, ws_teachers, "جداول المعلمين");
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    XLSX.writeFile(wb, `الجدول_الذكي_${timestamp}.xlsx`);
}
