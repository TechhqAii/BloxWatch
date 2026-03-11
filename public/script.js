// ===== BloxWatch — Client-Side Application Logic =====

// Config
const API_BASE = '/api/roblox';
const REFRESH_INTERVAL = 30; // seconds
const PRESENCE_TYPES = {
    0: { label: 'Offline', class: 'offline', icon: '🔴' },
    1: { label: 'Online', class: 'online', icon: '🟢' },
    2: { label: 'In Game', class: 'ingame', icon: '🎮' },
    3: { label: 'In Studio', class: 'studio', icon: '🔧' },
    4: { label: 'Invisible', class: 'offline', icon: '👻' },
};

// State
let currentUserId = null;
let currentUsername = '';
let refreshTimer = null;
let countdown = REFRESH_INTERVAL;
let activityLog = [];
let lastPresenceType = null;

// ===== UTILITY =====

function getProxyUrl(subdomain, path) {
    return `${API_BASE}?subdomain=${encodeURIComponent(subdomain)}&path=${encodeURIComponent(path)}`;
}

async function robloxGet(subdomain, path) {
    const res = await fetch(getProxyUrl(subdomain, path));
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
}

async function robloxPost(subdomain, path, body) {
    const res = await fetch(getProxyUrl(subdomain, path), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
}

function formatDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getAccountAge(dateStr) {
    const created = new Date(dateStr);
    const now = new Date();
    const years = now.getFullYear() - created.getFullYear();
    const months = now.getMonth() - created.getMonth();
    if (years > 0) return `${years} year${years !== 1 ? 's' : ''} old`;
    if (months > 0) return `${months} month${months !== 1 ? 's' : ''} old`;
    return 'New account';
}

function timeNow() {
    return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ===== SEARCH =====

function setUsername(name) {
    document.getElementById('usernameInput').value = name;
    document.getElementById('usernameInput').focus();
}

async function searchUser() {
    const input = document.getElementById('usernameInput');
    const username = input.value.trim();
    if (!username) {
        showError('Please enter a Roblox username.');
        return;
    }

    hideError();
    setLoading(true);

    try {
        // Resolve username to ID
        const data = await robloxPost('users', 'v1/usernames/users', {
            usernames: [username],
            excludeBannedUsers: false,
        });

        if (!data.data || data.data.length === 0) {
            showError(`User "${username}" not found. Check spelling and try again.`);
            setLoading(false);
            return;
        }

        const user = data.data[0];
        currentUserId = user.id;
        currentUsername = user.name;

        // Fetch all data
        await loadDashboard();

        // Show dashboard
        document.getElementById('hero').style.display = 'none';
        document.getElementById('dashboard').classList.remove('hidden');

        // Start auto-refresh
        startRefreshTimer();
    } catch (err) {
        console.error('Search error:', err);
        showError('Failed to connect to Roblox. Please try again.');
    }

    setLoading(false);
}

// Enter key support
document.getElementById('usernameInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') searchUser();
});

// ===== DASHBOARD DATA =====

async function loadDashboard() {
    await Promise.all([
        loadProfile(),
        loadPresence(),
        loadFriends(),
        loadAvatar(),
    ]);
}

async function loadProfile() {
    try {
        const user = await robloxGet('users', `v1/users/${currentUserId}`);
        document.getElementById('displayName').textContent = user.displayName || user.name;
        document.getElementById('usernameTag').textContent = `@${user.name}`;
        document.getElementById('accountAge').textContent = `Joined ${formatDate(user.created)} · ${getAccountAge(user.created)}`;
        document.getElementById('userId').textContent = `ID: ${user.id}`;

        // Update chat safety based on account age
        updateChatSafety(user);
    } catch (err) {
        console.error('Profile error:', err);
    }
}

async function loadPresence() {
    try {
        const data = await robloxPost('presence', 'v1/presence/users', {
            userIds: [currentUserId],
        });

        if (data.userPresences && data.userPresences.length > 0) {
            const presence = data.userPresences[0];
            updatePresenceUI(presence);
            logActivity(presence);
        }
    } catch (err) {
        console.error('Presence error:', err);
        updatePresenceUI({ userPresenceType: 0 });
    }
}

