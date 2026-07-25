// =========================================================
// CONFIGURATION & GLOBAL STATE
// =========================================================
// Replace with your active Google Apps Script Web App URL
const GOOGLE_DRIVE_BRIDGE_URL = "YOUR_DEPLOYED_WEB_APP_URL";

let currentUser = null;
let userRole = null;

// =========================================================
// DOM ELEMENTS
// =========================================================
const loginScreen = document.getElementById('login-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const loginForm = document.getElementById('login-form');
const emailInput = document.getElementById('email-input');
const passwordInput = document.getElementById('password-input');
const loginBtn = document.getElementById('login-btn');
const spinner = document.getElementById('greeting-spinner');
const errorMsg = document.getElementById('error-msg');

const userDisplayName = document.getElementById('user-display-name');
const userRoleBadge = document.getElementById('user-role-badge');
const logoutBtn = document.getElementById('logout-btn');

const adminSection = document.getElementById('admin-section');
const createUserForm = document.getElementById('create-user-form');
const userListContainer = document.getElementById('user-list-container');

const fileChooser = document.getElementById('file-chooser');
const uploadBtn = document.getElementById('upload-btn');
const filesGrid = document.getElementById('files-grid');

// =========================================================
// TYPEWRITER ANIMATION ENGINE
// =========================================================

/**
 * Types text out letter-by-letter inside an HTML element
 * @param {HTMLElement} element - Target element
 * @param {string} text - Text to type
 * @param {number} speed - Delay in ms per letter
 */
function typeWriter(element, text, speed = 30) {
    return new Promise((resolve) => {
        element.textContent = '';
        let i = 0;
        const timer = setInterval(() => {
            if (i < text.length) {
                element.textContent += text.charAt(i);
                i++;
            } else {
                clearInterval(timer);
                resolve();
            }
        }, speed);
    });
}

/**
 * Scans a container and types out all marked text elements letter-by-letter
 * @param {HTMLElement} container 
 */
async function animateContainerText(container) {
    const targets = container.querySelectorAll('.type-target, p, h2, h3, h4, label, .badge, .section-desc');
    
    for (const el of targets) {
        // Only type elements that are visible and contain text directly
        if (el.children.length === 0 && el.textContent.trim() !== '') {
            if (!el.hasAttribute('data-raw-text')) {
                el.setAttribute('data-raw-text', el.textContent.trim());
            }
            const fullText = el.getAttribute('data-raw-text');
            await typeWriter(el, fullText, 15);
        }
    }
}

// =========================================================
// BACKEND API BRIDGE
// =========================================================

/**
 * Wrapper for POST requests to Google Apps Script Web App
 * @param {Object} payload 
 */
async function apiCall(payload) {
    try {
        const response = await fetch(GOOGLE_DRIVE_BRIDGE_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(payload)
        });
        return await response.json();
    } catch (err) {
        console.error("API Error:", err);
        return { success: false, message: "Network error or server unreachable." };
    }
}

// =========================================================
// INITIAL PAGE LOAD
// =========================================================
document.addEventListener('DOMContentLoaded', () => {
    // Typewriter initialization for login screen terminal text
    if (loginScreen) {
        animateContainerText(loginScreen);
    }
});

// =========================================================
// AUTHENTICATION & LOGIN FLOW
// =========================================================
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = emailInput.value.trim();
    const password = passwordInput.value.trim();

    if (!username || !password) return;

    // Lock login button during authentication
    loginBtn.disabled = true;

    // Step 1: Type letter-by-letter "VERIFYING CREDENTIALS..." ONCE
    await typeWriter(errorMsg, '> VERIFYING CREDENTIALS IN DATABASE...', 35);
    
    // Step 2: Show loading spinner
    spinner.classList.remove('hidden');

    // Step 3: Run backend request and 5-second timer concurrently
    const apiPromise = apiCall({ action: 'login', username, password });
    const timerPromise = new Promise(resolve => setTimeout(resolve, 5000));

    const [response] = await Promise.all([apiPromise, timerPromise]);

    spinner.classList.add('hidden');
    loginBtn.disabled = false;

    if (response && response.success) {
        currentUser = response.user.username;
        userRole = response.user.role || 'viewer';

        // Update UI Header details
        userDisplayName.textContent = `OPERATOR: ${currentUser.toUpperCase()}`;
        userRoleBadge.textContent = userRole.toUpperCase();

        // Reveal Admin Section if user is Owner/Co-Owner
        if (userRole === 'primary_owner' || userRole === 'owner') {
            adminSection.classList.remove('hidden');
            fetchUsers();
        } else {
            adminSection.classList.add('hidden');
        }

        // Switch to Dashboard Screen
        loginScreen.classList.add('hidden');
        dashboardScreen.classList.remove('hidden');
        errorMsg.textContent = '';

        // Step 4: Type out all text inside dashboard letter-by-letter
        await animateContainerText(dashboardScreen);

        // Fetch cloud documents
        fetchFiles();
    } else {
        // Display Terminal Error
        await typeWriter(errorMsg, `> ACCESS DENIED: ${response.message || 'INVALID PASSKEY'}`, 25);
    }
});

// Logout handler
logoutBtn.addEventListener('click', () => {
    currentUser = null;
    userRole = null;
    dashboardScreen.classList.add('hidden');
    loginScreen.classList.remove('hidden');
    loginForm.reset();
    errorMsg.textContent = '';
    animateContainerText(loginScreen);
});

