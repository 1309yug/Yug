import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, addDoc, collection, onSnapshot, query, orderBy, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// =========================================
// 1. CONFIGURATION & CORE INITIALIZATION
// =========================================
const firebaseConfig = {
    apiKey: "YOUR_FIREBASE_API_KEY",
    authDomain: "AIzaSyA-K36hLL8Q8aOl9ETgK24QKP4r6NfYOTM",",
    projectId: "YOUR_FIREBASE_PROJECT_ID",
    storageBucket: "YOUR_FIREBASE_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Main App instance
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Isolated Admin Instance for creating users without logging out
const adminApp = initializeApp(firebaseConfig, "AdminInstance");
const adminAuth = getAuth(adminApp);

// Google Drive Middleware Endpoint
const GOOGLE_DRIVE_BRIDGE_URL = "https://script.google.com/macros/s/AKfycbziyQgjaHiPKBZ6p3GeOTt4-yvQRyLMIRUMC3B-nR74P1bS0FvMIKSmOVIkuGYZK5Yk/exec";

let currentUserProfile = null;

// =========================================
// 2. DOM ELEMENTS
// =========================================
const authScreen = document.getElementById("auth-screen");
const dashboardScreen = document.getElementById("dashboard-screen");
const loginForm = document.getElementById("login-form");
const emailInput = document.getElementById("email-input");
const passwordInput = document.getElementById("password-input");
const authError = document.getElementById("auth-error");

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
// 3. AUTHENTICATION FLOW
// =========================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        showLoginSpinner(true);
        try {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists()) {
                currentUserProfile = userDoc.data();
                setupDashboardUI();
                initRealtimeSyncs();
            } else {
                handleLogout();
                alert("Account record missing from system database.");
            }
        } catch (err) {
            alert("Error fetching user session details.");
        } finally {
            showLoginSpinner(false);
        }
    } else {
        showAuthScreen();
    }
});

if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        authError.textContent = "";
        const email = emailInput.value.trim();
        const password = passwordInput.value;

        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (err) {
            authError.textContent = "Invalid credentials. Please verify your email and password.";
        }
    });
}

if (logoutBtn) {
    logoutBtn.addEventListener("click", handleLogout);
}

function handleLogout() {
    signOut(auth).then(() => showAuthScreen());
}

function showAuthScreen() {
    currentUserProfile = null;
    dashboardScreen.classList.add("hidden");
    authScreen.classList.remove("hidden");
    loginForm.reset();
}

function showLoginSpinner(show) {
    if (show) {
        greetingText.textContent = "Checking profile...";
        greetingSpinner.classList.remove("hidden");
    } else {
        greetingSpinner.classList.add("hidden");
    }
}

// =========================================
// 4. DASHBOARD MANAGEMENT
// =========================================
function setupDashboardUI() {
    authScreen.classList.add("hidden");
    dashboardScreen.classList.remove("hidden");

    userDisplayName.textContent = currentUserProfile.username;
    userRoleBadge.textContent = currentUserProfile.role.replace("_", " ");

    if (currentUserProfile.role === "primary_owner") {
        adminSection.classList.remove("hidden");
    } else {
        adminSection.classList.add("hidden");
    }
}

function initRealtimeSyncs() {
    // Sync Files Grid
    const filesQuery = query(collection(db, "files"), orderBy("timestamp", "desc"));
    onSnapshot(filesQuery, (snapshot) => {
        filesGrid.innerHTML = "";
        if (snapshot.empty) {
            filesGrid.innerHTML = `<p class="subtitle" style="grid-column: 1/-1;">No files hosted yet.</p>`;
            return;
        }
        snapshot.forEach((docSnap) => {
            renderFileCard(docSnap.id, docSnap.data());
        });
    });

    // Sync User List for Admin Console
    if (currentUserProfile.role === "primary_owner") {
        const usersQuery = query(collection(db, "users"), orderBy("username", "asc"));
        onSnapshot(usersQuery, (snapshot) => {
            userListContainer.innerHTML = "";
            snapshot.forEach((docSnap) => {
                if (docSnap.id !== auth.currentUser.uid) {
                    renderUserControlRow(docSnap.id, docSnap.data());
                }
            });
        });
    }
}

