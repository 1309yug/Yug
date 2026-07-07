// =========================================
// 1. CONFIGURATION (INTEGRATED LIVE URL)
// =========================================
const GOOGLE_DRIVE_BRIDGE_URL = "https://script.google.com/macros/s/AKfycbztcC213f8GE4SZV6d7bUXdS7sUNLH34xPw9TYKzCmNmBqiLlKY1Iao9c-1aOPdWnar/exec";

// Global Session States
let currentUserProfile = null;
let simulatedFilesDB = []; 

// =========================================
// 2. DOM ELEMENT SELECTORS
// =========================================
const loginScreen = document.getElementById("login-screen");
const dashboardScreen = document.getElementById("dashboard-screen");
const loginForm = document.getElementById("login-form");
const emailInput = document.getElementById("email-input"); // Handled as Username box on the UI
const passwordInput = document.getElementById("password-input");
const errorMsg = document.getElementById("error-msg");

const greetingText = document.getElementById("greeting-text");
const greetingSpinner = document.getElementById("greeting-spinner");
const logoutBtn = document.getElementById("logout-btn");
const userDisplayName = document.getElementById("user-display-name");
const userRoleBadge = document.getElementById("user-role-badge");

// Administrative Control Panel Selectors
const adminSection = document.getElementById("admin-section");
const createUserForm = document.getElementById("create-user-form");
const newUsername = document.getElementById("new-username");
const newEmail = document.getElementById("new-email"); // Re-mapped as Password field in your HTML UI structure
const newRole = document.getElementById("new-role");
const userListContainer = document.getElementById("user-list-container");

const fileChooser = document.getElementById("file-chooser");
const uploadBtn = document.getElementById("upload-btn");
const filesGrid = document.getElementById("files-grid");

// =========================================
// 3. SECURE SHEET AUTHENTICATION ENGINE
// =========================================
if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (errorMsg) errorMsg.textContent = "";
        
        const username = emailInput.value.trim();
        const password = passwordInput.value;

        if (greetingText) greetingText.textContent = "Verifying...";
        if (greetingSpinner) greetingSpinner.classList.remove("hidden");

        try {
            // Ping your updated Apps Script engine directly 
            const response = await fetch(GOOGLE_DRIVE_BRIDGE_URL, {
                method: "POST",
                body: JSON.stringify({ 
                    action: "login", 
                    username: username, 
                    password: password 
                })
            });
            const result = await response.json();
            
            if (result.status === "success") {
                currentUserProfile = { 
                    username: result.username, 
                    role: result.role 
                };
                setupDashboardUI();
            } else {
                resetLoginUI();
                if (errorMsg) errorMsg.textContent = result.message || "Access denied.";
            }
        } catch (err) {
            resetLoginUI();
            if (errorMsg) errorMsg.textContent = "Network error. Ensure Web App is deployed as 'Anyone'.";
        }
    });
}

function resetLoginUI() {
    if (greetingText) greetingText.textContent = "Hi, Yug";
    if (greetingSpinner) greetingSpinner.classList.add("hidden");
}

if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
        currentUserProfile = null;
        if (dashboardScreen) dashboardScreen.classList.add("hidden");
        if (loginScreen) loginScreen.classList.remove("hidden");
        resetLoginUI();
    });
}

function setupDashboardUI() {
    if (loginScreen) loginScreen.classList.add("hidden");
    if (dashboardScreen) dashboardScreen.classList.remove("hidden");
    
    if (userDisplayName) userDisplayName.textContent = currentUserProfile.username;
    if (userRoleBadge) userRoleBadge.textContent = currentUserProfile.role.toUpperCase().replace("_", " ");
    
    // Check if logged-in user is primary_owner to unlock web-based user controls
    if (adminSection) {
        if (currentUserProfile.role === "primary_owner") {
            adminSection.classList.remove("hidden");
            syncUsersLive();
        } else {
            adminSection.classList.add("hidden");
        }
    }
    renderFiles();
}

