import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged, 
    createUserWithEmailAndPassword 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    getDoc, 
    setDoc, 
    addDoc, 
    collection, 
    onSnapshot, 
    deleteDoc 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// =========================================
// 1. CONFIGURATION & CORE INITIALIZATION
// =========================================
const firebaseConfig = {
  apiKey: "AIzaSyA-K36hLL8Q8aOl9ETgK24QKP4r6NfYOTM",
  authDomain: "loginporta.firebaseapp.com",
  databaseURL: "https://loginporta-default-rtdb.firebaseio.com",
  projectId: "loginporta",
  storageBucket: "loginporta.firebasestorage.app",
  messagingSenderId: "1024961026506",
  appId: "1:1024961026506:web:ff2284ed6d0b72c0e0d733",
  measurementId: "G-KTXJBJCNEJ"
};

// Main App Initialization
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Secondary Isolated App Instance for Administrative Operations
const adminApp = initializeApp(firebaseConfig, "AdminInstance");
const adminAuth = getAuth(adminApp);

// Google Drive Script Bridge Link
const GOOGLE_DRIVE_BRIDGE_URL = "https://script.google.com/macros/s/AKfycbziyQgjaHiPKBZ6p3GeOTt4-yvQRyLMIRUMC3B-nR74P1bS0FvMIKSmOVIkuGYZK5Yk/exec";

// Global Session Tracking State
let currentUserProfile = null;
let unsubscribeFiles = null;
let unsubscribeUsers = null;

// =========================================
// 2. DOM ELEMENT SELECTORS
// =========================================
const loginScreen = document.getElementById("login-screen");
const dashboardScreen = document.getElementById("dashboard-screen");
const loginForm = document.getElementById("login-form");
const emailInput = document.getElementById("email-input");
const passwordInput = document.getElementById("password-input");
const errorMsg = document.getElementById("error-msg");

const greetingText = document.getElementById("greeting-text");
const greetingSpinner = document.getElementById("greeting-spinner");
const logoutBtn = document.getElementById("logout-btn");
const userDisplayName = document.getElementById("user-display-name");
const userRoleBadge = document.getElementById("user-role-badge");

const adminSection = document.getElementById("admin-section");
const createUserForm = document.getElementById("create-user-form");
const newUsername = document.getElementById("new-username");
const newEmail = document.getElementById("new-email");
const newPassword = document.getElementById("new-password");
const newRole = document.getElementById("new-role");
const userListContainer = document.getElementById("user-list-container");

const fileChooser = document.getElementById("file-chooser");
const uploadBtn = document.getElementById("upload-btn");
const filesGrid = document.getElementById("files-grid");

// =========================================
// 3. AUTHENTICATION LIFECYCLE
// =========================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        if (greetingSpinner) greetingSpinner.classList.remove("hidden");
        if (greetingText) greetingText.textContent = "Welcome";
        
        try {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists()) {
                currentUserProfile = userDoc.data();
                setupDashboardUI();
            } else {
                forceSignOut("Configuration error: Firestore document missing.");
            }
        } catch (err) {
            forceSignOut("Network sync error. Please try logging in again.");
        }
    } else {
        showLoginView();
    }
});

if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (errorMsg) errorMsg.textContent = "";
        
        const email = emailInput.value.trim();
        const password = passwordInput.value;

        // Trigger loading text immediately upon submission
        if (greetingText) greetingText.textContent = "Welcome";
        if (greetingSpinner) greetingSpinner.classList.remove("hidden");

        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (err) {
            if (greetingText) greetingText.textContent = "Hi, Yug";
            if (greetingSpinner) greetingSpinner.classList.add("hidden");
            if (errorMsg) errorMsg.textContent = "Invalid credentials. Please verify your email and password.";
        }
    });
}

if (logoutBtn) {
    logoutBtn.addEventListener("click", () => forceSignOut(""));
}

function forceSignOut(message) {
    if (unsubscribeFiles) unsubscribeFiles();
    if (unsubscribeUsers) unsubscribeUsers();
    
    signOut(auth).then(() => {
        currentUserProfile = null;
        showLoginView();
        if (message && errorMsg) errorMsg.textContent = message;
    });
}

function showLoginView() {
    if (dashboardScreen) dashboardScreen.classList.add("hidden");
    if (loginScreen) loginScreen.classList.remove("hidden");
    if (greetingSpinner) greetingSpinner.classList.add("hidden");
    if (greetingText) greetingText.textContent = "Hi, Yug";
    if (emailInput) emailInput.value = "";
    if (passwordInput) passwordInput.value = "";
}

// =========================================
// 4. DASHBOARD INTERFACE CONTROLLER
// =========================================
function setupDashboardUI() {
    if (!currentUserProfile) return; 

    if (loginScreen) loginScreen.classList.add("hidden");
    if (dashboardScreen) dashboardScreen.classList.remove("hidden");
    if (greetingSpinner) greetingSpinner.classList.add("hidden");

    if (userDisplayName) userDisplayName.textContent = currentUserProfile.username || "Authorized User";
    if (userRoleBadge) userRoleBadge.textContent = (currentUserProfile.role || "User").replace("_", " ");

    // Admin Panel Isolation Layer
    if (adminSection) {
        if (currentUserProfile.role === "primary_owner") {
            adminSection.classList.remove("hidden");
            syncUsersRealtime();
        } else {
            adminSection.classList.add("hidden");
        }
    }

    syncFilesRealtime();
}

