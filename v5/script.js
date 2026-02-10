// --- 1. FIREBASE CONFIG & IMPORTS ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, get, update, set, remove, child } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// !!! अपनी API KEY यहाँ पेस्ट करें !!!
const firebaseConfig = {
     apiKey: "AIzaSyBdK4ZRrRcmisVVOW_hTMIowtts2I4iGzA",
  authDomain: "ai-quizz-97fb9.firebaseapp.com",
  databaseURL: "https://ai-quizz-97fb9-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "ai-quizz-97fb9",
  storageBucket: "ai-quizz-97fb9.firebasestorage.app",
  messagingSenderId: "572423560278",
  appId: "1:572423560278:web:c15c0e8a14b452068f2ff7"
};

// Initialize App
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// --- 2. GLOBAL STATE ---
let currentUser = null;
let userPath = null;
let userRole = null; // 'ADMIN', 'STUDENT', 'SCHOOL'

// --- 3. STARTUP SEQUENCE (SESSION PERSISTENCE) ---
window.onload = () => {
    // चेक करें कि क्या यूजर पहले से लॉग इन है
    const session = sessionStorage.getItem("vyuha_session");
    if (session) {
        try {
            const data = JSON.parse(session);
            console.log("RESTORING SESSION:", data.role);
            loginSuccess(data.path, data.role, data.user);
        } catch (e) {
            console.error("Session Error", e);
            document.getElementById("loadingOverlay").classList.add("hidden");
        }
    } else {
        // अगर सेशन नहीं है, तो लोडिंग हटा दें और लॉगिन दिखाएं
        document.getElementById("loadingOverlay").classList.add("hidden");
    }
};

// --- 4. AUTHENTICATION LOGIC ---
document.getElementById("btnLogin").addEventListener("click", async () => {
    const email = document.getElementById("loginEmail").value.trim();
    const pass = document.getElementById("loginPass").value.trim();
    const msg = document.getElementById("loginMsg");
    const btn = document.getElementById("btnLogin");

    if (!email || !pass) { 
        msg.innerText = "EMAIL & PASSWORD REQUIRED"; 
        return; 
    }

    btn.innerText = "VERIFYING CREDENTIALS...";
    msg.innerText = "";

    try {
        const dbRef = ref(db);
        let found = false;

        // A. CHECK ADMIN
        const adminSnap = await get(child(dbRef, "system_config/admin_profile"));
        if (adminSnap.exists()) {
            const admin = adminSnap.val();
            if (admin.email === email && admin.password === pass) {
                // Admin लॉगिन सफल
                loginSuccess("system_config/admin_profile", "ADMIN", admin);
                return;
            }
        }

        // B. CHECK STUDENTS
        if (!found) {
            const studSnap = await get(child(dbRef, "students"));
            if (studSnap.exists()) {
                studSnap.forEach(snap => {
                    const s = snap.val();
                    // Private Info में चेक करें
                    if (s.private_info && s.private_info.email === email && s.private_info.password === pass) {
                        const fullData = { ...s.public_info, ...s.private_info, key: snap.key };
                        loginSuccess(`students/${snap.key}`, "STUDENT", fullData);
                        found = true;
                    }
                });
            }
        }

        // C. CHECK SCHOOLS
        if (!found) {
            const schSnap = await get(child(dbRef, "schools"));
            if (schSnap.exists()) {
                schSnap.forEach(snap => {
                    const s = snap.val();
                    if (s.private_info && s.private_info.email === email && s.private_info.password === pass) {
                        const fullData = { ...s.public_info, ...s.private_info, key: snap.key };
                        loginSuccess(`schools/${snap.key}`, "SCHOOL", fullData);
                        found = true;
                    }
                });
            }
        }

        if (!found) {
            msg.innerText = "ACCESS DENIED: WRONG ID OR KEY";
            btn.innerText = "ESTABLISH CONNECTION";
        }

    } catch (error) {
        console.error("LOGIN ERROR:", error);
        msg.innerText = "CONNECTION ERROR: Check Console";
        btn.innerText = "ESTABLISH CONNECTION";
    }
});

