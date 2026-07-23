// =========================================
// 1. CONFIGURATION & STATE
// =========================================
const GOOGLE_DRIVE_BRIDGE_URL = "https://script.google.com/macros/s/AKfycbysoOct-aiVqwQ-oqydJPmpiqMOSFIAGGp8HfcrSHlonprOZOxdJPEAi-oTy_BSMZ8qdw/exec";

let currentUserProfile = null;

// Apply non-selection and micro-animations dynamically
const styleBlock = document.createElement("style");
styleBlock.textContent = `
  body, html, .card, .control-item, .file-card, h2, h3, h4, p, span, button {
    -webkit-user-select: none;
    user-select: none;
  }
  input, textarea, select {
    -webkit-user-select: text;
    user-select: text;
  }

  .file-meta-info {
    font-size: 0.75rem;
    color: var(--text-muted, #94a3b8);
    margin: 4px 0 10px 0;
  }

  .file-card {
    transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
  }

  .file-card:hover {
    transform: translateY(-4px);
    border-color: var(--accent, #3b82f6);
  }
`;
document.head.appendChild(styleBlock);

// =========================================
// 2. DOM SELECTORS
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
// 3. AUTHENTICATION
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
            if (errorMsg) errorMsg.textContent = "Network error. Check connection or script deployment.";
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
        if (currentUserProfile.role === "primary_owner" || currentUserProfile.role === "owner") {
            adminSection.classList.remove("hidden");
            syncUsersLive();
        } else {
            adminSection.classList.add("hidden");
        }
    }
    syncFilesLive(); 
}

// =========================================
// 4. USER MANAGEMENT (ADMIN PANEL)
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
                        ? `<button class="btn btn-sm status-toggle-btn" data-user="${user.username}" data-action="active" style="background:#22c55e; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">Activate</button>` 
                        : `<button class="btn btn-sm status-toggle-btn" data-user="${user.username}" data-action="suspended" style="background:#ef4444; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">Suspend</button>`;
                } else {
                    actionBtnHTML = `<span style="color:gray; font-size:12px; font-weight:bold;">Protected Master</span>`;
                }

                div.innerHTML = `
                    <div>
                        <strong>${user.username}</strong> 
                        <span style="font-size:11px; margin-left:8px; padding:3px 8px; border-radius:4px; ${badgeStyle}">${user.role.toUpperCase()}</span>
                        <span style="font-size:12px; margin-left:5px; color:${isSuspended ? '#ef4444':'#22c55e'}; font-weight:bold;">(${user.status})</span>
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
        userListContainer.innerHTML = "<p style='color:#ef4444;'>Failed to sync user directory.</p>";
    }
}

if (createUserForm) {
    createUserForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const username = newUsername.value.trim();
        const password = (newPassword && newPassword.value) ? newPassword.value : (newEmail.value || "12345"); 
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
                alert(`Account for "${username}" created!`);
                createUserForm.reset();
                syncUsersLive();
            } else {
                alert("Creation Failed: " + result.message);
            }
        } catch (err) {
            alert("Network error during user creation.");
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = "Create User";
        }
    });
}

// =========================================
// 5. FILE UPLOAD & DRIVE DELETION ENGINE
// =========================================
if (uploadBtn) {
    uploadBtn.addEventListener("click", () => {
        const file = fileChooser.files[0];
        if (!file) return alert("Select a file first.");

        uploadBtn.disabled = true;
        uploadBtn.textContent = "Uploading...";

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
                    alert("File successfully saved to Google Drive!");
                    syncFilesLive(); 
                } else {
                    alert("Upload Rejected: " + result.message);
                }
            } catch (err) {
                alert("Upload failure. Check your connection.");
            } finally {
                uploadBtn.disabled = false;
                uploadBtn.textContent = "Upload to Cloud";
            }
        };
        reader.readAsDataURL(file);
    });
}

// Utility: Map MimeType or Filename extension to an Icon
function getFileIcon(filename, mimeType) {
    if (mimeType) {
        if (mimeType.includes("pdf")) return "📄";
        if (mimeType.includes("image")) return "🖼️";
        if (mimeType.includes("video")) return "🎬";
        if (mimeType.includes("audio")) return "🎵";
        if (mimeType.includes("zip") || mimeType.includes("compressed")) return "📦";
        if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return "📊";
    }
    
    const ext = filename.split('.').pop().toLowerCase();
    switch (ext) {
        case 'pdf': return '📄';
        case 'png': case 'jpg': case 'jpeg': case 'webp': return '🖼️';
        case 'mp4': case 'mov': case 'avi': return '🎬';
        case 'mp3': case 'wav': return '🎵';
        case 'zip': case 'rar': case '7z': return '📦';
        case 'xls': case 'xlsx': case 'csv': return '📊';
        case 'doc': case 'docx': return '📝';
        default: return '📁';
    }
}

// Utility: Format raw bytes into readable string
function formatBytes(bytes) {
    if (!bytes || bytes === 0) return "Unknown size";
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

async function syncFilesLive() {
    if (!filesGrid) return;
    filesGrid.innerHTML = "<div style='grid-column: 1/-1; text-align: center; color: gray;'>Loading cloud documents...</div>";

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

            result.files.forEach((file) => {
                const card = document.createElement("div");
                card.className = "file-card";
                
                const icon = getFileIcon(file.name, file.mimeType);
                const sizeStr = formatBytes(file.size);
                
                card.innerHTML = `
                    <span class="file-icon" style="font-size:2.5rem; display:block; margin-bottom:8px;">${icon}</span>
                    <h4 title="${file.name}">${file.name}</h4>
                    <p class="user-meta">By: ${file.by}</p>
                    <div class="file-meta-info">${sizeStr} ${file.date ? '• ' + file.date : ''}</div>
                    <div class="file-actions-row" style="display:flex; gap:8px;">
                        <a href="${file.url}" target="_blank" class="file-action" style="flex:1; text-align:center;">📥 Open</a>
                        <button class="file-action delete-file-btn" data-id="${file.id}" data-url="${file.url}" style="background:#ef4444; color:white; border:none; border-radius:4px; padding:6px 12px; cursor:pointer;">❌</button>
                    </div>
                `;
                filesGrid.appendChild(card);
            });

            document.querySelectorAll(".delete-file-btn").forEach(btn => {
                btn.addEventListener("click", async (e) => {
                    const fileId = e.currentTarget.dataset.id;
                    const fileUrl = e.currentTarget.dataset.url;
                    
                    if (confirm("Permanently remove this document from Google Drive and database?")) {
                        e.currentTarget.disabled = true;
                        e.currentTarget.textContent = "...";
                        
                        const deleteRes = await fetch(GOOGLE_DRIVE_BRIDGE_URL, {
                            method: "POST",
                            body: JSON.stringify({ 
                                action: "deleteFile", 
                                fileId: fileId, 
                                url: fileUrl 
                            })
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
        filesGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #ef4444;">Failed to retrieve files from sheet registry.</div>`;
    }
}
