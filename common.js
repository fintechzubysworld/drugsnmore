// ===== common.js – shared Firebase init, auth, navigation, toast, currency, and helpers =====
const firebaseConfig = {
    apiKey: "AIzaSyCA9vHsVV841oZue9McbU14yyZtyDptT3Q",
    authDomain: "drugs-n--more.firebaseapp.com",
    projectId: "drugs-n--more",
    storageBucket: "drugs-n--more.firebasestorage.app",
    messagingSenderId: "1027965446929",
    appId: "1:1027965446929:web:eec971b5e458baff813ab0",
    measurementId: "G-HV3GYSY6CK"
};

// Check if Firebase is already initialized
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();

let currentUser = null;
let currentUserRole = 'user';
let currentCurrency = '$'; // default currency symbol

// DOM helpers
const $ = id => document.getElementById(id);
const toast = $('toast');
const toastMsg = $('toastMsg');

function showToast(msg, type = 'success') {
    if (!toast) return;
    toast.className = 'toast show ' + type;
    toastMsg.textContent = msg;
    const icon = toast.querySelector('i');
    icon.className = type === 'success' ? 'fas fa-check-circle' : type === 'error' ? 'fas fa-exclamation-circle' : 'fas fa-info-circle';
    clearTimeout(toast._hide);
    toast._hide = setTimeout(() => toast.classList.remove('show'), 4000);
}

function showLogin() {
    const loginPage = $('loginPage');
    if (!loginPage) return;
    loginPage.style.display = 'flex';
    const main = document.querySelector('.main');
    const sidebar = document.querySelector('.sidebar');
    if (main) main.style.display = 'none';
    if (sidebar) sidebar.style.display = 'none';
}

function showApp() {
    const loginPage = $('loginPage');
    if (loginPage) loginPage.style.display = 'none';
    const main = document.querySelector('.main');
    const sidebar = document.querySelector('.sidebar');
    if (main) main.style.display = 'flex';
    if (sidebar) sidebar.style.display = 'flex';
}

// ----- CURRENCY FUNCTIONS -----
async function loadCurrency() {
    try {
        const doc = await db.collection('config').doc('system').get();
        if (doc.exists) {
            const data = doc.data();
            if (data.currency) {
                currentCurrency = data.currency;
                console.log('💱 Currency loaded:', currentCurrency);
            }
        }
    } catch (e) {
        console.warn('Error loading currency:', e);
        // Keep default
    }
}

function formatCurrency(amount) {
    if (amount === undefined || amount === null) return currentCurrency + '0.00';
    return currentCurrency + parseFloat(amount).toFixed(2);
}

function getCurrency() {
    return currentCurrency;
}

// ===== ROBUST SEED ADMIN =====
async function seedAdmin() {
    const adminEmail = 'superadmin@drugsnmore.com';
    const adminPass = 'superadmin123';
    
    try {
        // First, try to sign in – if it works, account exists
        try {
            await auth.signInWithEmailAndPassword(adminEmail, adminPass);
            await auth.signOut();
            console.log('✅ Super admin already exists');
            return;
        } catch (signInError) {
            // If user not found, create the account
            if (signInError.code === 'auth/user-not-found') {
                console.log('🔨 Creating super admin account...');
                const cred = await auth.createUserWithEmailAndPassword(adminEmail, adminPass);
                await cred.user.updateProfile({ displayName: 'Super Admin' });
                await db.collection('users').doc(cred.user.uid).set({
                    email: adminEmail,
                    role: 'superadmin',
                    displayName: 'Super Admin',
                    branch: 'Headquarters',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                // Set default currency
                await db.collection('config').doc('system').set({
                    currency: '$'
                }, { merge: true });
                console.log('✅ Super admin created successfully');
                await auth.signOut();
            } else {
                // Some other error (network, etc.)
                console.warn('Seed admin check error:', signInError.message);
            }
        }
    } catch (e) {
        console.warn('Seed admin fatal error:', e.message);
    }
}

// ----- AUTH INIT -----
function initAuth(callback) {
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            currentUser = user;
            const displayEl = document.getElementById('userDisplay');
            if (displayEl) displayEl.textContent = user.displayName || user.email || 'User';
            showApp();
            
            // Load currency
            await loadCurrency();
            
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
            } catch (e) { 
                console.warn('Role fetch error:', e);
                currentUserRole = 'user'; 
            }
            const isSuper = currentUserRole === 'superadmin';
            document.querySelectorAll('.sidebar-nav a[href="super-admin.html"]').forEach(el => el.style.display = isSuper ? 'flex' : 'none');
            document.querySelectorAll('.sidebar-nav a[href="system-configurations.html"]').forEach(el => el.style.display = isSuper ? 'flex' : 'none');
            loadNotificationCount();
            if (callback) callback(user);
        } else {
            currentUser = null;
            currentUserRole = 'user';
            showLogin();
            // Seed admin only if no one is logged in
            seedAdmin();
        }
    });
}

async function loadNotificationCount() {
    if (!currentUser) return;
    try {
        const snap = await db.collection('notifications')
            .where('userId', '==', currentUser.uid)
            .where('read', '==', false)
            .get();
        const dot = document.getElementById('notifDot');
        if (dot) dot.style.display = snap.size > 0 ? 'block' : 'none';
    } catch (e) {
        console.warn('Notification count error:', e.message);
    }
}

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
    const menuToggle = document.getElementById('menuToggle');
    if (menuToggle) {
        menuToggle.addEventListener('click', () => document.getElementById('sidebar').classList.toggle('open'));
    }
    const notifIcon = document.getElementById('notifIcon');
    if (notifIcon) {
        notifIcon.addEventListener('click', () => location.href = 'notifications.html');
    }
}

// Export global functions
window.showToast = showToast;
window.db = db;
window.auth = auth;
window.currentUser = () => currentUser;
window.currentUserRole = () => currentUserRole;
window.initAuth = initAuth;
window.attachLoginHandlers = attachLoginHandlers;
window.loadNotificationCount = loadNotificationCount;
window.loadCurrency = loadCurrency;
window.formatCurrency = formatCurrency;
window.getCurrency = getCurrency;
window.currentCurrency = () => currentCurrency;
