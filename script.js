// =========================================================
// CONFIGURATION & GLOBAL STATE
// =========================================================
// Replace this placeholder with your published Apps Script Web App URL ending in /exec
const GOOGLE_DRIVE_BRIDGE_URL = "https://script.google.com/macros/s/AKfycbz62G2PnAn3kHi-YZncvPh-iBCykKByV4gaRddoTQNrxJ7diPkFCrY35--dEtpnjRiD5Q/exec";

let currentUser = null;
let userRole = null;

// =========================================================
// TEXT DECIPHER ENGINE (VISUAL ONLY)
// =========================================================
const CIPHER_CHARS = '!@#$%^&*()_+-=[]{}|;:,.<>?/0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function decipherText(element, finalText, speed = 25) {
    return new Promise((resolve) => {
        if (!element) return resolve();
        let iteration = 0;
        const totalLength = finalText.length;

        const timer = setInterval(() => {
            element.textContent = finalText
                .split('')
                .map((char, index) => {
                    if (char === ' ' || char === '\n') return char;
                    if (index < iteration) return finalText[index];
                    return CIPHER_CHARS[Math.floor(Math.random() * CIPHER_CHARS.length)];
                })
                .join('');

            if (iteration >= totalLength) {
                clearInterval(timer);
                element.textContent = finalText;
                resolve();
            }

            iteration += 0.5;
        }, speed);
    });
}

async function animateContainerText(container) {
    if (!container) return;
    const targets = container.querySelectorAll('.type-target, p, h2, h3, h4, label, .badge, .section-desc');

    for (const el of targets) {
        if (el.children.length === 0 && el.textContent.trim() !== '') {
            if (!el.hasAttribute('data-raw-text')) {
                el.setAttribute('data-raw-text', el.textContent.trim());
            }
            const fullText = el.getAttribute('data-raw-text');
            await decipherText(el, fullText, 18);
        }
    }
}

// =========================================================
// BACKEND API BRIDGE
// =========================================================
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
        return { success: false, message: "Network connection lost or server unreachable." };
    }
}

// =========================================================
// DOM INITIALIZATION & EVENT LISTENERS
// =========================================================
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const emailInput = document.getElementById('email-input');
    const passwordInput = document.getElementById('password-input');
    const loginBtn = document.getElementById('login-btn');
    const spinner = document.getElementById('greeting-spinner');
    const errorMsg = document.getElementById('error-msg');

    const dashboardScreen = document.getElementById('dashboard-screen');
    const loginScreen = document.getElementById('login-screen');
    const userDisplayName = document.getElementById('user-display-name');
    const userRoleBadge = document.getElementById('user-role-badge');
    const logoutBtn = document.getElementById('logout-btn');

    const adminSection = document.getElementById('admin-section');
    const createUserForm = document.getElementById('create-user-form');
    const userListContainer = document.getElementById('user-list-container');

    const fileChooser = document.getElementById('file-chooser');
    const uploadBtn = document.getElementById('upload-btn');
    const filesGrid = document.getElementById('files-grid');

    if (loginScreen) animateContainerText(loginScreen);

    // Login Handler
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const username = emailInput.value.trim();
            const password = passwordInput.value.trim();

            if (!username || !password) return;

            loginBtn.disabled = true;
            await decipherText(errorMsg, '> VERIFYING ENCRYPTED CREDENTIALS...', 20);
            if (spinner) spinner.classList.remove('hidden');

            const response = await apiCall({ action: 'login', username, password });

            if (spinner) spinner.classList.add('hidden');
            loginBtn.disabled = false;

            if (response && response.success) {
                currentUser = response.user.username;
                userRole = response.user.role || 'viewer';

                if (userDisplayName) userDisplayName.textContent = `OPERATOR: ${currentUser.toUpperCase()}`;
                if (userRoleBadge) userRoleBadge.textContent = userRole.toUpperCase();

                if (adminSection) {
                    if (userRole === 'primary_owner' || userRole === 'owner') {
                        adminSection.classList.remove('hidden');
                        fetchUsers();
                    } else {
                        adminSection.classList.add('hidden');
                    }
                }

                if (loginScreen) loginScreen.classList.add('hidden');
                if (dashboardScreen) dashboardScreen.classList.remove('hidden');
                if (errorMsg) errorMsg.textContent = '';

                await animateContainerText(dashboardScreen);
                fetchFiles();
            } else {
                await decipherText(errorMsg, `> ACCESS DENIED: ${response.message || 'INVALID PASSKEY'}`, 15);
            }
        });
    }

    // Logout Handler
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            currentUser = null;
            userRole = null;
            if (dashboardScreen) dashboardScreen.classList.add('hidden');
            if (loginScreen) loginScreen.classList.remove('hidden');
            if (loginForm) loginForm.reset();
            if (errorMsg) errorMsg.textContent = '';
            animateContainerText(loginScreen);
        });
    }

    // Upload Handler
    if (uploadBtn && fileChooser) {
        uploadBtn.addEventListener('click', async () => {
            const file = fileChooser.files[0];
            if (!file) {
                alert('Select a document to upload.');
                return;
            }

            uploadBtn.disabled = true;
            uploadBtn.textContent = 'ENCRYPTING & TRANSMITTING...';

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
    }

    // Create User Handler
    if (createUserForm) {
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
                alert('Failed to register user: ' + (res.message || 'Server error'));
            }
        });
    }

    // Data Fetchers
    async function fetchFiles() {
        if (!filesGrid) return;
        filesGrid.innerHTML = '<p class="type-target">&gt; SCANNING CLOUD REPOSITORY...</p>';
        const res = await apiCall({ action: 'getFiles' });

        if (res && res.success && Array.isArray(res.files)) {
            renderFiles(res.files);
        } else {
            filesGrid.innerHTML = '<p class="type-target">&gt; NO DOCUMENTS FOUND IN REPOSITORY.</p>';
        }
    }

    function renderFiles(files) {
        if (!filesGrid) return;
        filesGrid.innerHTML = '';

        if (files.length === 0) {
            filesGrid.innerHTML = '<p class="type-target">&gt; REPOSITORY EMPTY.</p>';
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

            const titleEl = card.querySelector('h4');
            card.addEventListener('mouseenter', () => {
                const original = titleEl.getAttribute('title');
                decipherText(titleEl, original, 15);
            });

            const deleteBtn = card.querySelector('.delete');
            deleteBtn.addEventListener('click', () => handleDeleteFile(file.id, file.url));

            filesGrid.appendChild(card);
        });
    }

    async function handleDeleteFile(fileId, fileUrl) {
        if (!confirm('Permanently purge this record from memory?')) return;

        const res = await apiCall({
            action: 'delete',
            fileId: fileId,
            targetUrl: fileUrl
        });

        if (res && res.success) {
            fetchFiles();
        } else {
            alert('Purge failed: ' + (res.message || 'Error executing request'));
        }
    }

    async function fetchUsers() {
        if (!userListContainer) return;
        userListContainer.innerHTML = '<p class="type-target">&gt; READING DIRECTORY ACCESS LIST...</p>';
        const res = await apiCall({ action: 'getUsers' });

        if (res && res.success && Array.isArray(res.users)) {
            renderUsers(res.users);
        }
    }

    function renderUsers(users) {
        if (!userListContainer) return;
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
});

// =========================================================
// UTILITIES
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
