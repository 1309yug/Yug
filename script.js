import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, onSnapshot, updateDoc, addDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBxBCEVsKlqNptzVwRF-J48CVttohJ4Gio",
  authDomain: "portal-12b64.firebaseapp.com",
  projectId: "portal-12b64",
  messagingSenderId: "888520414590",
  appId: "1:888520414590:web:5497213de6c627426b4f2f",
  measurementId: "G-1LFD3B30BP"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM Elements
const loginForm = document.getElementById("login-form");
const emailInput = document.getElementById("email-input");
const passwordInput = document.getElementById("password-input");
const errorMsg = document.getElementById("error-message");
const loginCard = document.getElementById("login-card");
const dashboard = document.getElementById("dashboard");
const userDisplayEmail = document.getElementById("user-display-email");
const roleBadge = document.getElementById("role-badge");
const logoutBtn = document.getElementById("logout-btn");
const ownerControls = document.getElementById("owner-controls");
const uploadSection = document.getElementById("upload-section");
const addUserForm = document.getElementById("add-user-form");
const userManagementList = document.getElementById("user-management-list");
const filesGrid = document.getElementById("files-grid");

let currentUserProfile = null;

// --- AUTHENTICATION ---
loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    errorMsg.textContent = "";
    signInWithEmailAndPassword(auth, emailInput.value.trim(), passwordInput.value).catch(err => {
        errorMsg.textContent = "Login Failed: " + err.message;
    });
});

logoutBtn.addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
            const profile = userDoc.data();
            if (profile.suspended) {
                errorMsg.textContent = "Account suspended.";
                signOut(auth);
                return;
            }
            currentUserProfile = { uid: user.uid, ...profile };
            setupDashboardUI();
        } else {
            errorMsg.textContent = "No profile found.";
            signOut(auth);
        }
    } else {
        currentUserProfile = null;
        dashboard.classList.add("hidden");
        loginCard.classList.remove("hidden");
    }
});

function setupDashboardUI() {
    loginCard.classList.add("hidden");
    dashboard.classList.remove("hidden");
    userDisplayEmail.textContent = currentUserProfile.email;
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

// --- ADMIN USERS ---
function syncUserManagementList() {
    onSnapshot(collection(db, "users"), (snapshot) => {
        userManagementList.innerHTML = "";
        snapshot.forEach((docSnap) => {
            const uData = docSnap.data();
            if (uData.role === "primary_owner") return;
            const div = document.createElement("div");
            div.className = "control-item";
            div.innerHTML = `
                <div><div>${uData.email}</div><span class="user-meta">Post: ${uData.role}</span></div>
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

// --- FREE FILE SYNC WORKFLOW (BASE64) ---
const fileChooser = document.getElementById("file-chooser");
const uploadBtn = document.getElementById("upload-btn");

uploadBtn.addEventListener("click", () => {
    const file = fileChooser.files[0];
    if (!file) return alert("Select a file first!");
    
    if (file.size > 1024 * 1024) {
        return alert("File is too large! In the 100% free plan, files must be under 1 MB.");
    }

    const reader = new FileReader();
    reader.onload = async function(e) {
        const base64Data = e.target.result; // Raw file converted to text string
        
        await addDoc(collection(db, "files"), {
            name: file.name,
            fileData: base64Data, // Save directly to free database
            uploadedBy: currentUserProfile.email,
            timestamp: Date.now()
        });
        
        alert("File synchronized successfully!");
        fileChooser.value = "";
    };
    reader.readAsDataURL(file);
});

function syncGlobalFiles() {
    onSnapshot(collection(db, "files"), (snapshot) => {
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
                    ${(currentUserProfile.role === 'primary_owner' || currentUserProfile.role === 'owner') ? `<span class="file-action delete">Delete</span>` : ''}
                </div>
            `;
            
            const deleteAction = div.querySelector(".delete");
            if(deleteAction) {
                deleteAction.onclick = async () => {
                    if(confirm("Delete this file?")) {
                        await deleteDoc(doc(db, "files", docSnap.id));
                    }
                };
            }
            filesGrid.appendChild(div);
        });
    });
}