// =========================================
// 5. FILE MANAGEMENT & AUTO-DRIVE ROUTING
// =========================================
if (uploadBtn) {
    uploadBtn.addEventListener("click", () => {
        const file = fileChooser.files[0];
        if (!file) return alert("Please select a file first.");

        if (file.size > 20 * 1024 * 1024) {
            return alert("File is too large! Maximum allowed cap via web routing is 20MB.");
        }

        uploadBtn.disabled = true;
        uploadBtn.textContent = "Analyzing Payload...";

        const reader = new FileReader();
        reader.onload = async function (e) {
            const filePayload = {
                name: file.name,
                fileData: e.target.result,
                uploadedBy: currentUserProfile ? currentUserProfile.username : "Anonymous",
                timestamp: Date.now()
            };

            // AUTO ROUTER LOGIC SWITCH
            if (file.size <= 750 * 1024) {
                uploadBtn.textContent = "Storing in Database...";
                try {
                    await addDoc(collection(db, "files"), {
                        name: filePayload.name,
                        fileData: filePayload.fileData,
                        uploadedBy: filePayload.uploadedBy,
                        timestamp: filePayload.timestamp,
                        isDriveFile: false
                    });
                    fileChooser.value = "";
                    alert("Saved directly to cloud database!");
                } catch (err) {
                    alert("Database write error.");
                } finally {
                    resetUploadState();
                }
            } else {
                uploadBtn.textContent = "Forwarding to Google Drive...";
                try {
                    const response = await fetch(GOOGLE_DRIVE_BRIDGE_URL, {
                        method: "POST",
                        mode: "cors",
                        body: JSON.stringify(filePayload)
                    });
                    
                    const result = await response.json();

                    if (result.status === "success") {
                        await addDoc(collection(db, "files"), {
                            name: "[Drive] " + file.name,
                            fileData: result.downloadUrl, 
                            uploadedBy: currentUserProfile ? currentUserProfile.username : "Anonymous",
                            timestamp: Date.now(),
                            isDriveFile: true
                        });
                        fileChooser.value = "";
                        alert("Large file successfully routed to Google Drive!");
                    } else {
                        alert("Drive storage error: " + result.message);
                    }
                } catch (netErr) {
                    alert("Routing handoff error. Check connection profile.");
                } finally {
                    resetUploadState();
                }
            }
        };
        reader.readAsDataURL(file);
    });
}

function resetUploadState() {
    if (uploadBtn) {
        uploadBtn.disabled = false;
        uploadBtn.textContent = "Upload to Cloud";
    }
}

function syncFilesRealtime() {
    if (unsubscribeFiles) unsubscribeFiles();
    if (!filesGrid) return;

    unsubscribeFiles = onSnapshot(collection(db, "files"), (snapshot) => {
        filesGrid.innerHTML = "";
        
        if (snapshot.empty) {
            filesGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 1rem;">No files uploaded yet.</div>`;
            return;
        }

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const id = docSnap.id;
            
            const card = document.createElement("div");
            card.className = "file-card";
            
            const icon = data.isDriveFile ? "☁️" : "📄";
            const isOwner = currentUserProfile && currentUserProfile.role === 'primary_owner';
            
            card.innerHTML = `
                <span class="file-icon">${icon}</span>
                <h4 title="${data.name}">${data.name}</h4>
                <p class="user-meta" style="margin-bottom: 12px;">By: ${data.uploadedBy}</p>
                <div class="file-actions-row">
                    <a href="${data.fileData}" download="${data.name}" target="_blank" class="file-action">Fetch</a>
                    <button class="file-action delete ${isOwner ? '' : 'hidden'}" data-id="${id}">Purge</button>
                </div>
            `;
            
            filesGrid.appendChild(card);
        });

        document.querySelectorAll(".file-action.delete").forEach(btn => {
            btn.addEventListener("click", async (e) => {
                if(confirm("Permanently delete this file?")) {
                    await deleteDoc(doc(db, "files", e.target.dataset.id));
                }
            });
        });
    });
}

// =========================================
// 6. ADMIN SYSTEM (MANAGED USER LIST)
// =========================================
if (createUserForm) {
    createUserForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const username = newUsername.value.trim();
        const email = newEmail.value.trim();
        const password = newPassword.value;
        const role = newRole.value;

        try {
            const credential = await createUserWithEmailAndPassword(adminAuth, email, password);
            
            await setDoc(doc(db, "users", credential.user.uid), {
                username: username,
                email: email,
                role: role,
                createdAt: Date.now()
            });

            createUserForm.reset();
            alert(`Profile registered for ${username}!`);
        } catch (err) {
            alert("Registration failed: " + err.message);
        }
    });
}

function syncUsersRealtime() {
    if (unsubscribeUsers) unsubscribeUsers();
    if (!userListContainer) return;

    unsubscribeUsers = onSnapshot(collection(db, "users"), (snapshot) => {
        userListContainer.innerHTML = "";
        
        snapshot.forEach((docSnap) => {
            const uData = docSnap.data();
            const uId = docSnap.id;
            
            const div = document.createElement("div");
            div.className = "control-item";
            
            const isSelfOrOwner = uData.role === 'primary_owner';
            
            div.innerHTML = `
                <div>
                    <strong>${uData.username}</strong>
                    <span class="user-meta">${uData.email} — Role: <span class="badge">${uData.role}</span></span>
                </div>
                <button class="file-action delete ${isSelfOrOwner ? 'hidden' : ''}" data-uid="${uId}">Revoke</button>
            `;
            userListContainer.appendChild(div);
        });

        document.querySelectorAll("[data-uid]").forEach(btn => {
            btn.addEventListener("click", async (e) => {
                if (confirm("Revoke clearance and delete user account record?")) {
                    await deleteDoc(doc(db, "users", e.target.dataset.uid));
                }
            });
        });
    });
                }
