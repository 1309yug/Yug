import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, createUserWithEmailAndPassword, setPersistence, browserSessionPersistence } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, onSnapshot, updateDoc, addDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBxBCEVsKlqNptzVwRF-J48CVttohJ4Gio",
  authDomain: "portal-12b64.firebaseapp.com",
  projectId: "portal-12b64",
  messagingSenderId: "888520414590",
  appId: "1:888520414590:web:5497213de6c627426b4f2f",
  measurementId: "G-1LFD3B30BP"
};

// Initialize the primary app for the active browser session
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Initialize a separate isolated instance to handle background user creation
const adminApp = initializeApp(firebaseConfig, "AdminInstance");
const adminAuth = getAuth(adminApp);

// DOM Elements
const loginForm = document.getElementById("login-form");
const usernameInput = document.getElementById("username-input");
const passwordInput = document.getElementById("password-input");
const errorMsg = document.getElementById("error-message");
const loginCard = document.getElementById("login-card");
const dashboard = document.getElementById("dashboard");
const userDisplayName = document.getElementById("user-display-name");
const roleBadge = document.getElementById("role-badge");
const logoutBtn = document.getElementById("logout-btn");
const ownerControls = document.getElementById("owner-controls");
const uploadSection = document.getElementById("upload-section");
const addUserForm = document.getElementById("add-user-form");
const userManagementList = document.getElementById("user-management-list");
const filesGrid = document.getElementById("files-grid");

let currentUserProfile = null;

// Your master admin username
const ADMIN_USERNAME = "Yug Patel"; 

const formatEmail = (username) => `${username.trim().toLowerCase()}@portal.local`;

// --- AUTHENTICATION WITH SESSION PERSISTENCE ---
if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        errorMsg.textContent = "Authenticating...";
        
        const fakeEmail = formatEmail(usernameInput.value);
        const password = passwordInput.value;
        
        try {
            // FORCE BROWSER SESSION PERSISTENCE: 
            // This guarantees your session tokens are wiped completely the split second the browser tab closes.
            await setPersistence(auth, browserSessionPersistence);
            await signInWithEmailAndPassword(auth, fakeEmail, password);
        } catch (err) {
            errorMsg.textContent = "Access Denied: Invalid credentials.";
        }
    });
}

if (logoutBtn) {
    logoutBtn.addEventListener("click", () => signOut(auth));
}

onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userRef = doc(db, "users", user.uid);
        let userDoc = await getDoc(userRef);
        const cleanUsername = user.email.split('@')[0];

        // Strict Admin Auto-Provisioning on first-ever run
        if (!userDoc.exists() && cleanUsername === ADMIN_USERNAME.toLowerCase()) {
            const newProfile = {
                username: cleanUsername,
                role: "primary_owner",
                suspended: false
            };
            await setDoc(userRef, newProfile);
            userDoc = await getDoc(userRef);
        }

        // If user credentials exist but profile doc is missing, log them out
        if (!userDoc.exists()) {
            errorMsg.textContent = "Account configuration error. Contact admin.";
            signOut(auth);
            return;
        }

        const profile = userDoc.data();
        if (profile.suspended) {
            errorMsg.textContent = "Your account has been suspended.";
            signOut(auth);
            return;
        }

        currentUserProfile = { uid: user.uid, ...profile };
        setupDashboardUI();
    } else {
        currentUserProfile = null;
        if (dashboard) dashboard.classList.add("hidden");
        if (loginCard) loginCard.classList.remove("hidden");
        if (usernameInput) usernameInput.value = "";
        if (passwordInput) passwordInput.value = "";
    }
});

function setupDashboardUI() {
    if (!currentUserProfile) return;
    
    loginCard.classList.add("hidden");
    dashboard.classList.remove("hidden");
    userDisplayName.textContent = `Logged in as: ${currentUserProfile.username}`;
    roleBadge.textContent = currentUserProfile.role;

    if (currentUserProfile.role === "primary_owner") {
        roleBadge.style.background = "#22c55e";
        ownerControls.classList.remove("hidden");
        uploadSection.classList.remove("hidden");
        syncUserManagementList();
    } else if (currentUserProfile.role === "owner") {
        roleBadge.style.background = "#3b82f6";
        ownerControls.classList.add("hidden");
        uploadSection.classList.remove("hidden");
    } else {
        roleBadge.style.background = "#64748b";
        ownerControls.classList.add("hidden");
        uploadSection.classList.add("hidden");
    }
    syncGlobalFiles();
}