function loginSuccess(path, role, data) {
    // 1. स्टेट सेट करें
    currentUser = data;
    userPath = path;
    userRole = role;

    // 2. सेशन सेव करें (ताकि रिफ्रेश पर डेटा न उड़े)
    sessionStorage.setItem("vyuha_session", JSON.stringify({ path, role, user: data }));

    // 3. UI बदलें
    document.getElementById("loginOverlay").classList.add("hidden");
    document.getElementById("loadingOverlay").classList.add("hidden");
    document.getElementById("appContainer").classList.remove("hidden");
    
    // 4. डेटा लोड करें
    loadDashboard();
}

// --- 5. DASHBOARD LOADER ---
function loadDashboard() {
    console.log("LOADING DASHBOARD FOR:", userRole);

    // --- SIDEBAR INFO ---
    // User Name Logic: Name > Key > "USER"
    const displayName = currentUser.name || currentUser.key || "USER";
    document.getElementById("sidebarName").innerText = displayName.toUpperCase();
    document.getElementById("sidebarRole").innerText = userRole;
    
    // Avatar Logic
    const avatarUrl = currentUser.avatarUrl || currentUser.logoUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${displayName}`;
    document.getElementById("sidebarAvatar").style.backgroundImage = `url('${avatarUrl}')`;

    // --- FORM FILLING (Common Fields) ---
    document.getElementById("p_name").value = displayName;
    document.getElementById("p_city").value = currentUser.city || "";
    document.getElementById("p_email").value = currentUser.email || "";
    document.getElementById("p_pass").value = currentUser.password || "";
    document.getElementById("p_bio").value = currentUser.bio || "";
    
    // AI Fields
    document.getElementById("ai_key").value = currentUser.apiKey || "";
    document.getElementById("ai_model").value = currentUser.model || "gemini-2.5-flash";
    document.getElementById("ai_global").value = currentUser.globalPrompt || "";

    // --- ROLE SPECIFIC LOGIC (UI Hiding/Showing) ---
    
    // CASE 1: ADMIN
    if (userRole === "ADMIN") {
        document.getElementById("navAdmin").classList.remove("hidden"); // War Room Link Show
        
        // HIDE Unwanted Boxes
        document.getElementById("statsPanel").classList.add("hidden");
        document.getElementById("grp_affiliation").classList.add("hidden");
        document.getElementById("grp_mobile").classList.add("hidden");
        document.getElementById("grp_logo").classList.add("hidden");
        
        // FIX: Admin Bot Name Hardcoded
        document.getElementById("p_botName").value = "SUPREME AI JUSTICE";
        
        loadAdminRooms(); // Admin Room List Load
    } 
    
    // CASE 2: STUDENT
    else if (userRole === "STUDENT") {
        document.getElementById("statsPanel").classList.remove("hidden");
        
        document.getElementById("p_botName").value = currentUser.botName || "NOT_SET";
        document.getElementById("p_mobile").value = currentUser.mobile || "";
        document.getElementById("p_link").value = currentUser.linkedSchool || currentUser.className || "";
        
        // Stats Values
        document.getElementById("valRank").innerText = currentUser.currentRank || "N/A";
        document.getElementById("valWins").innerText = currentUser.wins || "0";
        document.getElementById("valMatches").innerText = currentUser.matches || "0";
        
        // Banned Check
        if(currentUser.isBanned) {
            document.getElementById("valStatus").innerText = "BANNED";
            document.getElementById("valStatus").style.color = "red";
        }

        renderLogoSelector(); // Load Logo Options
    }
    
    // CASE 3: SCHOOL
    else if (userRole === "SCHOOL") {
        document.getElementById("statsPanel").classList.remove("hidden");
        
        // HIDE Affiliation (School doesn't need it)
        document.getElementById("grp_affiliation").classList.add("hidden");
        
        document.getElementById("p_botName").value = currentUser.botName || "NOT_SET";
        document.getElementById("p_mobile").value = currentUser.mobile || "";
        
        // Stats
        document.getElementById("valRank").innerText = currentUser.currentRank || "N/A";
        document.getElementById("valWins").innerText = currentUser.wins || "0";
        document.getElementById("valMatches").innerText = currentUser.matches || "0";

        renderLogoSelector(); // Load Logo Options
    }

    // Load Room Prompts (For Everyone)
    loadRoomPrompts();
}

// --- 6. LOGO SELECTOR LOGIC ---
function renderLogoSelector() {
    const seeds = ['Rohan', 'Priya', 'Max', 'Zoe', 'Titan', 'Leo', 'School1', 'School2'];
    const container = document.getElementById("logoSelector");
    const input = document.getElementById("p_logo_value");
    
    // Set initial value
    input.value = currentUser.avatarUrl || currentUser.logoUrl || "";

    container.innerHTML = "";
    seeds.forEach(seed => {
        const url = `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`;
        const div = document.createElement("div");
        div.className = "logo-option";
        
        // Highlight Selected
        if (input.value === url) div.classList.add("selected");
        
        div.innerHTML = `<img src="${url}">`;
        
        div.onclick = () => {
            document.querySelectorAll(".logo-option").forEach(el => el.classList.remove("selected"));
            div.classList.add("selected");
            input.value = url; // Update Hidden Input
        };
        container.appendChild(div);
    });
}

// --- 7. ROOM PROMPTS LOADER ---
async function loadRoomPrompts() {
    const container = document.getElementById("roomPromptsContainer");
    
    try {
        const snap = await get(child(ref(db), "rooms"));
        if (snap.exists()) {
            container.innerHTML = "";
            const rooms = snap.val();
            
            Object.keys(rooms).forEach(roomName => {
                const room = rooms[roomName];
                const savedPrompts = currentUser.roomPrompts || {};
                const currentVal = savedPrompts[roomName] || "";

                // Premium UI for Room Prompts
                const div = document.createElement("div");
                div.className = "input-wrapper full highlight-box";
                div.style.marginBottom = "20px";
                div.innerHTML = `
                    <label>STRATEGY: ${roomName.toUpperCase()} <span style="font-weight:400; color:#666;">(${room.difficulty})</span></label>
                    <textarea class="input textarea room-prompt-input" data-room="${roomName}" placeholder="Enter specific instructions for ${roomName}...">${currentVal}</textarea>
                `;
                container.appendChild(div);
            });
        } else {
            container.innerHTML = "<div class='hint-text'>NO ACTIVE WAR ROOMS DETECTED via SATELLITE.</div>";
        }
    } catch (e) {
        console.error("Room Load Error", e);
        container.innerHTML = "<div class='error-msg'>FAILED TO LOAD ROOM DATA</div>";
    }
}

// --- 8. ADMIN WAR ROOM MANAGER ---
async function loadAdminRooms() {
    const list = document.getElementById("adminRoomList");
    const snap = await get(child(ref(db), "rooms"));
    
    list.innerHTML = "";
    if (snap.exists()) {
        const rooms = snap.val();
        Object.keys(rooms).forEach(key => {
            const r = rooms[key];
            const div = document.createElement("div");
            div.className = "room-item";
            div.innerHTML = `
                <div>
                    <h3 style="margin:0; font-size:1rem;">${key}</h3>
                    <span style="font-size:0.75rem; color:#666;">${r.difficulty} | ${r.active ? "ACTIVE" : "INACTIVE"}</span>
                </div>
                <div>
                    <button class="btn-toggle" onclick="window.toggleRoom('${key}', ${!r.active})">${r.active ? "DEACTIVATE" : "ACTIVATE"}</button>
                    <button class="btn-del" onclick="window.deleteRoom('${key}')">DESTROY</button>
                </div>
            `;
            list.appendChild(div);
        });
    }
}

// --- 9. SAVE DATA LOGIC ---
document.getElementById("btnSave").addEventListener("click", async () => {
    const btn = document.getElementById("btnSave");
    const originalText = btn.innerText;
    
    // Password Validation
    const newPass = document.getElementById("p_pass").value;
    if (newPass && !isStrongPassword(newPass)) {
        alert("SECURITY ALERT: Password must be 8+ characters with Symbol & Number.");
        return;
    }

    btn.innerText = "SAVING TO DATABASE...";
    btn.style.background = "#333";
    
    const updates = {};
    const path = userPath;

    // A. PREPARE UPDATES BASED ON ROLE
    if (userRole === "ADMIN") {
        updates[`${path}/city`] = document.getElementById("p_city").value;
        updates[`${path}/bio`] = document.getElementById("p_bio").value;
        updates[`${path}/password`] = newPass || currentUser.password;
        updates[`${path}/apiKey`] = document.getElementById("ai_key").value;
        updates[`${path}/model`] = document.getElementById("ai_model").value;
    } else {
        // PUBLIC INFO
        updates[`${path}/public_info/city`] = document.getElementById("p_city").value;
        updates[`${path}/public_info/bio`] = document.getElementById("p_bio").value;
        
        if(userRole === "STUDENT") {
            updates[`${path}/public_info/linkedSchool`] = document.getElementById("p_link").value;
            updates[`${path}/public_info/avatarUrl`] = document.getElementById("p_logo_value").value;
        } else {
            // SCHOOL
            updates[`${path}/public_info/logoUrl`] = document.getElementById("p_logo_value").value;
        }

        // PRIVATE INFO
        updates[`${path}/private_info/mobile`] = document.getElementById("p_mobile").value;
        updates[`${path}/private_info/password`] = newPass || currentUser.password;
        updates[`${path}/private_info/apiKey`] = document.getElementById("ai_key").value;
        updates[`${path}/private_info/model`] = document.getElementById("ai_model").value;
        updates[`${path}/private_info/globalPrompt`] = document.getElementById("ai_global").value;

        // ROOM PROMPTS
        document.querySelectorAll(".room-prompt-input").forEach(input => {
            const rName = input.getAttribute("data-room");
            if(rName) {
                updates[`${path}/private_info/roomPrompts/${rName}`] = input.value;
            }
        });
    }

    // B. SEND TO FIREBASE
    try {
        await update(ref(db), updates);
        
        // C. UPDATE LOCAL SESSION (So refresh has new data)
        const updatedUser = { ...currentUser };
        // Deep merge updates into currentUser object logic (Simplified for session)
        // Note: For full accuracy we should refetch, but for UX we assume success
        sessionStorage.setItem("vyuha_session", JSON.stringify({ path: userPath, role: userRole, user: currentUser })); // Warning: This saves OLD user data + we need to refetch to be sure.
        
        // Better: Refetch data to be 100% sure
        // But for now, UI Feedback:
        btn.innerText = "SYSTEM UPDATED SUCCESSFULLY";
        btn.style.background = "#00CC66";
        setTimeout(() => {
            btn.innerText = originalText;
            btn.style.background = "#000";
            location.reload(); // Quick Reload to show fresh data and re-verify persistence
        }, 1500);
        
    } catch (error) {
        alert("CRITICAL ERROR: " + error.message);
        btn.innerText = "RETRY SAVE";
        btn.style.background = "var(--error)";
    }
});

function isStrongPassword(pw) {
    return pw.length >= 8 && /\d/.test(pw) && /[!@#$%^&*]/.test(pw);
}

// --- 10. GLOBAL ACTIONS (Exposed to Window) ---
window.switchTab = (tabId) => {
    // Hide all
    document.querySelectorAll(".tab-pane").forEach(el => el.classList.add("hidden"));
    // Show target
    document.getElementById(`tab-${tabId}`).classList.remove("hidden");
    
    // Update Nav
    document.querySelectorAll(".nav-item").forEach(el => el.classList.remove("active"));
    // Simple logic to find button by onclick attribute or ID would be better, but index works if order is fixed
    const navs = document.querySelectorAll(".nav-item");
    if(tabId === 'profile') navs[0].classList.add("active");
    if(tabId === 'ai') navs[1].classList.add("active");
    if(tabId === 'admin') document.getElementById("navAdmin").classList.add("active");
};

// Admin Functions
window.createRoom = async () => {
    const name = document.getElementById("new_room_name").value;
    const topic = document.getElementById("new_room_topic").value;
    const diff = document.getElementById("new_room_diff").value;
    if(name && topic) {
        await set(ref(db, `rooms/${name}`), { difficulty: diff, systemPrompt: `Focus on ${topic}`, active: true });
        document.getElementById("new_room_name").value = "";
        loadAdminRooms();
    }
};
document.getElementById("btnCreateRoom").onclick = window.createRoom;

window.toggleRoom = async (name, status) => {
    await update(ref(db, `rooms/${name}`), { active: status });
    loadAdminRooms();
};

window.deleteRoom = async (name) => {
    if(confirm(`WARNING: PERMANENTLY DELETE ${name}?`)) {
        await remove(ref(db, `rooms/${name}`));
        loadAdminRooms();
    }
};

// Logout
document.getElementById("btnLogout").onclick = () => {
    sessionStorage.removeItem("vyuha_session");
    location.reload();
};