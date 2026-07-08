// ============================================================
// CONFIGURATION
// ============================================================

const API_URL = 'http://localhost:5000/chat';

// Detect company from domain or URL param (merged from chatbot-routing branch)
function getCompanyFromDomain() {
    const urlParams = new URLSearchParams(window.location.search);
    const companyParam = urlParams.get('company');
    if (companyParam) return companyParam;

    const hostname = window.location.hostname;
    const domainMap = {
        'theconnectbpo.com': 'connect_bpo',
        'connectbpo.com':    'connect_bpo',
        'www.connectbpo.com': 'connect_bpo',
        'cospaces.lk':       'cospaces',
        'www.cospaces.lk':   'cospaces',
        'cloud99x.com':      'cloud99x',
        'www.cloud99x.com':  'cloud99x',
        'localhost':         'connect_bpo',
        '127.0.0.1':         'connect_bpo'
    };
    return domainMap[hostname] || null;
}

// ============================================================
// STATE
// ============================================================

// Allow host page to pre-set the company (used by /demo and embeds)
let company = (typeof window.__WIDGET_COMPANY__ !== 'undefined')
    ? window.__WIDGET_COMPANY__
    : getCompanyFromDomain();
let messages = [];

// ============================================================
// DOM REFERENCES
// ============================================================

const chatLauncher  = document.getElementById('chat-launcher');
const chatContainer = document.getElementById('chat-container');
const chatMessages  = document.getElementById('chat-messages');
const chatInput     = document.getElementById('chat-input');
const chatSend      = document.getElementById('chat-send');
const chatToggle    = document.getElementById('chat-toggle');
const chatTitle     = document.getElementById('chat-title');

// ============================================================
// TITLE
// ============================================================

if (company) {
    chatTitle.textContent = company.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) + ' Assistant';
} else {
    chatTitle.textContent = 'Assistant';
    console.warn('Unknown domain — configure domainMap in widget.js');
}

// ============================================================
// TOGGLE PANEL
// ============================================================

let panelOpen = false;

function openPanel() {
    chatContainer.classList.remove('hidden');
    chatContainer.classList.add('visible');
    chatLauncher.textContent = '✕';
    panelOpen = true;
    setTimeout(() => chatInput.focus(), 300);
}

function closePanel() {
    chatContainer.classList.remove('visible');
    chatContainer.classList.add('hidden');
    chatLauncher.textContent = '💬';
    panelOpen = false;
}

chatLauncher.addEventListener('click', (e) => {
    if (e.target === chatLauncher || e.currentTarget === chatLauncher) {
        if (panelOpen) {
            closePanel();
        } else {
            openPanel();
        }
    }
});

chatToggle.addEventListener('click', () => closePanel());

// ============================================================
// DRAG — launcher is freely draggable
// ============================================================

