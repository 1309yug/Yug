// Hardcoded authorization matrix
const PASSWORDS = {
    "owner123": { id: "owner1", role: "Primary Owner", canManage: true },
    "owner456": { id: "owner2", role: "Co-Owner", canManage: false },
    "view789":  { id: "viewer1", role: "Viewer", canManage: false },
    "view000":  { id: "viewer2", role: "Viewer", canManage: false }
};

// Initialize active status configuration in localStorage if it doesn't exist
if (!localStorage.getItem("system_access_states")) {
    const defaultStates = { owner2: true, viewer1: true, viewer2: true };
    localStorage.setItem("system_access_states", JSON.stringify(defaultStates));
}

// DOM elements
const loginForm = document.getElementById("login-form");
const passwordInput = document.getElementById("password-input");
const errorMsg = document.getElementById("error-message");
const loginCard = document.getElementById("login-card");
const dashboard = document.getElementById("dashboard");
const roleBadge = document.getElementById("role-badge");
const logoutBtn = document.getElementById("logout-btn");
const ownerControls = document.getElementById("owner-controls");

// Handle User Authentication
loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const inputPass = passwordInput.value.trim();
    errorMsg.textContent = "";

    if (PASSWORDS[inputPass]) {
        const user = PASSWORDS[inputPass];
        const accessStates = JSON.parse(localStorage.getItem("system_access_states"));

        // Check if the credential has been suspended (ignored for primary owner)
        if (user.id !== "owner1" && !accessStates[user.id]) {
            errorMsg.textContent = "Access suspended by administrator.";
            return;
        }

        // Access Granted -> Setup View
        launchDashboard(user);
    } else {
        errorMsg.textContent = "Invalid password. Access denied.";
    }
});

function launchDashboard(user) {
    loginCard.classList.add("hidden");
    dashboard.classList.remove("hidden");
    roleBadge.textContent = user.role;
    
    // Style badges visually by role
    if (user.id === "owner1") {
        roleBadge.style.background = "#22c55e"; // Green
        ownerControls.classList.remove("hidden");
        renderControlButtons();
    } else if (user.id === "owner2") {
        roleBadge.style.background = "#3b82f6"; // Blue
        ownerControls.classList.add("hidden");
    } else {
        roleBadge.style.background = "#64748b"; // Gray
        ownerControls.classList.add("hidden");
    }
}

// Render dynamic administrative control toggles
function renderControlButtons() {
    const accessStates = JSON.parse(localStorage.getItem("system_access_states"));
    
    setupToggleElement("toggle-owner2", "owner2", accessStates);
    setupToggleElement("toggle-viewer1", "viewer1", accessStates);
    setupToggleElement("toggle-viewer2", "viewer2", accessStates);
}

function setupToggleElement(buttonId, targetId, states) {
    const btn = document.getElementById(buttonId);
    const isActive = states[targetId];
    
    btn.textContent = isActive ? "Suspend" : "Activate";
    btn.style.background = isActive ? "#ef4444" : "#22c55e";
    
    // Attach event handler
    btn.onclick = () => {
        states[targetId] = !states[targetId];
        localStorage.setItem("system_access_states", JSON.stringify(states));
        renderControlButtons();
    };
}

// Session terminate handler
logoutBtn.addEventListener("click", () => {
    passwordInput.value = "";
    dashboard.classList.add("hidden");
    loginCard.classList.remove("hidden");
});
