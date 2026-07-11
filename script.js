// =========================================
// 1. CONFIGURATION (INTEGRATED LIVE URL)
// =========================================
const GOOGLE_DRIVE_BRIDGE_URL = "https://script.google.com/macros/s/AKfycbwAScoy0Wxl0jcssdKXmKuNEyxxNhWD_9wSkHfmnsnXZ-siycumy3WAtHzKFBFvlw6S/exec";

// Global Session States
let currentUserProfile = null;

// Apply global CSS rules, custom transitions, animations, and non-selection layers programmatically
const styleBlock = document.createElement("style");
styleBlock.textContent = `
  /* --- 1. Prevent Text Selection --- */
  body, html, .card, .control-item, .file-card, h2, h3, h4, p, span, button {
    -webkit-user-select: none;
    -ms-user-select: none;
    user-select: none;
  }
  input, textarea, select {
    -webkit-user-select: text;
    -ms-user-select: text;
    user-select: text;
  }

  /* --- 2. Screen Handoff Animations (Fade & Slide Up) --- */
  #login-screen, #dashboard-screen {
    opacity: 0;
    transform: translateY(15px);
    animation: screenEntrance 0.5s cubic-bezier(0.25, 1, 0.5, 1) forwards;
    transition: opacity 0.4s ease, transform 0.4s ease;
  }

  @keyframes screenEntrance {
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* Utility class to handle hidden states cleanly */
  .hidden {
    display: none !important;
    opacity: 0 !important;
  }

  /* --- 3. Interactive Component Micro-animations --- */
  .file-card {
    transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), 
                box-shadow 0.3s ease, 
                border-color 0.3s ease;
    will-change: transform, box-shadow;
  }

  /* Elevate file cards slightly on user interaction */
  .file-card:hover, .file-card:active {
    transform: translateY(-6px) scale(1.02);
    box-shadow: 0 10px 20px rgba(0,0,0,0.12);
    border-color: #3498db;
  }

  /* Button bounce effects */
  button, .file-action {
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    overflow: hidden;
  }

  button:active, .file-action:active {
    transform: scale(0.95);
    filter: brightness(0.9);
  }

  /* Smooth list items loading in sequence */
  .control-item {
    transition: background-color 0.2s ease, transform 0.2s ease;
    animation: itemPopIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) backwards;
  }
  
  .control-item:hover {
    background-color: #fcfcfc;
    transform: scale(1.005);
  }

  @keyframes itemPopIn {
    0% {
      opacity: 0;
      transform: scale(0.96) translateY(5px);
    }
    100% {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  /* --- 4. Loading State Animations --- */
  .spinner-pulse {
    display: inline-block;
    animation: subtlePulse 1.4s infinite ease-in-out;
  }

  @keyframes subtlePulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(0.92); opacity: 0.6; }
  }
`;
document.head.appendChild(styleBlock);

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

// Administrative Control Panel Selectors
const adminSection = document.getElementById("admin-section");
const createUserForm = document.getElementById("create-user-form");
const newUsername = document.getElementById("new-username");
const newEmail = document.getElementById("new-email"); 
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
    
    if (adminSection) {
        if (currentUserProfile.role === "primary_owner") {
            adminSection.classList.remove("hidden");
            syncUsersLive();
        } else {
            adminSection.classList.add("hidden");
        }
    }
    syncFilesLive(); 
}