(function makeDraggable() {
    let isDragging = false;
    let startX, startY, origLeft, origTop;
    let didMove = false;

    function getPos() {
        const r = chatLauncher.getBoundingClientRect();
        return { left: r.left, top: r.top };
    }

    chatLauncher.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        isDragging = true;
        didMove = false;
        startX = e.clientX;
        startY = e.clientY;
        const pos = getPos();
        origLeft = pos.left;
        origTop  = pos.top;
        chatLauncher.classList.add('dragging');
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didMove = true;

        const newLeft = Math.max(0, Math.min(window.innerWidth  - 58, origLeft + dx));
        const newTop  = Math.max(0, Math.min(window.innerHeight - 58, origTop  + dy));

        chatLauncher.style.left   = newLeft + 'px';
        chatLauncher.style.top    = newTop  + 'px';
        chatLauncher.style.right  = 'auto';
        chatLauncher.style.bottom = 'auto';

        // Move panel relative to launcher
        const panelW = chatContainer.offsetWidth;
        const panelH = chatContainer.offsetHeight;
        let panelLeft = newLeft - panelW - 12;
        let panelTop  = newTop;
        if (panelLeft < 8) panelLeft = newLeft + 70;
        if (panelTop + panelH > window.innerHeight - 8) panelTop = window.innerHeight - panelH - 8;
        if (panelTop < 8) panelTop = 8;

        chatContainer.style.left   = panelLeft + 'px';
        chatContainer.style.top    = panelTop  + 'px';
        chatContainer.style.right  = 'auto';
        chatContainer.style.bottom = 'auto';
    });

    document.addEventListener('mouseup', () => {
        if (!isDragging) return;
        isDragging = false;
        chatLauncher.classList.remove('dragging');
        // If barely moved, treat as click (toggle already handled above)
        // didMove flag stops the click event toggling on real drags
        if (didMove) {
            chatLauncher.addEventListener('click', absorbClick, { once: true, capture: true });
        }
    });

    function absorbClick(e) {
        e.stopImmediatePropagation();
    }

    // Touch support
    chatLauncher.addEventListener('touchstart', (e) => {
        const t = e.touches[0];
        isDragging = true; didMove = false;
        startX = t.clientX; startY = t.clientY;
        const pos = getPos();
        origLeft = pos.left; origTop = pos.top;
        chatLauncher.classList.add('dragging');
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        const t = e.touches[0];
        const dx = t.clientX - startX;
        const dy = t.clientY - startY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didMove = true;

        const newLeft = Math.max(0, Math.min(window.innerWidth  - 58, origLeft + dx));
        const newTop  = Math.max(0, Math.min(window.innerHeight - 58, origTop  + dy));

        chatLauncher.style.left   = newLeft + 'px';
        chatLauncher.style.top    = newTop  + 'px';
        chatLauncher.style.right  = 'auto';
        chatLauncher.style.bottom = 'auto';
        e.preventDefault();
    }, { passive: false });

    document.addEventListener('touchend', () => {
        if (!isDragging) return;
        isDragging = false;
        chatLauncher.classList.remove('dragging');
        if (!didMove) {
            if (panelOpen) closePanel(); else openPanel();
        }
    });
})();

// ============================================================
// CORE CHAT FUNCTIONS
// ============================================================

function addMessage(text, sender) {
    const div = document.createElement('div');
    div.className = sender === 'user' ? 'user-message' : 'bot-message';
    div.textContent = text;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showTypingIndicator() {
    const wrap = document.createElement('div');
    wrap.className = 'typing-indicator';
    wrap.id = 'typing-indicator';
    for (let i = 0; i < 3; i++) {
        const dot = document.createElement('span');
        dot.className = 'typing-dot';
        wrap.appendChild(dot);
    }
    chatMessages.appendChild(wrap);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function hideTypingIndicator() {
    const el = document.getElementById('typing-indicator');
    if (el) el.remove();
}

async function sendMessage() {
    const userMessage = chatInput.value.trim();
    if (!userMessage) return;

    chatInput.value = '';
    addMessage(userMessage, 'user');

    if (!company) {
        addMessage("I'm not sure which company I'm serving. Please contact support.", 'bot');
        return;
    }

    showTypingIndicator();

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ company, question: userMessage })
        });

        hideTypingIndicator();

        if (!response.ok) {
            const err = await response.json();
            addMessage(`Error: ${err.error || 'Something went wrong'}`, 'bot');
            return;
        }

        const data = await response.json();
        addMessage(data.answer, 'bot');

    } catch (error) {
        hideTypingIndicator();
        addMessage('Sorry, I could not connect to the server. Please try again later.', 'bot');
        console.error('Widget error:', error);
    }
}

// ============================================================
// EVENT LISTENERS
// ============================================================

chatSend.addEventListener('click', sendMessage);

chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

// ============================================================
// STARTUP WELCOME
// ============================================================

if (company) {
    setTimeout(() => {
        const name = company.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        addMessage(`Hello! I'm the ${name} assistant. How can I help you today?`, 'bot');
    }, 500);
} else {
    addMessage('Hello! I notice you might be on an unrecognized domain. Please contact support.', 'bot');
}
