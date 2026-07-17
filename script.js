// =========================================
// 1. CONFIGURATION (INTEGRATED LIVE URL)
// =========================================
const GOOGLE_DRIVE_BRIDGE_URL = "https://script.google.com/macros/s/AKfycbyJt5t5lg04gpQ6IT9cLxivJzWvmZFX4MeWniqQ1JCSp5Alc7lRioxn6Y0jEoU3wA81XA/exec";

// Global Session States
let currentUserProfile = null;

// Apply UI system CSS rules programmatically
const styleBlock = document.createElement("style");
styleBlock.textContent = `
  body, html, .card, .control-item, .file-card, h2, h3, h4, p, span, button {
    -webkit-user-select: none; user-select: none;
  }
  input, textarea, select {
    -webkit-user-select: text; user-select: text;
  }
  #login-screen, #dashboard-screen {
    opacity: 0; transform: translateY(15px);
    animation: screenEntrance 0.5s cubic-bezier(0.25, 1, 0.5, 1) forwards;
  }
  @keyframes screenEntrance { to { opacity: 1; transform: translateY(0); } }
  .hidden { display: none !important; opacity: 0 !important; }
  .file-card {
    transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.3s ease;
  }
  .file-card:hover { transform: translateY(-6px); box-shadow: 0 10px 20px rgba(0,0,0,0.12); }
  button:active, .file-action:active { transform: scale(0.95); }
  .spinner-pulse { animation: subtlePulse 1.4s infinite ease-in-out; }
  @keyframes subtlePulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
`;
document.head.appendChild(styleBlock);