function updatePresenceUI(presence) {
    const type = PRESENCE_TYPES[presence.userPresenceType] || PRESENCE_TYPES[0];
    const badge = document.getElementById('statusBadge');
    const statusText = document.getElementById('statusText');
    const gameCard = document.getElementById('gameCard');

    // Update badge
    badge.className = `status-badge ${type.class}`;
    statusText.textContent = type.label;

    // Update game card
    const gameName = document.getElementById('gameName');
    const gameSub = document.getElementById('gameSub');
    const gameLink = document.getElementById('gameLink');
    const gameThumbnail = document.getElementById('gameThumbnail');

    if (presence.userPresenceType === 2) {
        // In Game
        if (presence.lastLocation) {
            gameName.textContent = presence.lastLocation;
        } else {
            gameName.textContent = 'Playing a Game';
        }
        gameSub.textContent = 'Currently in-game';


        if (presence.placeId) {
            gameLink.href = `https://www.roblox.com/games/${presence.placeId}`;
            gameLink.style.display = 'inline-flex';

            // Try to load game thumbnail
            loadGameThumbnail(presence.universeId || presence.placeId);
        } else {
            gameLink.style.display = 'none';
            gameSub.textContent = 'In a game (details require auth)';
        }

        gameCard.style.borderColor = 'rgba(59, 130, 246, 0.3)';
    } else if (presence.userPresenceType === 3) {
        gameName.textContent = 'Roblox Studio';
        gameSub.textContent = 'Building / Developing';
        gameLink.style.display = 'none';
        gameCard.style.borderColor = 'rgba(168, 85, 247, 0.3)';
    } else if (presence.userPresenceType === 1) {
        gameName.textContent = 'Online';
        gameSub.textContent = 'On the Roblox website or app';
        gameLink.style.display = 'none';
        gameCard.style.borderColor = 'rgba(0, 255, 136, 0.3)';
    } else {
        gameName.textContent = 'Offline';
        gameSub.textContent = presence.lastOnline
            ? `Last seen: ${new Date(presence.lastOnline).toLocaleString()}`
            : 'Not currently online';
        gameLink.style.display = 'none';
        gameCard.style.borderColor = 'var(--border)';
    }
}

async function loadGameThumbnail(universeId) {
    try {
        const data = await robloxGet('thumbnails', `v1/games/icons?universeIds=${universeId}&returnPolicy=PlaceHolder&size=150x150&format=Png&isCircular=false`);
        if (data.data && data.data.length > 0 && data.data[0].imageUrl) {
            const thumb = document.getElementById('gameThumbnail');
            thumb.innerHTML = `<img src="${data.data[0].imageUrl}" alt="Game thumbnail">`;
        }
    } catch (err) {
        // Silently fail — placeholder stays
    }
}

async function loadAvatar() {
    try {
        const data = await robloxGet('thumbnails', `v1/users/avatar?userIds=${currentUserId}&size=420x420&format=Png&isCircular=false`);
        if (data.data && data.data.length > 0) {
            const avatarImg = document.getElementById('avatarImg');
            avatarImg.src = data.data[0].imageUrl;
            avatarImg.alt = `${currentUsername}'s avatar`;
        }
    } catch (err) {
        console.error('Avatar error:', err);
    }
}