// =========================================
// 4. LIVE WEB MANAGEMENT METHODS (OWNER MODE)
// =========================================
async function syncUsersLive() {
    if (!userListContainer) return;
    userListContainer.innerHTML = "<p style='color:gray;'>Refreshing user directory...</p>";

    try {
        const response = await fetch(GOOGLE_DRIVE_BRIDGE_URL, {
            method: "POST",
            body: JSON.stringify({ action: "getUsers" })
        });
        const result = await response.json();

        if (result.status === "success") {
            userListContainer.innerHTML = "";
            result.users.forEach((user) => {
                const div = document.createElement("div");
                div.className = "control-item";
                div.style = "display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eee; padding: 10px 0;";
                
                const isOwner = user.role === "primary_owner";
                const isSuspended = user.status === "suspended";
                
                let actionBtnHTML = "";
                if (!isOwner) {
                    actionBtnHTML = isSuspended 
                        ? `<button class="btn btn-sm status-toggle-btn" data-user="${user.username}" data-action="active" style="background:green; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">Activate</button>` 
                        : `<button class="btn btn-sm status-toggle-btn" data-user="${user.username}" data-action="suspended" style="background:red; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">Suspend</button>`;
                } else {
                    actionBtnHTML = `<span style="color:gray; font-size:12px; font-weight:bold;">Protected Master</span>`;
                }

                div.innerHTML = `
                    <div>
                        <strong>${user.username}</strong> 
                        <span style="font-size:11px; margin-left:8px; padding:2px 6px; background:#eee; border-radius:4px;">${user.role.toUpperCase()}</span>
                        <span style="font-size:12px; margin-left:5px; color:${isSuspended ? '#ff4d4d':'#2ecc71'}; font-weight:bold;">(${user.status})</span>
                    </div>
                    <div>${actionBtnHTML}</div>
                `;
                userListContainer.appendChild(div);
            });

            // Bind live activation and suspension event triggers
            document.querySelectorAll(".status-toggle-btn").forEach(btn => {
                btn.addEventListener("click", async (e) => {
                    const targetUser = e.target.dataset.user;
                    const nextStatus = e.target.dataset.action;
                    
                    e.target.disabled = true;
                    e.target.textContent = "Syncing...";
                    
                    const res = await fetch(GOOGLE_DRIVE_BRIDGE_URL, {
                        method: "POST",
                        body: JSON.stringify({ 
                            action: "toggleStatus", 
                            username: targetUser, 
                            status: nextStatus 
                        })
                    });
                    const toggleResult = await res.json();
                    
                    if (toggleResult.status === "success") {
                        syncUsersLive(); 
                    } else {
                        alert("Modification rejected: " + toggleResult.message);
                    }
                });
            });
        }
    } catch (err) {
        userListContainer.innerHTML = "<p style='color:red;'>Failed to dynamically sync user directories.</p>";
    }
}

// Handler for provisioning new accounts directly to Google Sheet
if (createUserForm) {
    createUserForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const username = newUsername.value.trim();
        const password = newEmail.value || "12345"; // Maps seamlessly into your UI's input fields
        const role = newRole.value;

        const submitBtn = createUserForm.querySelector("button[type='submit']");
        submitBtn.disabled = true;
        submitBtn.textContent = "Provisioning...";

        try {
            const response = await fetch(GOOGLE_DRIVE_BRIDGE_URL, {
                method: "POST",
                body: JSON.stringify({ 
                    action: "addUser", 
                    username: username, 
                    password: password, 
                    role: role 
                })
            });
            const result = await response.json();

            if (result.status === "success") {
                alert(`Account structure for "${username}" successfully saved to your spreadsheet!`);
                createUserForm.reset();
                syncUsersLive();
            } else {
                alert("Creation Failed: " + result.message);
            }
        } catch (err) {
            alert("Network routing handoff error during user creation.");
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = "Create User";
        }
    });
}

// =========================================
// 5. DIRECT GOOGLE DRIVE FILE STREAMER
// =========================================
if (uploadBtn) {
    uploadBtn.addEventListener("click", () => {
        const file = fileChooser.files[0];
        if (!file) return alert("Select a file first.");

        uploadBtn.disabled = true;
        uploadBtn.textContent = "Streaming to Drive...";

        const reader = new FileReader();
        reader.onload = async function (e) {
            try {
                const response = await fetch(GOOGLE_DRIVE_BRIDGE_URL, {
                    method: "POST",
                    body: JSON.stringify({ 
                        action: "upload", 
                        name: file.name, 
                        fileData: e.target.result 
                    })
                });
                const result = await response.json();

                if (result.status === "success") {
                    simulatedFilesDB.push({ 
                        name: file.name, 
                        url: result.downloadUrl, 
                        by: currentUserProfile.username 
                    });
                    fileChooser.value = "";
                    alert("File successfully saved directly to your Google Drive!");
                    renderFiles();
                } else {
                    alert("Storage Write Rejected: " + result.message);
                }
            } catch (err) {
                alert("Upload tracking failure.");
            } finally {
                uploadBtn.disabled = false;
                uploadBtn.textContent = "Upload to Cloud";
            }
        };
        reader.readAsDataURL(file);
    });
}

function renderFiles() {
    if (!filesGrid) return;
    filesGrid.innerHTML = "";
    
    if (simulatedFilesDB.length === 0) {
        filesGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: gray; padding: 1rem;">No files uploaded yet.</div>`;
        return;
    }
    
    simulatedFilesDB.forEach((file) => {
        const card = document.createElement("div");
        card.className = "file-card";
        card.innerHTML = `
            <span class="file-icon">☁️</span>
            <h4>${file.name}</h4>
            <p class="user-meta">By: ${file.by}</p>
            <div class="file-actions-row">
                <a href="${file.url}" target="_blank" class="file-action">Fetch</a>
            </div>
        `;
        filesGrid.appendChild(card);
    });
                    }