// =========================================
// 5. FILE UPLOAD & HYBRID AUTO-ROUTING
// =========================================
if (uploadBtn) {
    uploadBtn.addEventListener("click", () => {
        const file = fileChooser.files[0];
        if (!file) return alert("Please pick a local file first!");
        
        // Block extreme files that will time out mobile browser memory limits
        if (file.size > 25 * 1024 * 1024) {
            return alert("File is too large. Please keep file uploads under 25MB.");
        }

        uploadBtn.disabled = true;
        uploadBtn.textContent = "Processing layout...";

        const reader = new FileReader();
        reader.onload = async function(e) {
            const filePayload = {
                name: file.name,
                fileData: e.target.result,
                uploadedBy: currentUserProfile.username,
                timestamp: Date.now()
            };

            // AUTO-ROUTE EVALUATOR
            if (file.size <= 750 * 1024) {
                // Route A: Internal native Firestore storage (Fast for files under 750KB)
                uploadBtn.textContent = "Uploading to database...";
                try {
                    await addDoc(collection(db, "files"), filePayload);
                    fileChooser.value = "";
                } catch(dbErr) {
                    alert("Database document storage failed.");
                } finally {
                    resetUploadButton();
                }
            } else {
                // Route B: Google Drive automation pipeline (Files above 750KB)
                uploadBtn.textContent = "Routing to Google Drive...";
                try {
                    const response = await fetch(GOOGLE_DRIVE_BRIDGE_URL, {
                        method: "POST",
                        mode: "cors",
                        body: JSON.stringify(filePayload)
                    });
                    
                    const result = await response.json();
                    
                    if (result.status === "success") {
                        // Create a tiny pointer item in Firestore referencing Google Drive URL
                        await addDoc(collection(db, "files"), {
                            name: "[Drive] " + file.name,
                            fileData: result.downloadUrl, 
                            uploadedBy: currentUserProfile.username,
                            timestamp: Date.now(),
                            isDriveFile: true
                        });
                        fileChooser.value = "";
                    } else {
                        alert("Google Drive Pipeline error: " + result.message);
                    }
                } catch (netErr) {
                    alert("Network transport error occurred routing payload to Google Drive.");
                } finally {
                    resetUploadButton();
                }
            }
        };
        reader.readAsDataURL(file);
    });
}

function resetUploadButton() {
    uploadBtn.disabled = false;
    uploadBtn.textContent = "Upload to Cloud";
}

function renderFileCard(id, data) {
    const fileCard = document.createElement("div");
    fileCard.className = "file-card";

    // Deduce file icons
    let icon = "📄";
    const nameLower = data.name.toLowerCase();
    if (nameLower.match(/\.(jpg|jpeg|png|gif|webp)$/)) icon = "🖼️";
    else if (nameLower.match(/\.(mp4|mkv|mov|avi)$/)) icon = "🎬";
    else if (nameLower.endsWith(".pdf")) icon = "📕";

    fileCard.innerHTML = `
        <span class="file-icon">${icon}</span>
        <h4 title="${data.name}">${data.name}</h4>
        <p class="user-meta" style="margin-bottom: 12px;">By: ${data.uploadedBy}</p>
        <div class="file-actions-row">
            <a href="${data.fileData}" download="${data.name}" target="_blank" class="file-action">View</a>
            ${currentUserProfile.role === 'primary_owner' ? `<button class="file-action delete" data-id="${id}">Delete</button>` : ''}
        </div>
    `;

    // Hook delete function cleanly
    const deleteBtn = fileCard.querySelector(".delete");
    if (deleteBtn) {
        deleteBtn.addEventListener("click", async () => {
            if (confirm(`Permanently remove "${data.name}"?`)) {
                await deleteDoc(doc(db, "files", id));
            }
        });
    }

    filesGrid.appendChild(fileCard);
}

// =========================================
// 6. ADMIN USER MANAGEMENT
// =========================================
if (createUserForm) {
    createUserForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const username = newUsername.value.trim();
        const email = newEmail.value.trim();
        const password = newPassword.value;
        const role = newRole.value;

        try {
            // Safe provisioning strategy through independent Auth Engine
            const credential = await createUserWithEmailAndPassword(adminAuth, email, password);
            
            await setDoc(doc(db, "users", credential.user.uid), {
                username: username,
                email: email,
                role: role
            });

            alert(`User account "${username}" provisioned successfully.`);
            createUserForm.reset();
            await signOut(adminAuth); // Flush the background admin pointer instantly
        } catch (err) {
            alert("Provisioning failed: " + err.message);
        }
    });
}

function renderUserControlRow(id, userData) {
    const row = document.createElement("div");
    row.className = "control-item";
    row.innerHTML = `
        <div>
            <strong>${userData.username}</strong>
            <span class="user-meta">${userData.email} | <span class="badge">${userData.role}</span></span>
        </div>
        <button class="btn btn-sm btn-secondary delete-user-btn" style="background-color: var(--danger);">Delete</button>
    `;

    row.querySelector(".delete-user-btn").addEventListener("click", async () => {
        if (confirm(`Are you completely sure you want to remove access for user account: "${userData.username}"? (Note: Authentication cleanup should be managed directly from your central Firebase Dashboard Console).`)) {
            await deleteDoc(doc(db, "users", id));
        }
    });

    userListContainer.appendChild(row);
              }
