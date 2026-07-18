// =========================================================================
// INTERACTIVE SYSTEM CONTROL PANEL INTERFACE (script.js)
// Connected Web App Endpoint Target Deployment Configuration
// =========================================================================

const GOOGLE_DRIVE_BRIDGE_URL = "https://script.google.com/macros/s/AKfycbylUaOnA4QeudP4cgmIhjPo9z-TnrL1dN8hSUm4mD5WxLbs1FVpDS6u0AdTaZSHwOwM9g/exec";

let currentUserProfile = { username: "", role: "viewer" };

document.addEventListener("DOMContentLoaded", () => {
    const loginPortal = document.getElementById("login-portal");
    const loginForm = document.getElementById("login-form");
    const workspaceDashboard = document.getElementById("workspace-dashboard");
    const logoutBtn = document.getElementById("logout-btn");
    const userBadge = document.getElementById("user-badge");
    const uploadPanel = document.getElementById("upload-panel");
    const fileListBody = document.getElementById("file-list-body");
    const adminPanel = document.getElementById("admin-panel");
    const userRegistryContainer = document.getElementById("user-registry-container");
    const failedLogsContainer = document.getElementById("failed-logs-container");

    // 1. SERVICE ROUTINE: USER AUTHENTICATION
    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const u = document.getElementById("username").value;
            const p = document.getElementById("password").value;

            try {
                const res = await fetch(GOOGLE_DRIVE_BRIDGE_URL, {
                    method: "POST",
                    body: JSON.stringify({ action: "login", username: u, password: p })
                });
                const data = await res.json();

                if (data.status === "success") {
                    currentUserProfile.username = data.username;
                    currentUserProfile.role = data.role;

                    loginPortal.classList.add("hidden");
                    workspaceDashboard.classList.remove("hidden");
                    userBadge.textContent = `${currentUserProfile.username} (${currentUserProfile.role.toUpperCase()})`;

                    configureUIForRole(currentUserProfile.role);
                    loadWorkspaceFiles();
                    
                    if (currentUserProfile.role !== "viewer") {
                        syncUsersLive();
                        syncLogsLive();
                    }
                } else {
                    alert("Authentication Failed: " + data.message);
                }
            } catch (err) {
                alert("Database transmission timeout error.");
            }
        });
    }

    function configureUIForRole(role) {
        if (role === "viewer") {
            uploadPanel.classList.add("hidden");
            adminPanel.classList.add("hidden");
        } else {
            uploadPanel.classList.remove("hidden");
            adminPanel.classList.remove("hidden");
        }
    }

    // 2. SERVICE ROUTINE: FILE DATABASE REPOSITORY
    async function loadWorkspaceFiles() {
        fileListBody.innerHTML = `<tr><td colspan="3">Syncing remote files...</td></tr>`;
        try {
            const res = await fetch(GOOGLE_DRIVE_BRIDGE_URL, { method: "POST", body: JSON.stringify({ action: "getFiles" }) });
            const data = await res.json();
            if (data.status === "success") renderFiles(data.files);
        } catch (e) { fileListBody.innerHTML = "<tr><td colspan='3'>Error loading repo files.</td></tr>"; }
    }

    function renderFiles(files) {
        fileListBody.innerHTML = (files.length === 0) ? "<tr><td colspan='3'>Empty registry repository.</td></tr>" : "";
        files.forEach(f => {
            const tr = document.createElement("tr");
            const btn = (currentUserProfile.role !== "viewer") ? `<button class="btn-danger" onclick="triggerFileDeletion('${f.url}')">Delete</button>` : "Read Only";
            tr.innerHTML = `<td><a href="${f.url}" target="_blank">🔗 ${f.name}</a></td><td>${f.by || 'System'}</td><td>${btn}</td>`;
            fileListBody.appendChild(tr);
        });
    }

    window.triggerFileDeletion = async (fileUrl) => {
        if (!confirm("Delete file database index target entry permanently?")) return;
        try {
            const res = await fetch(GOOGLE_DRIVE_BRIDGE_URL, {
                method: "POST",
                body: JSON.stringify({ action: "deleteFile", url: fileUrl, triggeredBy: currentUserProfile.username })
            });
            if ((await res.json()).status === "success") loadWorkspaceFiles();
        } catch (e) { alert("Deletion update error processing execution path."); }
    };

    // 3. SERVICE ROUTINE: DIRECTORY USER MANAGEMENT & CREATION
    const addUserForm = document.getElementById("add-user-form");
    if (addUserForm) {
        addUserForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const u = document.getElementById("new-username");
            const p = document.getElementById("new-password");
            const r = document.getElementById("new-role");

            const submitBtn = addUserForm.querySelector("button[type='submit']");
            submitBtn.disabled = true;

            try {
                const res = await fetch(GOOGLE_DRIVE_BRIDGE_URL, {
                    method: "POST",
                    body: JSON.stringify({ action: "addUser", username: u.value, password: p.value, role: r.value, triggeredBy: currentUserProfile.username })
                });
                const data = await res.json();
                if (data.status === "success") {
                    alert(`User "${u.value}" saved directly to Sheets!`);
                    u.value = ""; p.value = ""; r.value = "viewer";
                    syncUsersLive();
                } else { alert("Error: " + data.message); }
            } catch (err) { alert("Network creation sync error execution path."); }
            finally { submitBtn.disabled = false; }
        });
    }

    async function syncUsersLive() {
        userRegistryContainer.innerHTML = "<p>Reading cloud profiles...</p>";
        try {
            const res = await fetch(GOOGLE_DRIVE_BRIDGE_URL, { method: "POST", body: JSON.stringify({ action: "getUsers" }) });
            const data = await res.json();
            if (data.status === "success") {
                userRegistryContainer.innerHTML = "";
                data.users.forEach(u => {
                    const d = document.createElement("div"); d.className = "row-item";
                    const act = u.status === "suspended" ? "active" : "suspended";
                    d.innerHTML = `<span><strong>${u.username}</strong> (${u.role.toUpperCase()})</span>
                                   <button onclick="toggleUserStatus('${u.username}', '${act}')">${u.status === 'suspended' ? 'Activate' : 'Suspend'}</button>`;
                    userRegistryContainer.appendChild(d);
                });
            }
        } catch (e) { userRegistryContainer.innerHTML = "Sync Error."; }
    }

    window.toggleUserStatus = async (user, nextStatus) => {
        try {
            const res = await fetch(GOOGLE_DRIVE_BRIDGE_URL, {
                method: "POST",
                body: JSON.stringify({ action: "toggleStatus", username: user, status: nextStatus, triggeredBy: currentUserProfile.username })
            });
            if ((await res.json()).status === "success") syncUsersLive();
        } catch (e) { alert("Status execution sync network failure."); }
    };

    // 4. NEW WORKFLOW MODULE: INCIDENT LOG TRACKING & DELETION
    async function syncLogsLive() {
        failedLogsContainer.innerHTML = "<p>Syncing security logs...</p>";
        try {
            const res = await fetch(GOOGLE_DRIVE_BRIDGE_URL, { method: "POST", body: JSON.stringify({ action: "getFailedLogs" }) });
            const data = await res.json();
            if (data.status === "success") {
                failedLogsContainer.innerHTML = (data.logs.length === 0) ? "<p style='color:grey;'>No security alerts recorded.</p>" : "";
                data.logs.forEach(log => {
                    const d = document.createElement("div"); d.className = "row-item";
                    d.style.borderLeft = "4px solid var(--danger)";
                    // Format log string nicely
                    d.innerHTML = `<div>
                                     <strong>${log.username}</strong><br>
                                     <small style="color:#7f8c8d;">${log.time.split(' GMT')[0]}</small>
                                   </div>
                                   <button class="btn-danger" style="padding: 4px 8px; font-size:12px;" onclick="triggerLogDeletion(${log.rowIndex})">Clear</button>`;
                    failedLogsContainer.appendChild(d);
                });
            }
        } catch (e) { failedLogsContainer.innerHTML = "Logs extraction network error."; }
    }

    window.triggerLogDeletion = async (index) => {
        if (!confirm("Permanently erase this specific log entry row from Google Sheets?")) return;
        try {
            const res = await fetch(GOOGLE_DRIVE_BRIDGE_URL, {
                method: "POST",
                body: JSON.stringify({ action: "deleteLog", rowIndex: index, triggeredBy: currentUserProfile.username })
            });
            const data = await res.json();
            if (data.status === "success") {
                syncLogsLive(); // Immediately pull down the fresh, shortened spreadsheet log list
            } else {
                alert("Rejected: " + data.message);
            }
        } catch (e) { alert("Could not execute log record purge request."); }
    };

    // 5. SERVICE ROUTINE: BASE64 FILE CONVERTER
    const uploadBtn = document.getElementById("upload-btn");
    if (uploadBtn) {
        uploadBtn.addEventListener("click", () => {
            const fileInput = document.getElementById("file-input");
            if (!fileInput || fileInput.files.length === 0) return alert("Select a file first.");

            const file = fileInput.files[0];
            const reader = new FileReader();
            uploadBtn.disabled = true; uploadBtn.textContent = "Storing to Drive...";

            reader.onload = async function(e) {
                try {
                    const res = await fetch(GOOGLE_DRIVE_BRIDGE_URL, {
                        method: "POST",
                        body: JSON.stringify({
                            action: "upload", fileData: e.target.result, name: file.name,
                            uploadedBy: currentUserProfile.username, triggeredBy: currentUserProfile.username
                        })
                    });
                    if ((await res.json()).status === "success") {
                        alert("File completely saved!"); fileInput.value = ""; loadWorkspaceFiles();
                    }
                } catch (e) { alert("Network upload handling failure."); }
                finally { uploadBtn.disabled = false; uploadBtn.textContent = "Process Upload"; }
            };
            reader.readAsDataURL(file);
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            currentUserProfile = { username: "", role: "viewer" };
            loginPortal.classList.remove("hidden"); workspaceDashboard.classList.add("hidden");
        });
    }
});
