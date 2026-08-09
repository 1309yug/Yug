// =========================================================
// CONFIGURATION & GLOBAL STATE
// =========================================================
const GOOGLE_DRIVE_BRIDGE_URL = "https://script.google.com/macros/s/AKfycbzmhwfpDoLVEdDJHrzffIFZYtC6oaBr5aMGof6aPgk9gecuxSDPsd0vhEhr6D2SduUE/exec";

let currentUser = null;
let userRole = null;
let currentDecryptTarget = null;

// =========================================================
// NATIVE WEB CRYPTO AES-256-GCM ENGINE
// =========================================================
const CRYPTO_SALT_BYTE_LEN = 16;
const CRYPTO_IV_BYTE_LEN = 12;

async function deriveAESKey(passphrase, salt) {
    const encoder = new TextEncoder();
    const passphraseKey = await window.crypto.subtle.importKey(
        'raw',
        encoder.encode(passphrase),
        'PBKDF2',
        false,
        ['deriveKey']
    );

    return await window.crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: salt,
            iterations: 100000,
            hash: 'SHA-256'
        },
        passphraseKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

async function encryptFileBuffer(arrayBuffer, passphrase) {
    const salt = window.crypto.getRandomValues(new Uint8Array(CRYPTO_SALT_BYTE_LEN));
    const iv = window.crypto.getRandomValues(new Uint8Array(CRYPTO_IV_BYTE_LEN));
    const key = await deriveAESKey(passphrase, salt);

    const ciphertext = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        arrayBuffer
    );

    const encryptedBytes = new Uint8Array(salt.byteLength + iv.byteLength + ciphertext.byteLength);
    encryptedBytes.set(salt, 0);
    encryptedBytes.set(iv, salt.byteLength);
    encryptedBytes.set(new Uint8Array(ciphertext), salt.byteLength + iv.byteLength);

    return encryptedBytes;
}

async function decryptFileBuffer(packedUint8Array, passphrase) {
    if (packedUint8Array.byteLength < CRYPTO_SALT_BYTE_LEN + CRYPTO_IV_BYTE_LEN) {
        throw new Error("INVALID PAYLOAD: FILE CORRUPTED OR TOO SMALL");
    }

    const salt = packedUint8Array.slice(0, CRYPTO_SALT_BYTE_LEN);
    const iv = packedUint8Array.slice(CRYPTO_SALT_BYTE_LEN, CRYPTO_SALT_BYTE_LEN + CRYPTO_IV_BYTE_LEN);
    const ciphertext = packedUint8Array.slice(CRYPTO_SALT_BYTE_LEN + CRYPTO_IV_BYTE_LEN);

    const key = await deriveAESKey(passphrase, salt);

    return await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        ciphertext
    );
}

function uint8ToBase64(bytes) {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

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
        return { success: false, message: "SYSTEM OFFLINE: CONNECTION REFUSED" };
    }
}

