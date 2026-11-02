// إعدادات Firebase المربوطة بمشروعك
const firebaseConfig = {
  apiKey: "AIzaSyB308Gb1T1FEO96H3vK75uKqLva-lkREw4",
  authDomain: "schedules-82639.firebaseapp.com",
  projectId: "schedules-82639",
  storageBucket: "schedules-82639.firebasestorage.app",
  messagingSenderId: "641079709756",
  appId: "1:641079709756:web:119108ab3414f560a83339",
  measurementId: "G-WMYTRF08Q4"
};

// تهيئة Firebase
if (typeof firebase !== 'undefined') {
    firebase.initializeApp(firebaseConfig);
    window.auth = firebase.auth();
    window.db = firebase.firestore();
} else {
    console.error("Firebase SDK script is not loaded properly.");
}