// Run everything ONLY after the DOM (HTML) is fully loaded to prevent null selections
document.addEventListener("DOMContentLoaded", () => {

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

    // Administrative & Upload Sections
    const adminSection = document.getElementById("admin-section");
    const uploadContainer = document.getElementById("upload-container");
    const fileChooser = document.getElementById("file-chooser");
    const uploadBtn = document.getElementById("upload-btn");
    const filesGrid = document.getElementById("files-grid");

    // Failed login tracker reference
    let failedLogsContainer = document.getElementById("failed-logs-container");

    // =========================================
    // 3. SECURE SHEET AUTHENTICATION ENGINE
    // =========================================
    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            if (errorMsg) errorMsg.textContent = "";
            
            // Safe check for inputs
            const username = emailInput ? emailInput.value.trim() : "";
            const password = passwordInput ? passwordInput.value : "";

            if (greetingText) greetingText.textContent = "Verifying...";
            if (greetingSpinner) greetingSpinner.classList.remove("hidden");

            try {
                const response = await fetch(GOOGLE_DRIVE_BRIDGE_URL, {
                    method: "POST",
                    body: JSON.stringify({ action: "login", username: username, password: password })
                });
                const result = await response.json();
                
                if (result.status === "success") {
                    currentUserProfile = { username: result.username, role: result.role };
                    setupDashboardUI();
                } else {
                    resetLoginUI();
                    if (errorMsg) errorMsg.textContent = result.message || "Access denied.";
                }
            } catch (err) {
                resetLoginUI();
                if (errorMsg) errorMsg.textContent = "Network error connection failed.";
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
        
        // VIEWER RESTRICTION: Hide upload components
        if (uploadContainer) {
            if (currentUserProfile.role === "viewer") {
                uploadContainer.classList.add("hidden");
            } else {
                uploadContainer.classList.remove("hidden");
            }
        }

        // PRIMARY OWNER ACCESS: Display control blocks and audit tracking logs
        if (adminSection) {
            if (currentUserProfile.role === "primary_owner") {
                adminSection.classList.remove("hidden");
                syncUsersLive();
                syncFailedSecurityLogs();
            } else {
                adminSection.classList.add("hidden");
            }
        }
        syncFilesLive(); 
    }

    // =========================================
    // 4. SECURITY AUDITING & SYSTEM LOGS
    // =========================================
    async function syncFailedSecurityLogs() {
        if (!failedLogsContainer && adminSection) {
            failedLogsContainer = document.createElement("div");
            failedLogsContainer.id = "failed-logs-container";
            failedLogsContainer.style = "margin-top:20px; padding:15px; background:#fdf2f2; border:1px solid #f5c6cb; border-radius:6px;";
            adminSection.appendChild(failedLogsContainer);
        }
        
        if (failedLogsContainer) {
            failedLogsContainer.innerHTML = "<h4 style='color:#721c24; margin-top:0;'>⚠️ Security Audit Logs (Failed Passwords)</h4><p class='spinner-pulse'>Retrieving database checks...</p>";
        }

        try {
            const response = await fetch(GOOGLE_DRIVE_BRIDGE_URL, {
                method: "POST",
                body: JSON.stringify({ action: "getFailedLogs" })
            });
            const result = await response.json();

            if (result.status === "success" && failedLogsContainer) {
                failedLogsContainer.innerHTML = "<h4 style='color:#721c24; margin-top:0;'>⚠️ Security Audit Logs (Failed Passwords)</h4>";
                if (result.logs.length === 0) {
                    failedLogsContainer.innerHTML += "<p style='color:green; font-size:13px;'>No suspicious login failures detected.</p>";
                    return;
                }
                result.logs.forEach(log => {
                    const item = document.createElement("div");
                    item.style = "font-size:12px; border-bottom:1px solid #f5c6cb; padding:6px 0; color:#721c24;";
                    const formattedTime = new Date(log.time).toLocaleString();
                    item.innerHTML = `Target User: <strong>${log.username}</strong> — Attempt Timestamp: <em>${formattedTime}</em>`;
                    failedLogsContainer.appendChild(item);
                });
            }
        } catch(e) {
            if (failedLogsContainer) {
                failedLogsContainer.innerHTML = "<p style='color:red;'>Failed to load audit history.</p>";
            }
        }
    }

    // =========================================
    // 5. FILE SYNC ENGINE (VIEWER HANDLING)
    // =========================================
    async function syncFilesLive() {
        if (!filesGrid) return;
        filesGrid.innerHTML = "<div style='grid-column:1/-1; text-align:center;' class='spinner-pulse'>Loading files...</div>";

        try {
            const response = await fetch(GOOGLE_DRIVE_BRIDGE_URL, {
                method: "POST",
                body: JSON.stringify({ action: "getFiles" })
            });
            const result = await response.json();

            if (result.status === "success") {
                filesGrid.innerHTML = "";
                
                if (result.files.length === 0) {
                    filesGrid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:1rem;">No asset records found.</div>`;
                    return;
                }

                result.files.forEach((file) => {
                    const card = document.createElement("div");
                    card.className = "file-card";
                    
                    // Show delete button only if user is NOT a viewer
                    const deleteButtonHTML = (currentUserProfile.role !== "viewer") 
                        ? `<button class="file-action delete-file-btn" data-url="${file.url}" style="background:#e74c3c; color:white; border:none; border-radius:4px; padding:6px 12px; cursor:pointer;">Purge</button>`
                        : "";

                    card.innerHTML = `
                        <span class="file-icon">☁️</span>
                        <h4>${file.name}</h4>
                        <p class="user-meta">By: ${file.by}</p>
                        <div class="file-actions-row" style="display:flex; gap:8px;">
                            <a href="${file.url}" target="_blank" class="file-action" style="flex:1; text-align:center; background:#3498db; color:white; text-decoration:none; padding:6px; border-radius:4px;">Fetch / Download</a>
                            ${deleteButtonHTML}
                        </div>
                    `;
                    filesGrid.appendChild(card);
                });

                document.querySelectorAll(".delete-file-btn").forEach(btn => {
                    btn.addEventListener("click", async (e) => {
                        const fileUrl = e.currentTarget.dataset.url;
                        if (confirm("Permanently drop this file row resource?")) {
                            e.currentTarget.disabled = true;
                            
                            const deleteRes = await fetch(GOOGLE_DRIVE_BRIDGE_URL, {
                                method: "POST",
                                body: JSON.stringify({ action: "deleteFile", url: fileUrl, triggeredBy: currentUserProfile.username })
                            });
                            const deleteResult = await deleteRes.json();
                            if (deleteResult.status === "success") {
                                syncFilesLive();
                            } else {
                                alert(deleteResult.message);
                            }
                        }
                    });
                });
            }
        } catch (err) {
            filesGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: red;">Error pulling file array.</div>`;
        }
    }

    // =========================================
    // 6. MANAGEMENT INTERFACE SYNCING
    // =========================================
    async function syncUsersLive() {
        const userListContainer = document.getElementById("user-list-container");
        if (!userListContainer) return;
        userListContainer.innerHTML = "<p>Updating dynamic registry...</p>";

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
                    div.style = "display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #eee;";
                    
                    const isOwner = user.role === "primary_owner";
                    const isSuspended = user.status === "suspended";
                    const actionBtnHTML = !isOwner 
                        ? `<button class="status-toggle-btn" data-user="${user.username}" data-action="${isSuspended?'active':'suspended'}" style="background:${isSuspended?'green':'red'}; color:white; border:none; padding:4px; border-radius:4px; cursor:pointer;">${isSuspended?'Activate':'Suspend'}</button>`
                        : `<span>Master</span>`;

                    div.innerHTML = `<div><strong>${user.username}</strong> [${user.role.toUpperCase()}] (${user.status})</div><div>${actionBtnHTML}</div>`;
                    userListContainer.appendChild(div);
                });

                document.querySelectorAll(".status-toggle-btn").forEach(btn => {
                    btn.addEventListener("click", async (e) => {
                        e.target.disabled = true;
                        await fetch(GOOGLE_DRIVE_BRIDGE_URL, {
                            method: "POST",
                            body: JSON.stringify({ action: "toggleStatus", username: e.target.dataset.user, status: e.target.dataset.action, triggeredBy: currentUserProfile.username })
                        });
                        syncUsersLive();
                    });
                });
            }
        } catch(e){}
    }

    if (uploadBtn) {
        uploadBtn.addEventListener("click", () => {
            const file = fileChooser ? fileChooser.files[0] : null;
            if (!file) {
                alert("Please select a file first.");
                return;
            }

            uploadBtn.disabled = true;
            uploadBtn.textContent = "Processing Stream...";

            const reader = new FileReader();
            reader.onload = async function (e) {
                try {
                    const response = await fetch(GOOGLE_DRIVE_BRIDGE_URL, {
                        method: "POST",
                        body: JSON.stringify({ 
                            action: "upload", name: file.name, fileData: e.target.result, 
                            uploadedBy: currentUserProfile.username, triggeredBy: currentUserProfile.username 
                        })
                    });
                    const result = await response.json();
                    if (result.status === "success") {
                        if (fileChooser) fileChooser.value = "";
                        syncFilesLive();
                    } else {
                        alert(result.message);
                    }
                } catch (err) {
                    alert("Upload failed.");
                } finally {
                    uploadBtn.disabled = false;
                    uploadBtn.textContent = "Upload to Cloud";
                }
            };
            reader.readAsDataURL(file);
        });
    }
});
                    