// =========================================
// 4. LIVE WEB MANAGEMENT METHODS (OWNER MODE)
// =========================================
async function syncUsersLive() {
    if (!userListContainer) return;
    userListContainer.innerHTML = "<p style='color:gray;' class='spinner-pulse'>Refreshing user directory...</p>";

    try {
        const response = await fetch(GOOGLE_DRIVE_BRIDGE_URL, {
            method: "POST",
            body: JSON.stringify({ action: "getUsers" })
        });
        const result = await response.json();

        if (result.status === "success") {
            userListContainer.innerHTML = "";
            result.users.forEach((user, index) => {
                const div = document.createElement("div");
                div.className = "control-item";
                div.style = `display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eee; padding: 10px 0; animation-delay: ${index * 0.05}s;`;
                
                const isOwner = user.role === "primary_owner";
                const isSuspended = user.status === "suspended";
                
                let badgeStyle = "background:#7f8c8d; color:white;"; 
                if (user.role === "primary_owner") {
                    badgeStyle = "background:#2c3e50; color:white; font-weight:bold;"; 
                } else if (user.role === "owner") {
                    badgeStyle = "background:#16a085; color:white;"; 
                }

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
                        <span style="font-size:11px; margin-left:8px; padding:3px 8px; border-radius:4px; ${badgeStyle}">${user.role.toUpperCase()}</span>
                        <span style="font-size:12px; margin-left:5px; color:${isSuspended ? '#ff4d4d':'#2ecc71'}; font-weight:bold;">(${user.status})</span>
                    </div>
                    <div>${actionBtnHTML}</div>
                `;
                userListContainer.appendChild(div);
            });

            document.querySelectorAll(".status-toggle-btn").forEach(btn => {
                btn.addEventListener("click", async (e) => {
                    const targetUser = e.target.dataset.user;
                    const nextStatus = e.target.dataset.action;
                    
                    e.target.disabled = true;
                    e.target.textContent = "Syncing...";
                    
                    const res = await fetch(GOOGLE_DRIVE_BRIDGE_URL, {
                        method: "POST",
                        body: JSON.stringify({ action: "toggleStatus", username: targetUser, status: nextStatus })
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

if (createUserForm) {
    createUserForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const username = newUsername.value.trim();
        const password = newEmail.value || "12345"; 
        const role = newRole.value;

        const submitBtn = createUserForm.querySelector("button[type='submit']");
        submitBtn.disabled = true;
        submitBtn.textContent = "Provisioning...";

        try {
            const response = await fetch(GOOGLE_DRIVE_BRIDGE_URL, {
                method: "POST",
                body: JSON.stringify({ action: "addUser", username: username, password: password, role: role })
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
// 5. DIRECT GOOGLE DRIVE FILE STREAMER & PERSISTENT REMOVAL
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
                        fileData: e.target.result,
                        uploadedBy: currentUserProfile.username
                    })
                });
                const result = await response.json();

                if (result.status === "success") {
                    fileChooser.value = "";
                    alert("File successfully saved directly to your Google Drive and Spreadsheet registry!");
                    syncFilesLive(); 
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

async function syncFilesLive() {
    if (!filesGrid) return;
    filesGrid.innerHTML = "<div style='grid-column: 1/-1; text-align: center; color: gray;' class='spinner-pulse'>Loading secure file assets...</div>";

    try {
        const response = await fetch(GOOGLE_DRIVE_BRIDGE_URL, {
            method: "POST",
            body: JSON.stringify({ action: "getFiles" })
        });
        const result = await response.json();

        if (result.status === "success") {
            filesGrid.innerHTML = "";
            
            if (result.files.length === 0) {
                filesGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: gray; padding: 1rem;">No files uploaded yet.</div>`;
                return;
            }

            result.files.forEach((file, index) => {
                const card = document.createElement("div");
                card.className = "file-card";
                card.style = `animation: itemPopIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.1) backwards; animation-delay: ${index * 0.04}s;`;
                card.innerHTML = `
                    <span class="file-icon">☁️</span>
                    <h4>${file.name}</h4>
                    <p class="user-meta">By: ${file.by}</p>
                    <div class="file-actions-row" style="display:flex; gap:8px;">
                        <a href="${file.url}" target="_blank" class="file-action" style="flex:1; text-align:center;">Fetch</a>
                        <button class="file-action delete-file-btn" data-url="${file.url}" style="background:#e74c3c; color:white; border:none; border-radius:4px; padding:6px 12px; cursor:pointer;">Purge</button>
                    </div>
                `;
                filesGrid.appendChild(card);
            });

            document.querySelectorAll(".delete-file-btn").forEach(btn => {
                btn.addEventListener("click", async (e) => {
                    const fileUrl = e.currentTarget.dataset.url;
                    if (confirm("Permanently remove this document row reference from the cloud database?")) {
                        e.currentTarget.disabled = true;
                        e.currentTarget.textContent = "...";
                        
                        const deleteRes = await fetch(GOOGLE_DRIVE_BRIDGE_URL, {
                            method: "POST",
                            body: JSON.stringify({ action: "deleteFile", url: fileUrl })
                        });
                        const deleteResult = await deleteRes.json();
                        
                        if (deleteResult.status === "success") {
                            syncFilesLive(); 
                        } else {
                            alert("Deletion error: " + deleteResult.message);
                        }
                    }
                });
            });
        }
    } catch (err) {
        filesGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: red;">Failed to retrieve files from sheet registry.</div>`;
    }
}