async function loadFriends() {
    const container = document.getElementById('friendsList');

    try {
        const data = await robloxGet('friends', `v1/users/${currentUserId}/friends`);
        const friends = data.data || [];

        document.getElementById('friendCount').textContent = friends.length;

        if (friends.length === 0) {
            container.innerHTML = `<div class="timeline-empty"><p>No friends found.</p></div>`;
            return;
        }

        // Get thumbnails for friends (batch, max 100)
        const friendIds = friends.slice(0, 50).map(f => f.id);
        let thumbnails = {};
        try {
            const thumbData = await robloxGet('thumbnails', `v1/users/avatar-headshot?userIds=${friendIds.join(',')}&size=48x48&format=Png&isCircular=false`);
            if (thumbData.data) {
                thumbData.data.forEach(t => {
                    thumbnails[t.targetId] = t.imageUrl;
                });
            }
        } catch (e) { /* continue without thumbnails */ }

        // Get presence for friends
        let presences = {};
        try {
            const presData = await robloxPost('presence', 'v1/presence/users', {
                userIds: friendIds,
            });
            if (presData.userPresences) {
                presData.userPresences.forEach(p => {
                    presences[p.userId] = p;
                });
            }
        } catch (e) { /* continue without presence */ }

        // Sort: online/ingame first
        friends.sort((a, b) => {
            const pa = presences[a.id]?.userPresenceType || 0;
            const pb = presences[b.id]?.userPresenceType || 0;
            return pb - pa;
        });

        container.innerHTML = friends.map(friend => {
            const thumb = thumbnails[friend.id] || '';
            const pres = presences[friend.id];
            const presType = pres ? PRESENCE_TYPES[pres.userPresenceType] || PRESENCE_TYPES[0] : PRESENCE_TYPES[0];
            const presClass = presType.class;

            return `
                <div class="friend-item">
                    <div class="friend-avatar">
                        ${thumb ? `<img src="${thumb}" alt="${friend.name}">` : ''}
                    </div>
                    <div class="friend-info">
                        <p class="friend-name">${friend.displayName || friend.name}</p>
                        <p class="friend-status ${presClass}">${presType.label}${pres && pres.lastLocation ? ` · ${pres.lastLocation}` : ''}</p>
                    </div>
                    <div class="friend-presence-dot ${presClass}"></div>
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error('Friends error:', err);
        container.innerHTML = `<div class="timeline-empty"><p>Could not load friends.</p></div>`;
    }
}

function updateChatSafety(user) {
    const accountAge = new Date() - new Date(user.created);
    const ageInYears = accountAge / (1000*60*60*24*365);

    // Estimates based on Roblox policies
    const filterEl = document.getElementById('chatFilter');
    const privateEl = document.getElementById('privateServers');
    const visibilityEl = document.getElementById('accountVisibility');

    filterEl.textContent = 'Active (Auto-filtered)';
    filterEl.style.color = 'var(--accent)';

    if (ageInYears < 1) {
        privateEl.textContent = 'New Account — Limited';
        visibilityEl.textContent = 'Restricted';
    } else {
        privateEl.textContent = 'May be available';
        visibilityEl.textContent = 'Standard';
    }
}

// ===== ACTIVITY TIMELINE =====

function logActivity(presence) {
    const type = PRESENCE_TYPES[presence.userPresenceType] || PRESENCE_TYPES[0];

    // Only log if status changed
    if (lastPresenceType !== null && lastPresenceType === presence.userPresenceType) {
        return;
    }
    lastPresenceType = presence.userPresenceType;

    const entry = {
        time: timeNow(),
        type: type.class,
        label: type.label,
        detail: presence.lastLocation || '',
        icon: type.icon,
    };

    activityLog.unshift(entry);

    // Only keep last 50 entries
    if (activityLog.length > 50) activityLog.pop();

    renderTimeline();
}

function renderTimeline() {
    const container = document.getElementById('timeline');

    if (activityLog.length === 0) {
        container.innerHTML = `
            <div class="timeline-empty">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <p>Activity will appear here as status changes are detected.</p>
            </div>`;
        return;
    }

    container.innerHTML = activityLog.map(entry => `
        <div class="timeline-item ${entry.type}">
            <span class="timeline-time">${entry.time}</span>
            <div class="timeline-content">
                <p class="timeline-label">${entry.icon} ${entry.label}</p>
                ${entry.detail ? `<p class="timeline-detail">${entry.detail}</p>` : ''}
            </div>
        </div>
    `).join('');
}

function clearTimeline() {
    activityLog = [];
    lastPresenceType = null;
    renderTimeline();
}

// ===== REFRESH =====

function startRefreshTimer() {
    stopRefreshTimer();
    countdown = REFRESH_INTERVAL;
    updateCountdown();

    refreshTimer = setInterval(() => {
        countdown--;
        updateCountdown();

        if (countdown <= 0) {
            countdown = REFRESH_INTERVAL;
            refreshData();
        }
    }, 1000);
}

function stopRefreshTimer() {
    if (refreshTimer) {
        clearInterval(refreshTimer);
        refreshTimer = null;
    }
}

function updateCountdown() {
    const text = document.getElementById('countdownText');
    const circle = document.getElementById('countdownCircle');

    text.textContent = countdown;

    // SVG circle progress: circumference = 2 * PI * r = 2 * PI * 16 ≈ 100.53
    const circumference = 100.53;
    const progress = (countdown / REFRESH_INTERVAL) * circumference;
    circle.setAttribute('stroke-dashoffset', circumference - progress);
}

async function refreshData() {
    countdown = REFRESH_INTERVAL;
    updateCountdown();

    try {
        await Promise.all([
            loadPresence(),
            loadFriends(),
        ]);
    } catch (err) {
        console.error('Refresh error:', err);
    }
}

// ===== NAVIGATION =====

function goBack() {
    stopRefreshTimer();
    document.getElementById('hero').style.display = '';
    document.getElementById('dashboard').classList.add('hidden');
    currentUserId = null;
    currentUsername = '';
    activityLog = [];
    lastPresenceType = null;
    document.getElementById('usernameInput').value = '';
    document.getElementById('usernameInput').focus();
}

// ===== UI HELPERS =====

function showError(msg) {
    const el = document.getElementById('errorMessage');
    el.textContent = msg;
    el.classList.add('visible');
    el.style.display = 'block';
}

function hideError() {
    const el = document.getElementById('errorMessage');
    el.classList.remove('visible');
    el.style.display = 'none';
}

function setLoading(loading) {
    const loader = document.getElementById('searchLoader');
    const btnText = document.querySelector('.btn-text');
    if (loading) {
        loader.classList.add('active');
        btnText.textContent = 'Tracking...';
    } else {
        loader.classList.remove('active');
        btnText.textContent = 'Track';
    }
}