// =========================================================
// CLOUD FILE MANAGEMENT
// =========================================================

async function fetchFiles() {
    filesGrid.innerHTML = '<p class="type-target">&gt; SCANNING CLOUD DIRECTORY...</p>';
    
    const res = await apiCall({ action: 'getFiles' });
    
    if (res && res.success && Array.isArray(res.files)) {
        renderFiles(res.files);
    } else {
        filesGrid.innerHTML = '<p class="type-target">&gt; NO DOCUMENTS FOUND IN CLOUD REPOSITORY.</p>';
    }
}

function renderFiles(files) {
    filesGrid.innerHTML = '';
    
    if (files.length === 0) {
        filesGrid.innerHTML = '<p class="type-target">&gt; NO DOCUMENTS STORED YET.</p>';
        return;
    }

    files.forEach(file => {
        const card = document.createElement('div');
        card.className = 'file-card';

        const icon = getFileIcon(file.name, file.mimeType);
        const sizeStr = formatBytes(file.size);

        card.innerHTML = `
            <span class="file-icon">${icon}</span>
            <h4 title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</h4>
            <p class="file-meta-info">${sizeStr} | BY: ${escapeHtml(file.uploadedBy || 'UNKNOWN')}</p>
            <div class="file-actions-row">
                <a href="${file.url}" target="_blank" class="file-action">[ ACCESS ]</a>
                <button class="file-action delete" data-id="${file.id || ''}" data-url="${file.url}">[ PURGE ]</button>
            </div>
        `;

        const deleteBtn = card.querySelector('.delete');
        deleteBtn.addEventListener('click', () => handleDeleteFile(file.id, file.url));

        filesGrid.appendChild(card);
    });
}

// Upload file implementation
uploadBtn.addEventListener('click', async () => {
    const file = fileChooser.files[0];
    if (!file) {
        alert('Please select a file to upload!');
        return;
    }

    uploadBtn.disabled = true;
    uploadBtn.textContent = 'ENCRYPTING & UPLOADING...';

    const reader = new FileReader();
    reader.onload = async (e) => {
        const base64Data = e.target.result.split(',')[1];
        
        const payload = {
            action: 'upload',
            filename: file.name,
            mimeType: file.type || 'application/octet-stream',
            fileData: base64Data,
            fileSize: file.size,
            uploadedBy: currentUser || 'Anonymous'
        };

        const res = await apiCall(payload);
        uploadBtn.disabled = false;
        uploadBtn.textContent = 'UPLOAD TO CLOUD 📤';
        fileChooser.value = '';

        if (res && res.success) {
            fetchFiles();
        } else {
            alert('Upload failed: ' + (res.message || 'Unknown error'));
        }
    };

    reader.readAsDataURL(file);
});

// Delete file implementation
async function handleDeleteFile(fileId, fileUrl) {
    if (!confirm('Are you sure you want to permanently delete this document?')) return;

    const res = await apiCall({
        action: 'delete',
        fileId: fileId,
        targetUrl: fileUrl
    });

    if (res && res.success) {
        fetchFiles();
    } else {
        alert('Delete failed: ' + (res.message || 'Error executing request'));
    }
}

// =========================================================
// ADMIN & USER MANAGEMENT
// =========================================================

async function fetchUsers() {
    userListContainer.innerHTML = '<p class="type-target">&gt; FETCHING ACCESS CONTROL LIST...</p>';
    const res = await apiCall({ action: 'getUsers' });
    
    if (res && res.success && Array.isArray(res.users)) {
        renderUsers(res.users);
    }
}

function renderUsers(users) {
    userListContainer.innerHTML = '';
    
    users.forEach(u => {
        const div = document.createElement('div');
        div.className = 'control-item';
        div.innerHTML = `
            <div>
                <strong>${escapeHtml(u.username)}</strong>
                <span class="user-meta">${escapeHtml(u.email || 'No Email')} | ROLE: ${u.role}</span>
            </div>
            <span class="badge">${u.status || 'active'}</span>
        `;
        userListContainer.appendChild(div);
    });
}

createUserForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('new-username').value.trim();
    const email = document.getElementById('new-email').value.trim();
    const password = document.getElementById('new-password').value.trim();
    const role = document.getElementById('new-role').value;

    const res = await apiCall({
        action: 'createUser',
        username,
        email,
        password,
        role
    });

    if (res && res.success) {
        createUserForm.reset();
        fetchUsers();
    } else {
        alert('Failed to create user: ' + (res.message || 'Server error'));
    }
});

// =========================================================
// HELPER FUNCTIONS
// =========================================================

function getFileIcon(filename, mimeType) {
    const ext = (filename || '').split('.').pop().toLowerCase();
    if (mimeType?.includes('image') || ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext)) return '🖼️';
    if (mimeType?.includes('pdf') || ext === 'pdf') return '📄';
    if (mimeType?.includes('video') || ['mp4', 'mkv', 'avi', 'mov'].includes(ext)) return '🎬';
    if (mimeType?.includes('audio') || ['mp3', 'wav', 'flac'].includes(ext)) return '🎵';
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return '📦';
    if (['js', 'html', 'css', 'json', 'py', 'cpp', 'c', 'java', 'txt'].includes(ext)) return '📜';
    return '📁';
}

function formatBytes(bytes) {
    if (!bytes || isNaN(bytes)) return 'UNKNOWN SIZE';
    const k = 1024;
    const sizes = ['BYTES', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function escapeHtml(str) {
    return (str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
