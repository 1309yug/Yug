// =========================================================================
// SECURE FRONTEND CONTROLLER (script.js)
// Links login portals, file processing, and immediate Sheet database syncing
// =========================================================================

// !!! REPLACE THIS URL WITH YOUR DEPLOYED WEB APP EXECUTION LINK !!!
const GOOGLE_DRIVE_BRIDGE_URL = "https://script.google.com/macros/s/AKfycbzYUVxnJXmNoY6_0o1fANzrIo0b7RuuG8o7hisZKWLKMJ6ZkCdti12kUSFewucLWgARuA/exec";

// Keep track of who is logged in globally
let currentUserProfile = {
    username: "",
    role: "viewer"
};

document.addEventListener("DOMContentLoaded", () => {
    // DOM Elements
    const loginPortal = document.getElementById("login-portal");
    const loginForm = document.getElementById("login-form");
    const workspaceDashboard = document.getElementById("workspace-dashboard");
    const logoutBtn = document.getElementById("logout-btn");
    const userBadge = document.getElementById("user-badge");
    const uploadPanel = document.getElementById("upload-panel");
    const fileListBody = document.getElementById("file-list-body");
    const adminPanel = document.getElementById("admin-panel");
    const userRegistryContainer = document.getElementById("user-registry-container");

    // =========================================
    // 1. SIGN IN ACTION
    // =========================================
    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const usernameInput = document.getElementById("username").value;
            const passwordInput = document.getElementById("password").value;

            try {
                const response = await fetch(GOOGLE_DRIVE_BRIDGE_URL, {
                    method: "POST",
                    body: JSON.stringify({
                        action: "login",
                        username: usernameInput,
                        password: passwordInput
                    })
                });
                const data = await response.json();

                if (data.status === "success") {
                    currentUserProfile.username = data.username;
                    currentUserProfile.role = data.role;

                    // Switch panels
                    loginPortal.classList.add("hidden");
                    workspaceDashboard.classList.remove("hidden");

                    // Set branding/welcome info
                    userBadge.textContent = `${currentUserProfile.username} (${currentUserProfile.role.toUpperCase()})`;

                    // Setup authorized view layout
                    configureUIForRole(currentUserProfile.role);
                    
                    // Fetch data
                    loadWorkspaceFiles();
                    if (currentUserProfile.role !== "viewer") {
                        syncUsersLive();
                    }
                } else {
                    alert("Authentication Failed: " + data.message);
                }
            } catch (err) {
                alert("Database access timed out. Make sure your Apps Script web app is deployed correctly.");
            }
        });
    }

    // =========================================
    // 2. CONFIGURE ROLE PERMISSIONS (CLIENT-SIDE VISIBILITY)
    // =========================================
    function configureUIForRole(role) {
        if (role === "viewer") {
            uploadPanel.classList.add("hidden");
            adminPanel.classList.add("hidden");
        } else {
            // Editors and Primary Owners can upload files and manage users
            uploadPanel.classList.remove("hidden");
            adminPanel.classList.remove("hidden");
        }
    }

    // =========================================
    // 3. LOAD FILE REPOSITORY
    // =========================================
    async function loadWorkspaceFiles() {
        fileListBody.innerHTML = `<tr><td colspan="3">Retrieving registry files...</td></tr>`;
        try {
            const response = await fetch(GOOGLE_DRIVE_BRIDGE_URL, {
                method: "POST",
                body: JSON.stringify({ action: "getFiles" })
            });
            const result = await response.json();

            if (result.status === "success") {
                renderFiles(result.files);
            } else {
                fileListBody.innerHTML = `<tr><td colspan="3" style="color:red;">Error: ${result.message}</td></tr>`;
            }
        } catch (err) {
            fileListBody.innerHTML = `<tr><td colspan="3" style="color:red;">Failed to connect to file service.</td></tr>`;
        }
    }

    function renderFiles(files) {
        if (!files || files.length === 0) {
            fileListBody.innerHTML = `<tr><td colspan="3">No documents found in database.</td></tr>`;
            return;
        }

        fileListBody.innerHTML = "";
        files.forEach(file => {
            const tr = document.createElement("tr");
            
            const fileLink = `<a href="${file.url}" target="_blank" style="color:#2980b9; font-weight:bold; text-decoration:none;">🔗 ${file.name}</a>`;
            const uploadedBy = `<span>${file.by || "System"}</span>`;
            
            // Render delete button only for editors and owners
            let actionBtn = "";
            if (currentUserProfile.role !== "viewer") {
                actionBtn = `<button class="btn-danger btn-sm" onclick="triggerFileDeletion('${file.url}')">Delete</button>`;
            } else {
                actionBtn = `<span style="color:#7f8c8d; font-size:12px;">Read Only</span>`;
            }

            tr.innerHTML = `
                <td>${fileLink}</td>
                <td>${uploadedBy}</td>
                <td>${actionBtn}</td>
            `;
            fileListBody.appendChild(tr);
        });
    }

    // Make file deletion accessible globally to the inline buttons
    window.triggerFileDeletion = async (fileUrl) => {
        if (!confirm("Are you sure you want to permanently delete this file?")) return;

        try {
            const response = await fetch(GOOGLE_DRIVE_BRIDGE_URL, {
                method: "POST",
                body: JSON.stringify({
                    action: "deleteFile",
                    url: fileUrl,
                    triggeredBy: currentUserProfile.username
                })
            });
            const result = await response.json();

            if (result.status === "success") {
                loadWorkspaceFiles(); // Reload list
            } else {
                alert("Operation Rejected: " + result.message);
            }
        } catch (err) {
            alert("Error trying to process deletion request.");
        }
    };

    // =========================================
    // 4. USER SYNCHRONIZATION AND CREATION
    // =========================================
    const addUserForm = document.getElementById("add-user-form");
    if (addUserForm) {
        addUserForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const usernameInput = document.getElementById("new-username");
            const passwordInput = document.getElementById("new-password");
            const roleSelect = document.getElementById("new-role");

            const username = usernameInput.value.trim();
            const password = passwordInput.value;
            const role = roleSelect.value;

            const submitBtn = addUserForm.querySelector("button[type='submit']");
            submitBtn.disabled = true;
            submitBtn.textContent = "Syncing with Spreadsheet...";

            try {
                const response = await fetch(GOOGLE_DRIVE_BRIDGE_URL, {
                    method: "POST",
                    body: JSON.stringify({
                        action: "addUser",
                        username: username,
                        password: password,
                        role: role,
                        triggeredBy: currentUserProfile.username
                    })
                });
                const result = await response.json();

                if (result.status === "success") {
                    alert(`User "${username}" was successfully synced to Google Sheets!`);
                    usernameInput.value = "";
                    passwordInput.value = "";
                    roleSelect.value = "viewer";
                    syncUsersLive(); // Reload the visual user database
                } else {
                    alert("Failure: " + result.message);
                }
            } catch (err) {
                alert("Network timeout. The user could not be synced.");
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = "Add & Sync User";
            }
        });
    }

    // =========================================
    // 5. LIVE SYNCHRONIZE USER LIST
    // =========================================
    async function syncUsersLive() {
        if (!userRegistryContainer) return;
        userRegistryContainer.innerHTML = "<p>Connecting to user directory sync...</p>";

        try {
            const response = await fetch(GOOGLE_DRIVE_BRIDGE_URL, {
                method: "POST",
                body: JSON.stringify({ action: "getUsers" })
            });
            const result = await response.json();

            if (result.status === "success") {
                renderUserList(result.users);
            } else {
                userRegistryContainer.innerHTML = `<p style="color:red;">Sync Failed: ${result.message}</p>`;
            }
        } catch (err) {
            userRegistryContainer.innerHTML = `<p style="color:red;">Error updating registry.</p>`;
        }
    }

    function renderUserList(users) {
        userRegistryContainer.innerHTML = "";
        if (!users || users.length === 0) {
            userRegistryContainer.innerHTML = "<p>No users registered.</p>";
            return;
        }

        users.forEach(user => {
            const div = document.createElement("div");
            div.className = "user-row";

            const userMeta = `<span><strong>${user.username}</strong> - Role: <em>${user.role.toUpperCase()}</em></span>`;
            
            // Suspension button logic
            const isSuspended = user.status === "suspended";
            const btnText = isSuspended ? "Activate Account" : "Suspend Account";
            const btnClass = isSuspended ? "btn-success" : "btn-danger";
            const targetStatus = isSuspended ? "active" : "suspended";

            const toggleBtn = `<button class="${btnClass}" onclick="toggleUserStatus('${user.username}', '${targetStatus}')">${btnText}</button>`;

            div.innerHTML = `
                ${userMeta}
                <div>${toggleBtn}</div>
            `;
            userRegistryContainer.appendChild(div);
        });
    }

    window.toggleUserStatus = async (username, status) => {
        try {
            const response = await fetch(GOOGLE_DRIVE_BRIDGE_URL, {
                method: "POST",
                body: JSON.stringify({
                    action: "toggleStatus",
                    username: username,
                    status: status,
                    triggeredBy: currentUserProfile.username
                })
            });
            const result = await response.json();
            if (result.status === "success") {
                syncUsersLive();
            } else {
                alert("Operation failed: " + result.message);
            }
        } catch (err) {
            alert("Error altering database entry.");
        }
    };

    // =========================================
    // 6. UPLOAD PROCESS HANDLER
    // =========================================
    const uploadBtn = document.getElementById("upload-btn");
    if (uploadBtn) {
        uploadBtn.addEventListener("click", () => {
            const fileInput = document.getElementById("file-input");
            if (!fileInput || fileInput.files.length === 0) {
                alert("Please select a file to upload.");
                return;
            }

            const file = fileInput.files[0];
            const reader = new FileReader();

            uploadBtn.disabled = true;
            uploadBtn.textContent = "Uploading to Drive...";

            reader.onload = async function(e) {
                const fileData = e.target.result;
                try {
                    const response = await fetch(GOOGLE_DRIVE_BRIDGE_URL, {
                        method: "POST",
                        body: JSON.stringify({
                            action: "upload",
                            fileData: fileData,
                            name: file.name,
                            uploadedBy: currentUserProfile.username,
                            triggeredBy: currentUserProfile.username
                        })
                    });
                    const result = await response.json();

                    if (result.status === "success") {
                        alert("File successfully saved directly to Drive and database!");
                        fileInput.value = ""; // Clear file input
                        loadWorkspaceFiles(); // Reload table
                    } else {
                        alert("Error: " + result.message);
                    }
                } catch (err) {
                    alert("Upload request failed.");
                } finally {
                    uploadBtn.disabled = false;
                    uploadBtn.textContent = "Upload File";
                }
            };
            reader.readAsDataURL(file);
        });
    }

    // =========================================
    // 7. SIGN OUT (RESET STATE)
    // =========================================
    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            currentUserProfile = { username: "", role: "viewer" };
            loginPortal.classList.remove("hidden");
            workspaceDashboard.classList.add("hidden");
            document.getElementById("username").value = "";
            document.getElementById("password").value = "";
        });
    }
});
      
