// =========================================================
// CONFIGURATION & GLOBAL STATE
// =========================================================
const GOOGLE_DRIVE_BRIDGE_URL = "https://script.google.com/macros/s/AKfycbyth_SYwK-LGbTfuO18D8mg4kyNRyGKfBuss7HxutqgSTN2ysct5pj8gs8m2n8RYq0PYQ/exec";

let currentUser = null;
let userRole = null;

// =========================================================
// OPTION 2: WEB AUDIO API SOUND SYNTHESIZER
// =========================================================
const AudioFX = {
    ctx: null,

    // Initialize AudioContext lazily on user interaction
    init() {
        if (!this.ctx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioCtx();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    },

    // Crisp mechanical keyboard click
    playKeyClick() {
        try {
            this.init();
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(1200 + Math.random() * 500, now);
            osc.frequency.exponentialRampToValueAtTime(150, now + 0.012);

            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.012);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now);
            osc.stop(now + 0.012);
        } catch (e) {}
    },

    // Rapid high-frequency blip for text deciphering
    playDecipherTick() {
        try {
            this.init();
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'square';
            osc.frequency.setValueAtTime(800 + Math.random() * 800, now);

            gain.gain.setValueAtTime(0.015, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.008);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now);
            osc.stop(now + 0.008);
        } catch (e) {}
    },

    // Retro "ACCESS GRANTED" tri-tone chime
    playSuccess() {
        try {
            this.init();
            const now = this.ctx.currentTime;
            const freqs = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6

            freqs.forEach((freq, idx) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();

                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, now + idx * 0.07);

                gain.gain.setValueAtTime(0, now + idx * 0.07);
                gain.gain.linearRampToValueAtTime(0.12, now + idx * 0.07 + 0.01);
                gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.15);

                osc.connect(gain);
                gain.connect(this.ctx.destination);

                osc.start(now + idx * 0.07);
                osc.stop(now + idx * 0.07 + 0.15);
            });
        } catch (e) {}
    },

    // Harsh retro "ACCESS DENIED" square-wave buzz
    playError() {
        try {
            this.init();
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(160, now);
            osc.frequency.setValueAtTime(110, now + 0.1);

            gain.gain.setValueAtTime(0.18, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now);
            osc.stop(now + 0.35);
        } catch (e) {}
    }
};

// =========================================================
// TEXT DECIPHER / CYBER SCRAMBLE ENGINE
// =========================================================
const CIPHER_CHARS = '!@#$%^&*()_+-=[]{}|;:,.<>?/0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZÃÆØÅ≡µ±≤≥≠';

/**
 * Scrambles text using matrix characters before revealing real letters
 * @param {HTMLElement} element - Target element
 * @param {string} finalText - String to decipher into
 * @param {number} speed - Refresh rate in ms
 */
function decipherText(element, finalText, speed = 25) {
    return new Promise((resolve) => {
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

            AudioFX.playDecipherTick();

            if (iteration >= totalLength) {
                clearInterval(timer);
                element.textContent = finalText; // Clean finish lock
                resolve();
            }

            iteration += 0.5; // Deciphers 1 character every 2 frames
        }, speed);
    });
}

/**
 * Scans a container and deciphers all marked text elements sequentially
 * @param {HTMLElement} container 
 */
async function animateContainerText(container) {
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
// INITIAL PAGE LOAD & EVENT LISTENERS
// =========================================================
document.addEventListener('DOMContentLoaded', () => {
    const loginScreen = document.getElementById('login-screen');
    if (loginScreen) {
        animateContainerText(loginScreen);
    }

    // Attach mechanical key sound to every input typing event
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') {
            // Ignore pure modifier keys
            if (!['Control', 'Shift', 'Alt', 'Meta', 'CapsLock'].includes(e.key)) {
                AudioFX.playKeyClick();
            }
        }
    });
});

// DOM References
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

// =========================================================
// AUTHENTICATION FLOW
// =========================================================
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = emailInput.value.trim();
    const password = passwordInput.value.trim();

    if (!username || !password) return;

    loginBtn.disabled = true;

    // Decipher verification string
    await decipherText(errorMsg, '> VERIFYING ENCRYPTED CREDENTIALS...', 20);
    spinner.classList.remove('hidden');

    // Run 5-second login delay and API promise concurrently
    const apiPromise = apiCall({ action: 'login', username, password });
    const timerPromise = new Promise(resolve => setTimeout(resolve, 5000));

    const [response] = await Promise.all([apiPromise, timerPromise]);

    spinner.classList.add('hidden');
    loginBtn.disabled = false;

    if (response && response.success) {
        AudioFX.playSuccess();

        currentUser = response.user.username;
        userRole = response.user.role || 'viewer';

        userDisplayName.textContent = `OPERATOR: ${currentUser.toUpperCase()}`;
        userRoleBadge.textContent = userRole.toUpperCase();

        if (userRole === 'primary_owner' || userRole === 'owner') {
            adminSection.classList.remove('hidden');
            fetchUsers();
        } else {
            adminSection.classList.add('hidden');
        }

        loginScreen.classList.add('hidden');
        dashboardScreen.classList.remove('hidden');
        errorMsg.textContent = '';

        // Decipher all text on dashboard
        await animateContainerText(dashboardScreen);
        fetchFiles();
    } else {
        AudioFX.playError();
        await decipherText(errorMsg, `> ACCESS DENIED: ${response.message || 'INVALID PASSKEY'}`, 15);
    }
});

// Logout handler
logoutBtn.addEventListener('click', () => {
    AudioFX.playError();
    currentUser = null;
    userRole = null;
    dashboardScreen.classList.add('hidden');
    loginScreen.classList.remove('hidden');
    loginForm.reset();
    errorMsg.textContent = '';
    animateContainerText(loginScreen);
});

// =========================================================
// FILE MANAGEMENT
// =========================================================
async function fetchFiles() {
    filesGrid.innerHTML = '<p class="type-target">&gt; SCANNING CLOUD REPOSITORY...</p>';
    const res = await apiCall({ action: 'getFiles' });

    if (res && res.success && Array.isArray(res.files)) {
        renderFiles(res.files);
    } else {
        filesGrid.innerHTML = '<p class="type-target">&gt; NO DOCUMENTS FOUND IN REPOSITORY.</p>';
    }
}

function renderFiles(files) {
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

        // Hover decipher effect on card title
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
            AudioFX.playSuccess();
            fetchFiles();
        } else {
            AudioFX.playError();
            alert('Upload failed: ' + (res.message || 'Unknown error'));
        }
    };

    reader.readAsDataURL(file);
});

async function handleDeleteFile(fileId, fileUrl) {
    if (!confirm('Permanently purge this record from memory?')) return;

    const res = await apiCall({
        action: 'delete',
        fileId: fileId,
        targetUrl: fileUrl
    });

    if (res && res.success) {
        AudioFX.playSuccess();
        fetchFiles();
    } else {
        AudioFX.playError();
        alert('Purge failed: ' + (res.message || 'Error executing request'));
    }
}

// =========================================================
// USER MANAGEMENT
// =========================================================
async function fetchUsers() {
    userListContainer.innerHTML = '<p class="type-target">&gt; READING DIRECTORY ACCESS LIST...</p>';
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
        AudioFX.playSuccess();
        createUserForm.reset();
        fetchUsers();
    } else {
        AudioFX.playError();
        alert('Failed to register user: ' + (res.message || 'Server error'));
    }
});

// =========================================================
// HELPERS
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
