// =========================================
// 1. CONFIGURATION (INTEGRATED LIVE URL)
// =========================================
const GOOGLE_DRIVE_BRIDGE_URL = "https://script.google.com/macros/s/AKfycbxt3MHglvJMcs5_WlnAwrgB-NK5OJDjx_9wPdrr50YsiCVjylnizdXi2MwFKoFc_LXQ/exec";

// Global Session Tracker
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
            // Ping your Apps Script engine directly 
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
            if (errorMsg) errorMsg.textContent = "Network timeout. Ensure Web App is deployed as 'Anyone'.";
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
    
    renderFiles();
}

// =========================================
// 4. DIRECT GOOGLE DRIVE FILE STREAMER
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
                const payload = {
                    action: "upload",
                    name: file.name,
                    fileData: e.target.result
                };
                
                const response = await fetch(GOOGLE_DRIVE_BRIDGE_URL, {
                    method: "POST",
                    body: JSON.stringify(payload)
                });
                
                const result = await response.json();

                if (result.status === "success") {
                    simulatedFilesDB.push({
                        name: file.name,
                        url: result.downloadUrl,
                        by: currentUserProfile.username
                    });
                    
                    fileChooser.value = "";
                    alert("File successfully saved to Google Drive!");
                    renderFiles();
                } else {
                    alert("Storage Write Rejected: " + result.message);
                }
            } catch (err) {
                alert("Upload failed. Verify connection status.");
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