// =========================================================
// DOM INITIALIZATION & EVENT LISTENERS
// =========================================================
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const passkeyInput = document.getElementById('passkey-input');
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
    const uploadPassphraseInput = document.getElementById('upload-passphrase');
    const uploadBtn = document.getElementById('upload-btn');
    const filesGrid = document.getElementById('files-grid');

    const decryptModal = document.getElementById('decrypt-modal');
    const decryptPassphraseInput = document.getElementById('decrypt-passphrase');
    const confirmDecryptBtn = document.getElementById('confirm-decrypt-btn');
    const cancelDecryptBtn = document.getElementById('cancel-decrypt-btn');
    const decryptErrorMsg = document.getElementById('decrypt-error-msg');
    const decryptFilenameEl = document.getElementById('decrypt-filename');

    if (loginScreen) animateContainerText(loginScreen);

    // Login Form Submit
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const passkey = passkeyInput ? passkeyInput.value.trim() : '';
            if (!passkey) return;

            loginBtn.disabled = true;
            await decipherText(errorMsg, '> VERIFYING PASSKEY...', 18);
            if (spinner) spinner.classList.remove('hidden');

            const response = await apiCall({ action: 'login', passkey });

            if (spinner) spinner.classList.add('hidden');
            loginBtn.disabled = false;

            if (response && response.success) {
                currentUser = response.user.username;
                userRole = response.user.role || 'viewer';

                if (userDisplayName) userDisplayName.textContent = `OPERATOR: ${currentUser.toUpperCase()}`;
                if (userRoleBadge) userRoleBadge.textContent = userRole.toUpperCase();

                if (adminSection) {
                    if (['primary_owner', 'owner', 'admin'].includes(userRole.toLowerCase())) {
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
                await decipherText(errorMsg, `> ${response.message || 'ACCESS DENIED: INVALID PASSKEY'}`, 15);
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

    // Flexible Upload Handler (Optional Encryption)
    if (uploadBtn && fileChooser) {
        uploadBtn.addEventListener('click', async () => {
            const file = fileChooser.files[0];
            const passphrase = uploadPassphraseInput ? uploadPassphraseInput.value.trim() : '';

            if (!file) {
                alert('Select a document to upload.');
                return;
            }

            uploadBtn.disabled = true;

            try {
                const fileArrayBuffer = await file.arrayBuffer();
                let base64Data = "";
                let targetFilename = file.name;

                if (passphrase) {
                    // Encryption requested
                    uploadBtn.textContent = 'ENCRYPTING (AES-256)... 🔒';
                    const encryptedBytes = await encryptFileBuffer(fileArrayBuffer, passphrase);
                    base64Data = uint8ToBase64(encryptedBytes);
                    targetFilename = `${file.name}.enc`;
                } else {
                    // Plain Upload requested
                    uploadBtn.textContent = 'PREPARING FILE...';
                    base64Data = uint8ToBase64(new Uint8Array(fileArrayBuffer));
                }

                uploadBtn.textContent = 'TRANSMITTING...';

                const payload = {
                    action: 'upload',
                    filename: targetFilename,
                    mimeType: file.type || 'application/octet-stream',
                    fileData: base64Data,
                    fileSize: file.size,
                    uploadedBy: currentUser || 'Anonymous'
                };

                const res = await apiCall(payload);
                uploadBtn.disabled = false;
                uploadBtn.textContent = 'UPLOAD FILE 🚀';
                fileChooser.value = '';
                if (uploadPassphraseInput) uploadPassphraseInput.value = '';

                if (res && res.success) {
                    fetchFiles();
                } else {
                    alert('Upload failed: ' + (res.message || 'Unknown error'));
                }
            } catch (cryptoErr) {
                console.error("Upload Failure:", cryptoErr);
                alert("CLIENT ERROR: Failed to process file.");
                uploadBtn.disabled = false;
                uploadBtn.textContent = 'UPLOAD FILE 🚀';
            }
        });
    }

    // Decrypt Modal Listeners
    if (cancelDecryptBtn) {
        cancelDecryptBtn.addEventListener('click', () => {
            if (decryptModal) decryptModal.classList.add('hidden');
            currentDecryptTarget = null;
        });
    }

    if (confirmDecryptBtn) {
        confirmDecryptBtn.addEventListener('click', async () => {
            const passphrase = decryptPassphraseInput ? decryptPassphraseInput.value.trim() : '';

            if (!passphrase) {
                decryptErrorMsg.textContent = '> PASSPHRASE REQUIRED';
                return;
            }

            if (!currentDecryptTarget) return;

            confirmDecryptBtn.disabled = true;
            decryptErrorMsg.textContent = '> FETCHING & DECRYPTING PAYLOAD...';

            try {
                const response = await fetch(currentDecryptTarget.url);
                const blob = await response.blob();
                const arrayBuffer = await blob.arrayBuffer();
                const packedBytes = new Uint8Array(arrayBuffer);

                const decryptedBuffer = await decryptFileBuffer(packedBytes, passphrase);

                const decryptedBlob = new Blob([decryptedBuffer], { type: 'application/octet-stream' });
                const downloadUrl = URL.createObjectURL(decryptedBlob);
                const a = document.createElement('a');
                
                const originalName = currentDecryptTarget.name.replace(/\.enc$/, '');
                a.href = downloadUrl;
                a.download = originalName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(downloadUrl);

                if (decryptModal) decryptModal.classList.add('hidden');
                confirmDecryptBtn.disabled = false;
                if (decryptPassphraseInput) decryptPassphraseInput.value = '';
                decryptErrorMsg.textContent = '';
                currentDecryptTarget = null;
            } catch (err) {
                console.error("Decryption Error:", err);
                decryptErrorMsg.textContent = '> DECRYPTION FAILED: INVALID PASSPHRASE';
                confirmDecryptBtn.disabled = false;
            }
        });
    }

    // Provision New User (Admin)
    if (createUserForm) {
        createUserForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('new-username').value.trim();
            const email = document.getElementById('new-email').value.trim();
            const role = document.getElementById('new-role').value;
            const customPasskey = document.getElementById('new-passkey').value.trim();

            if (customPasskey && customPasskey.length !== 8) {
                alert('Password must be exactly 8 characters long.');
                return;
            }

            const res = await apiCall({
                action: 'createUser',
                username,
                email,
                role,
                passkey: customPasskey
            });

            if (res && res.success) {
                alert(`OPERATOR PROVISIONED SUCCESSFULLY!\nPASSKEY: ${res.passkey}`);
                createUserForm.reset();
                fetchUsers();
            } else {
                alert('Provisioning failed: ' + (res.message || 'Error creating user'));
            }
        });
    }

    // Data Fetching Functions
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

            const isEncrypted = file.name.endsWith('.enc');
            const icon = isEncrypted ? '🔐' : '📄';
            const actionText = isEncrypted ? '[ DECRYPT ]' : '[ DOWNLOAD ]';
            const sizeStr = formatBytes(file.size);

            card.innerHTML = `
                <span class="file-icon">${icon}</span>
                <h4 title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</h4>
                <p class="file-meta-info">${sizeStr} | BY: ${escapeHtml(file.uploadedBy || 'SYSTEM')}</p>
                <div class="file-actions-row">
                    <button class="file-action decrypt-action">${actionText}</button>
                    <button class="file-action delete" data-id="${file.id || ''}">[ PURGE ]</button>
                </div>
            `;

            const titleEl = card.querySelector('h4');
            card.addEventListener('mouseenter', () => {
                const original = titleEl.getAttribute('title');
                decipherText(titleEl, original, 15);
            });

            const actionBtn = card.querySelector('.decrypt-action');
            actionBtn.addEventListener('click', () => {
                if (isEncrypted) {
                    currentDecryptTarget = file;
                    if (decryptFilenameEl) decryptFilenameEl.textContent = `> DECRYPT: ${file.name}`;
                    if (decryptPassphraseInput) decryptPassphraseInput.value = '';
                    if (decryptErrorMsg) decryptErrorMsg.textContent = '';
                    if (decryptModal) decryptModal.classList.remove('hidden');
                } else {
                    // Direct Download for unencrypted file
                    const a = document.createElement('a');
                    a.href = file.url;
                    a.download = file.name;
                    a.target = "_blank";
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                }
            });

            const deleteBtn = card.querySelector('.delete');
            deleteBtn.addEventListener('click', () => handleDeleteFile(file.id));

            filesGrid.appendChild(card);
        });
    }

    async function handleDeleteFile(fileId) {
        if (!confirm('Permanently purge this record from memory?')) return;

        const res = await apiCall({ action: 'delete', fileId: fileId });

        if (res && res.success) {
            fetchFiles();
        } else {
            alert('Purge failed: ' + (res.message || 'Error executing request'));
        }
    }

    async function fetchUsers() {
        if (!userListContainer) return;
        userListContainer.innerHTML = '<p class="type-target">&gt; READING ACCESS DIRECTORY...</p>';
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
                    <span class="user-meta">PASSKEY: ${escapeHtml(u.passkey)} | ROLE: ${u.role}</span>
                </div>
                <span class="badge">${u.status || 'active'}</span>
            `;
            userListContainer.appendChild(div);
        });
    }
});

// Helper Functions
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
