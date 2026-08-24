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

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();

// ----- ROLE CONSTANTS -----
const ROLES = {
    SYSTEMS_ADMIN: 'systems_administrator',
    MANAGER: 'manager',
    SUPERVISOR: 'supervisor',
    ADMIN: 'admin',        // legacy
    USER: 'user'
};

// ----- PERMISSION HELPERS -----
function isSystemsAdmin(role) {
    return role === ROLES.SYSTEMS_ADMIN || role === 'superadmin'; // backward compatibility
}

function isAdmin(role) {
    return role === ROLES.SYSTEMS_ADMIN || role === ROLES.MANAGER || role === ROLES.ADMIN || role === 'superadmin';
}

function isManager(role) {
    return role === ROLES.MANAGER || role === ROLES.ADMIN || role === 'superadmin';
}

function isSupervisor(role) {
    return role === ROLES.SUPERVISOR;
}

function canManageUsers(role) {
    return isAdmin(role) || isSystemsAdmin(role) || isManager(role);
}

function canCreateUsers(role) {
    return isAdmin(role) || isSystemsAdmin(role) || isManager(role);
}

function canDeleteUsers(role) {
    return isAdmin(role) || isSystemsAdmin(role) || isManager(role);
}

function canEditUsers(role) {
    return isAdmin(role) || isSystemsAdmin(role) || isManager(role);
}

function canResetPasswords(role) {
    return isAdmin(role) || isSystemsAdmin(role) || isManager(role) || isSupervisor(role);
}

function canAccessSystemConfig(role) {
    return isSystemsAdmin(role);
}

function canAccessSuperAdmin(role) {
    return isSystemsAdmin(role);
}

// ----- GLOBAL STATE -----
let currentUser = null;
let currentUserRole = 'user';
let currentCurrency = '$';

// ----- DOM HELPERS -----
const $ = id => document.getElementById(id);
const toast = $('toast');
const toastMsg = $('toastMsg');

// ----- TOAST NOTIFICATIONS -----
function showToast(msg, type = 'success') {
    if (!toast) return;
    toast.className = 'toast show ' + type;
    toastMsg.textContent = msg;
    const icon = toast.querySelector('i');
    icon.className = type === 'success' ? 'fas fa-check-circle' :
                     type === 'error' ? 'fas fa-exclamation-circle' :
                     'fas fa-info-circle';
    clearTimeout(toast._hide);
    toast._hide = setTimeout(() => toast.classList.remove('show'), 4000);
}

// ----- LOGIN / APP TOGGLE -----
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

