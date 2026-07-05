import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, onSnapshot, updateDoc, addDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// Your integrated dynamic Firebase Project Configuration
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

// Initialize Modules
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

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

// --- AUTHENTICATION WORKFLOW ---
loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    errorMsg.textContent = "";
    signInWithEmailAndPassword(auth, emailInput.value.trim(), passwordInput.value).catch(err => {
        errorMsg.textContent = "Authentication failed: " + err.message;
    });
});

logoutBtn.addEventListener("click", () => {
    signOut(auth);
});

// Reactively watch Session State changes across frames
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // Fetch custom role profiles from Firestore
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
            const profile = userDoc.data();
            
            if (profile.suspended) {
                errorMsg.textContent = "Your account has been suspended.";
                signOut(auth);
                return;
            }
            
            currentUserProfile = { uid: user.uid, ...profile };
            setupDashboardUI();
        } else {
            errorMsg.textContent = "No authorization profile discovered.";
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

    // Privilege Escalation Matrix Setup
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

// --- PRIMARY OWNER ADMINISTRATIVE FUNCTIONS ---
addUserForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (currentUserProfile.role !== "primary_owner") return;

    const email = document.getElementById("new-user-email").value.trim();
    const role = document.getElementById("new-user-role").value;

    try {
        alert("Instruct user to register, or provision profile manually via Firestore console using their Unique UID entry.");
        await addDoc(collection(db, "pre_auth_roles"), { email, role, suspended: false });
        alert("Metadata profile indexed.");
        addUserForm.reset();
    } catch (err) {
        alert("Error mapping profile settings: " + err.message);
    }
});

function syncUserManagementList() {
    onSnapshot(collection(db, "users"), (snapshot) => {
        userManagementList.innerHTML = "";
        snapshot.forEach((docSnap) => {
            const uData = docSnap.data();
            if (uData.role === "primary_owner") return;

            const div = document.createElement("div");
            div.className = "control-item";
            div.innerHTML = `
                <div>
                    <div>${uData.email}</div>
                    <span class="user-meta">Post: ${uData.role}</span>
                </div>
                <button class="btn btn-sm" style="background:${uData.suspended ? '#22c55e' : '#ef4444'}">
                    ${uData.suspended ? 'Activate' : 'Suspend'}
                </button>
            `;
            
            div.querySelector("button").onclick = async () => {
                await updateDoc(doc(db, "users", docSnap.id), {
                    suspended: !uData.suspended
                });
            };
            userManagementList.appendChild(div);
        });
    });
}

// --- FILE STORAGE SYNCHRONIZATION WORKFLOW ---
const fileChooser = document.getElementById("file-chooser");
const uploadBtn = document.getElementById("upload-btn");
const progressContainer = document.getElementById("upload-progress");
const progressFill = document.getElementById("progress-fill");

uploadBtn.addEventListener("click", () => {
    const file = fileChooser.files[0];
    if (!file) return alert("Select a file first!");

    progressContainer.classList.remove("hidden");
    const storageRef = ref(storage, "vault/" + Date.now() + "_" + file.name);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on('state_changed', 
        (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            progressFill.style.width = progress + '%';
        }, 
        (error) => alert("Upload failed: " + error.message), 
        async () => {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            await addDoc(collection(db, "files"), {
                name: file.name,
                url: downloadURL,
                storagePath: storageRef.fullPath,
                uploadedBy: currentUserProfile.email,
                timestamp: Date.now()
            });
            progressContainer.classList.add("hidden");
            progressFill.style.width = '0%';
            fileChooser.value = "";
        }
    );
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
                    <a href="${file.url}" target="_blank" class="file-action">Open</a>
                    ${(currentUserProfile.role === 'primary_owner' || currentUserProfile.role === 'owner') ? `<span class="file-action delete" data-id="${docSnap.id}">Delete</span>` : ''}
                </div>
            `;
            
            const deleteAction = div.querySelector(".delete");
            if(deleteAction) {
                deleteAction.onclick = async () => {
                    if(confirm("Confirm file deletion from secure system?")) {
                        const fileRef = ref(storage, file.storagePath);
                        await deleteObject(fileRef);
                        await deleteDoc(doc(db, "files", docSnap.id));
                    }
                };
            }
            filesGrid.appendChild(div);
        });
    });
}