// --- ADMIN CREATING USERS ---
if (addUserForm) {
    addUserForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!currentUserProfile || currentUserProfile.role !== "primary_owner") return;

        const rawInputUser = document.getElementById("new-username").value.trim();
        const newUserPass = document.getElementById("new-user-pass").value;
        const newUserRole = document.getElementById("new-user-role").value;
        
        const fakeEmail = formatEmail(rawInputUser);

        try {
            const userCredential = await createUserWithEmailAndPassword(adminAuth, fakeEmail, newUserPass);
            
            await setDoc(doc(db, "users", userCredential.user.uid), {
                username: rawInputUser.toLowerCase(),
                role: newUserRole,
                suspended: false
            });

            alert(`User "${rawInputUser}" successfully registered!`);
            addUserForm.reset();
            
            await signOut(adminAuth);
        } catch (err) {
            alert("Registration failed: " + err.message);
        }
    });
}

function syncUserManagementList() {
    onSnapshot(collection(db, "users"), (snapshot) => {
        userManagementList.innerHTML = "";
        snapshot.forEach((docSnap) => {
            const uData = docSnap.data();
            if (uData.role === "primary_owner") return;
            
            const div = document.createElement("div");
            div.className = "control-item";
            div.innerHTML = `
                <div><div>${uData.username}</div><span class="user-meta">Post: ${uData.role}</span></div>
                <button class="btn btn-sm" style="background:${uData.suspended ? '#22c55e' : '#ef4444'}">
                    ${uData.suspended ? 'Activate' : 'Suspend'}
                </button>
            `;
            div.querySelector("button").onclick = async () => {
                await updateDoc(doc(db, "users", docSnap.id), { suspended: !uData.suspended });
            };
            userManagementList.appendChild(div);
        });
    });
}

// --- FIXED FILE STORAGE HANDLING (SAVE TO CLOUD OPTION) ---
const fileChooser = document.getElementById("file-chooser");
const uploadBtn = document.getElementById("upload-btn");

if (uploadBtn) {
    uploadBtn.addEventListener("click", () => {
        const file = fileChooser.files[0];
        if (!file) return alert("Select a file first!");
        
        // Base64 encoding inflates data sizes by ~33%. 
        // 650KB ensures the converted text safely stays under Firestore's rigid 1MB document limit.
        if (file.size > 650 * 1024) {
            return alert("File too large! Must be under 650 KB to optimize free cloud database rules.");
        }

        uploadBtn.disabled = true;
        uploadBtn.textContent = "Uploading...";

        const reader = new FileReader();
        reader.onload = async function(e) {
            try {
                // Securely push payload map directly to Firestore 'files' collection
                await addDoc(collection(db, "files"), {
                    name: file.name,
                    fileData: e.target.result,
                    uploadedBy: currentUserProfile.username,
                    timestamp: Date.now()
                });
                alert("File successfully saved to cloud storage database!");
                fileChooser.value = "";
            } catch(dbErr) {
                alert("Cloud upload rejected: Verify network or security credentials.");
            } finally {
                uploadBtn.disabled = false;
                uploadBtn.textContent = "Upload to Cloud";
            }
        };
        
        reader.onerror = function() {
            alert("Error reading file on device.");
            uploadBtn.disabled = false;
            uploadBtn.textContent = "Upload to Cloud";
        };

        reader.readAsDataURL(file);
    });
}

function syncGlobalFiles() {
    onSnapshot(collection(db, "files"), (snapshot) => {
        if (!filesGrid) return;
        filesGrid.innerHTML = "";
        snapshot.forEach((docSnap) => {
            const file = docSnap.data();
            const div = document.createElement("div");
            div.className = "file-card";
            
            let icon = "📄";
            if(file.name.endsWith('.pdf')) icon = "📕";
            if(file.name.match(/\.(jpeg|jpg|png|gif)$/i)) icon = "🖼️";

            div.innerHTML = `
                <span class="file-icon">${icon}</span>
                <h4 title="${file.name}">${file.name}</h4>
                <div class="file-actions-row">
                    <a href="${file.fileData}" download="${file.name}" class="file-action">Download</a>
                    ${(currentUserProfile && (currentUserProfile.role === 'primary_owner' || currentUserProfile.role === 'owner')) ? `<span class="file-action delete">Delete</span>` : ''}
                </div>
            `;
            
            const deleteAction = div.querySelector(".delete");
            if(deleteAction) {
                deleteAction.onclick = async () => {
                    if(confirm("Permanently wipe this file from cloud?")) await deleteDoc(doc(db, "files", docSnap.id));
                };
            }
            filesGrid.appendChild(div);
        });
    });
}