// ----- SEED ADMIN (creates systems_administrator if no users exist) -----
async function seedAdmin() {
    const adminEmail = 'systemsadmin@drugsnmore.com';
    const adminPass = 'systemsadmin123';
    
    try {
        // Check if any user exists in Firestore
        const snap = await db.collection('users').limit(1).get();
        if (!snap.empty) {
            console.log('✅ Users exist – skipping seed');
            return;
        }
        
        console.log('🔨 Creating systems administrator...');
        const cred = await auth.createUserWithEmailAndPassword(adminEmail, adminPass);
        await cred.user.updateProfile({ displayName: 'Systems Administrator' });
        await db.collection('users').doc(cred.user.uid).set({
            email: adminEmail,
            role: ROLES.SYSTEMS_ADMIN,
            displayName: 'Systems Administrator',
            branch: 'Headquarters',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        await db.collection('config').doc('system').set({
            currency: '$'
        }, { merge: true });
        console.log('✅ Systems administrator created successfully');
        await auth.signOut();
    } catch (e) {
        console.warn('Seed admin error:', e.message);
    }
}

// ----- AUTH INITIALIZATION -----
function initAuth(callback) {
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            currentUser = user;
            const displayEl = document.getElementById('userDisplay');
            if (displayEl) displayEl.textContent = user.displayName || user.email || 'User';
            showApp();
            
            await loadCurrency();
            
            try {
                const doc = await db.collection('users').doc(user.uid).get();
                if (doc.exists) {
                    currentUserRole = doc.data().role || ROLES.USER;
                } else {
                    await db.collection('users').doc(user.uid).set({
                        email: user.email,
                        role: ROLES.USER,
                        displayName: user.displayName || user.email,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    currentUserRole = ROLES.USER;
                }
            } catch (e) {
                console.warn('Role fetch error:', e);
                currentUserRole = ROLES.USER;
            }
            
            // Show/hide admin links based on role
            const canAccessSysConfig = canAccessSystemConfig(currentUserRole);
            const canAccessSuperAdmin = canAccessSuperAdmin(currentUserRole);
            const canAccessAdminPages = isAdmin(currentUserRole) || isSystemsAdmin(currentUserRole) || isManager(currentUserRole);
            
            document.querySelectorAll('.sidebar-nav a[href="super-admin.html"]')
                .forEach(el => el.style.display = canAccessSuperAdmin ? 'flex' : 'none');
            document.querySelectorAll('.sidebar-nav a[href="system-configurations.html"]')
                .forEach(el => el.style.display = canAccessSysConfig ? 'flex' : 'none');
            document.querySelectorAll('.sidebar-nav a[href="admin.html"]')
                .forEach(el => el.style.display = canAccessAdminPages ? 'flex' : 'none');
            
            loadNotificationCount();
            if (callback) callback(user);
        } else {
            currentUser = null;
            currentUserRole = ROLES.USER;
            showLogin();
            seedAdmin();
        }
    });
}

// ----- NOTIFICATION COUNT -----
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

// ----- LOGIN HANDLERS -----
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
            if (!email || !pass) {
                loginError.textContent = 'Please fill in all fields.';
                loginError.style.display = 'block';
                return;
            }
            try {
                await auth.signInWithEmailAndPassword(email, pass);
            } catch (e) {
                loginError.textContent = e.message;
                loginError.style.display = 'block';
            }
        });
        loginPassword.addEventListener('keydown', e => {
            if (e.key === 'Enter') loginBtn.click();
        });
        loginEmail.addEventListener('keydown', e => {
            if (e.key === 'Enter') loginBtn.click();
        });
    }

    if (goToRegister) {
        goToRegister.addEventListener('click', e => {
            e.preventDefault();
            const email = prompt('Enter email to register:');
            if (!email) return;
            const pass = prompt('Enter password:');
            if (!pass) return;
            auth.createUserWithEmailAndPassword(email, pass)
                .then(() => showToast('User registered!'))
                .catch(e => showToast(e.message, 'error'));
        });
    }

    if (goToResetPass) {
        goToResetPass.addEventListener('click', e => {
            e.preventDefault();
            const email = prompt('Enter your email to reset password:');
            if (!email) return;
            auth.sendPasswordResetEmail(email)
                .then(() => showToast('Reset link sent!'))
                .catch(e => showToast(e.message, 'error'));
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', e => {
            e.preventDefault();
            auth.signOut();
        });
    }

    const menuToggle = document.getElementById('menuToggle');
    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('open');
        });
    }

    const notifIcon = document.getElementById('notifIcon');
    if (notifIcon) {
        notifIcon.addEventListener('click', () => {
            location.href = 'notifications.html';
        });
    }
}

// ----- EXPOSE GLOBALLY -----
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

// Expose role helpers
window.ROLES = ROLES;
window.isSystemsAdmin = isSystemsAdmin;
window.isAdmin = isAdmin;
window.isManager = isManager;
window.isSupervisor = isSupervisor;
window.canManageUsers = canManageUsers;
window.canCreateUsers = canCreateUsers;
window.canDeleteUsers = canDeleteUsers;
window.canEditUsers = canEditUsers;
window.canResetPasswords = canResetPasswords;
window.canAccessSystemConfig = canAccessSystemConfig;
window.canAccessSuperAdmin = canAccessSuperAdmin;
