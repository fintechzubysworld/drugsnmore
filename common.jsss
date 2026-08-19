// ===== common.js – shared Firebase init, auth, navigation, toast, and helpers =====
const firebaseConfig = {
    apiKey: "AIzaSyCA9vHsVV841oZue9McbU14yyZtyDptT3Q",
    authDomain: "drugs-n--more.firebaseapp.com",
    projectId: "drugs-n--more",
    storageBucket: "drugs-n--more.firebasestorage.app",
    messagingSenderId: "1027965446929",
    appId: "1:1027965446929:web:eec971b5e458baff813ab0",
    measurementId: "G-HV3GYSY6CK"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let currentUser = null;
let currentUserRole = 'user';

// DOM helpers
const $ = id => document.getElementById(id);
const toast = $('toast');
const toastMsg = $('toastMsg');

function showToast(msg, type = 'success') {
    toast.className = 'toast show ' + type;
    toastMsg.textContent = msg;
    const icon = toast.querySelector('i');
    icon.className = type === 'success' ? 'fas fa-check-circle' : type === 'error' ? 'fas fa-exclamation-circle' : 'fas fa-info-circle';
    clearTimeout(toast._hide);
    toast._hide = setTimeout(() => toast.classList.remove('show'), 4000);
}

function showLogin() {
    $('loginPage').style.display = 'flex';
    document.querySelector('.main').style.display = 'none';
    document.querySelector('.sidebar').style.display = 'none';
}

function showApp() {
    $('loginPage').style.display = 'none';
    document.querySelector('.main').style.display = 'flex';
    document.querySelector('.sidebar').style.display = 'flex';
}

// Seed default admin if no users exist
async function seedAdmin() {
    try {
        const snap = await db.collection('users').limit(1).get();
        if (!snap.empty) return;
        const cred = await auth.createUserWithEmailAndPassword('admin@drugsnmore.com', 'admin123');
        await cred.user.updateProfile({ displayName: 'Admin' });
        await db.collection('users').doc(cred.user.uid).set({
            email: 'admin@drugsnmore.com',
            role: 'superadmin',
            displayName: 'Admin',
            branch: 'Headquarters',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        console.log('✅ Default admin created');
        await auth.signOut();
    } catch (e) { console.warn('Seed error:', e.message); }
}

// Auth state listener – call this in each page
function initAuth(callback) {
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            currentUser = user;
            document.getElementById('userDisplay').textContent = user.displayName || user.email || 'User';
            showApp();
            try {
                const doc = await db.collection('users').doc(user.uid).get();
                if (doc.exists) currentUserRole = doc.data().role || 'user';
                else {
                    await db.collection('users').doc(user.uid).set({
                        email: user.email,
                        role: 'user',
                        displayName: user.displayName || user.email,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    currentUserRole = 'user';
                }
            } catch (e) { currentUserRole = 'user'; }
            // show/hide super admin links
            const isSuper = currentUserRole === 'superadmin';
            document.querySelectorAll('.sidebar-nav a[href="super-admin.html"]').forEach(el => el.style.display = isSuper ? 'flex' : 'none');
            document.querySelectorAll('.sidebar-nav a[href="system-configurations.html"]').forEach(el => el.style.display = isSuper ? 'flex' : 'none');
            // load notifications count
            loadNotificationCount();
            if (callback) callback(user);
        } else {
            currentUser = null;
            currentUserRole = 'user';
            showLogin();
            seedAdmin();
        }
    });
}

// Load notification count (for dot)
async function loadNotificationCount() {
    if (!currentUser) return;
    try {
        const snap = await db.collection('notifications').where('userId', '==', currentUser.uid).where('read', '==', false).get();
        const dot = document.getElementById('notifDot');
        if (dot) dot.style.display = snap.size > 0 ? 'block' : 'none';
    } catch (e) { console.warn(e); }
}

// Common login handlers (attach after login page is rendered)
function attachLoginHandlers() {
    const loginBtn = $('loginBtn');
    const loginEmail = $('loginEmail');
    const loginPassword = $('loginPassword');
    const loginError = $('loginError');
    const goToRegister = $('goToRegister');
    const goToResetPass = $('goToResetPass');
    const logoutBtn = $('logoutBtn');

    if (loginBtn) {
        loginBtn.addEventListener('click', async () => {
            const email = loginEmail.value.trim();
            const pass = loginPassword.value;
            loginError.style.display = 'none';
            if (!email || !pass) { loginError.textContent = 'Please fill in all fields.'; loginError.style.display = 'block'; return; }
            try { await auth.signInWithEmailAndPassword(email, pass); }
            catch (e) { loginError.textContent = e.message; loginError.style.display = 'block'; }
        });
        loginPassword.addEventListener('keydown', e => { if (e.key === 'Enter') loginBtn.click(); });
        loginEmail.addEventListener('keydown', e => { if (e.key === 'Enter') loginBtn.click(); });
    }
    if (goToRegister) {
        goToRegister.addEventListener('click', e => {
            e.preventDefault();
            const email = prompt('Enter email to register:');
            if (!email) return;
            const pass = prompt('Enter password:');
            if (!pass) return;
            auth.createUserWithEmailAndPassword(email, pass).then(() => showToast('User registered!')).catch(e => showToast(e.message, 'error'));
        });
    }
    if (goToResetPass) {
        goToResetPass.addEventListener('click', e => {
            e.preventDefault();
            const email = prompt('Enter your email to reset password:');
            if (!email) return;
            auth.sendPasswordResetEmail(email).then(() => showToast('Reset link sent!')).catch(e => showToast(e.message, 'error'));
        });
    }
    if (logoutBtn) {
        logoutBtn.addEventListener('click', e => { e.preventDefault(); auth.signOut(); });
    }
    // menu toggle
    const menuToggle = document.getElementById('menuToggle');
    if (menuToggle) {
        menuToggle.addEventListener('click', () => document.getElementById('sidebar').classList.toggle('open'));
    }
    // notification icon
    const notifIcon = document.getElementById('notifIcon');
    if (notifIcon) {
        notifIcon.addEventListener('click', () => location.href = 'notifications.html');
    }
}

// Export common functions
window.showToast = showToast;
window.db = db;
window.auth = auth;
window.currentUser = () => currentUser;
window.currentUserRole = () => currentUserRole;
window.initAuth = initAuth;
window.attachLoginHandlers = attachLoginHandlers;
window.loadNotificationCount = loadNotificationCount;
