// --- Application State ---
let state = {
    companies: [],
    currentCompany: '',
    faqs: [],
    history: [],
    stats: {},
    activeView: 'chat', // 'chat' or 'admin'
    activeAdminSubview: 'stats', // 'stats', 'faqs', or 'logs'
    threshold: 0.60
};

// --- Initial Setup ---
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

async function initApp() {
    // Set initial threshold display
    const slider = document.getElementById('threshold-slider');
    if (slider) {
        state.threshold = parseFloat(slider.value) / 100;
        updateThresholdDisplay(slider.value);
    }
    
    // Load companies first
    await fetchCompanies();
    
    // Bind change handler to sidebar company selector
    const companySelect = document.getElementById('sidebar-company-select');
    companySelect.addEventListener('change', (e) => {
        handleCompanyChange(e.target.value);
    });

    // Handle form submit bindings
    const chatForm = document.getElementById('chat-form');
    if (chatForm) {
        chatForm.addEventListener('submit', sendChatMessage);
    }

    // Load initial data
    refreshDashboardData();
}

// --- Navigation ---
function switchView(view) {
    state.activeView = view;
    
    // Manage active classes on nav buttons
    document.getElementById('nav-chat').classList.toggle('active', view === 'chat');
    document.getElementById('nav-admin').classList.toggle('active', view === 'admin');
    
    // Manage active classes on main content panels
    document.getElementById('chat-view').classList.toggle('active', view === 'chat');
    document.getElementById('admin-view').classList.toggle('active', view === 'admin');
    
    // Update Header title
    const headerTitle = document.getElementById('view-title');
    const headerSubtitle = document.getElementById('view-subtitle');
    
    if (view === 'chat') {
        headerTitle.innerText = "Chat Assistant";
        headerSubtitle.innerText = `Interact with the FAQ chatbot for ${formatCompanyName(state.currentCompany)}`;
    } else {
        headerTitle.innerText = "Admin Dashboard";
        headerSubtitle.innerText = "Monitor system logs, manage FAQ dataset, and view analytics";
        refreshDashboardData();
    }
}

function switchAdminSubView(subview) {
    state.activeAdminSubview = subview;
    
    // Manage active subview buttons
    const tabBtns = document.querySelectorAll('.admin-tab-btn');
    tabBtns.forEach((btn, idx) => {
        // Simple match based on order or text content
        const iconHTML = btn.innerHTML;
        const isActive = (subview === 'stats' && idx === 0) || 
                         (subview === 'faqs' && idx === 1) || 
                         (subview === 'logs' && idx === 2);
        btn.classList.toggle('active', isActive);
    });
    
    // Switch active state for container divs
    document.getElementById('admin-subview-stats').classList.toggle('active', subview === 'stats');
    document.getElementById('admin-subview-faqs').classList.toggle('active', subview === 'faqs');
    document.getElementById('admin-subview-logs').classList.toggle('active', subview === 'logs');
    
    // Trigger specific data updates
    if (subview === 'stats') {
        fetchStats();
    } else if (subview === 'faqs') {
        fetchFAQs();
    } else if (subview === 'logs') {
        fetchHistory();
    }
}

// --- Data Fetching ---
async function fetchCompanies() {
    try {
        const response = await fetch('/api/companies');
        const data = await response.json();
        state.companies = data.companies || [];
        
        // Populate selectors
        populateCompanySelectors();
        
        // Select default company if none set
        if (state.companies.length > 0 && !state.currentCompany) {
            handleCompanyChange(state.companies[0]);
        }
    } catch (err) {
        showToast("Error loading companies: " + err.message, "error");
    }
}

async function handleCompanyChange(company) {
    state.currentCompany = company;
    
    // Update active dropdown value
    document.getElementById('sidebar-company-select').value = company;
    
    // Update badge UI
    document.getElementById('current-company-name').innerText = formatCompanyName(company);
    
    // Update header subtitle if on chat view
    if (state.activeView === 'chat') {
        document.getElementById('view-subtitle').innerText = `Interact with the FAQ chatbot for ${formatCompanyName(company)}`;
    }
    
    // Reset Chat messages for new company context
    resetChatWindow();
    
    // Update suggestions for the active company
    await fetchFAQs(); // Needed to feed current company's suggested questions
    renderSuggestions();
    
    // Show toast for switch confirmation
    showToast(`Switched active context to: ${formatCompanyName(company)}`, "info");
}

async function fetchFAQs() {
    try {
        const response = await fetch('/api/faqs');
        const data = await response.json();
        state.faqs = data.faqs || [];
        
        renderFAQTable();
        populateFormCompanyList();
        renderSuggestions(); // Update suggestions based on latest loaded FAQs
    } catch (err) {
        showToast("Error fetching FAQs: " + err.message, "error");
    }
}

async function fetchHistory() {
    try {
        const response = await fetch('/api/history');
        const data = await response.json();
        state.history = data.history || [];
        
        renderLogsTable();
    } catch (err) {
        showToast("Error loading logs: " + err.message, "error");
    }
}

async function fetchStats() {
    try {
        const response = await fetch('/api/stats');
        const data = await response.json();
        state.stats = data;
        
        renderStats();
    } catch (err) {
        showToast("Error loading dashboard metrics: " + err.message, "error");
    }
}

function refreshDashboardData() {
    fetchFAQs();
    fetchHistory();
    fetchStats();
}

// --- UI Rendering Helpers ---

function formatCompanyName(name) {
    if (!name) return "Select Company";
    return name
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

function populateCompanySelectors() {
    const sidebarSelect = document.getElementById('sidebar-company-select');
    const faqFilter = document.getElementById('faq-company-filter');
    
    if (sidebarSelect) {
        sidebarSelect.innerHTML = '';
        state.companies.forEach(company => {
            const opt = document.createElement('option');
            opt.value = company;
            opt.textContent = formatCompanyName(company);
            sidebarSelect.appendChild(opt);
        });
        if (state.currentCompany) {
            sidebarSelect.value = state.currentCompany;
        }
    }
    
    if (faqFilter) {
        faqFilter.innerHTML = '<option value="all">All Companies</option>';
        state.companies.forEach(company => {
            const opt = document.createElement('option');
            opt.value = company;
            opt.textContent = formatCompanyName(company);
            faqFilter.appendChild(opt);
        });
    }
}

function populateFormCompanyList() {
    const modalSelect = document.getElementById('faq-form-company-select');
    if (modalSelect) {
        modalSelect.innerHTML = '<option value="">-- Create New Company --</option>';
        state.companies.forEach(company => {
            const opt = document.createElement('option');
            opt.value = company;
            opt.textContent = formatCompanyName(company);
            modalSelect.appendChild(opt);
        });
    }
}

// --- Chat View Functions ---

function resetChatWindow() {
    const chatBox = document.getElementById('chat-messages-box');
    if (!chatBox) return;
    
    chatBox.innerHTML = '';
    
    // Add default greeting
    const companyDisplayName = formatCompanyName(state.currentCompany);
    const initialText = `Hello! I am your ${companyDisplayName} AI assistant. How can I help you today with our services or infrastructure?`;
    
    appendMessage('bot', initialText);
}

function appendMessage(sender, text, confidence = null, matchedQuestion = null, fallback = false) {
    const chatBox = document.getElementById('chat-messages-box');
    if (!chatBox) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', sender);
    
    const contentDiv = document.createElement('div');
    contentDiv.classList.add('message-content');
    contentDiv.innerText = text;
    messageDiv.appendChild(contentDiv);
    
    const metaDiv = document.createElement('div');
    metaDiv.classList.add('message-meta');
    
    // Format timestamp
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    metaDiv.innerHTML = `<span>${timeString}</span>`;
    
    if (sender === 'bot' && confidence !== null) {
        let confidenceClass = 'low';
        if (confidence >= 0.75) confidenceClass = 'high';
        else if (confidence >= 0.6) confidenceClass = 'medium';
        
        const scorePct = Math.round(confidence * 100);
        metaDiv.innerHTML += ` &bull; <span class="confidence-badge ${confidenceClass}">Confidence: ${scorePct}%</span>`;
        
        if (matchedQuestion && !fallback) {
            metaDiv.innerHTML += ` &bull; <span class="matched-info">Matched: "${matchedQuestion}"</span>`;
        }
    }
    
    messageDiv.appendChild(metaDiv);
    chatBox.appendChild(messageDiv);
    
    // Auto Scroll to bottom
    chatBox.scrollTop = chatBox.scrollHeight;
}

function renderSuggestions() {
    const chipsContainer = document.getElementById('suggestions-chips-container');
    if (!chipsContainer) return;
    
    chipsContainer.innerHTML = '';
    
    // Get FAQs for currently active company context
    const activeCompanyFAQs = state.faqs.filter(faq => faq.company.toLowerCase() === state.currentCompany.toLowerCase());
    
    if (activeCompanyFAQs.length === 0) {
        chipsContainer.innerHTML = '<span class="suggestion-chip" style="cursor:default">Add FAQs in Admin to see suggestions.</span>';
        return;
    }
    
    // Take up to 3 random questions for suggestions
    const shuffled = [...activeCompanyFAQs].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 3);
    
    selected.forEach(faq => {
        const chip = document.createElement('span');
        chip.className = 'suggestion-chip';
        chip.innerText = faq.question;
        chip.onclick = () => {
            const input = document.getElementById('chat-input');
            if (input) {
                input.value = faq.question;
                document.getElementById('chat-form').dispatchEvent(new Event('submit'));
            }
        };
        chipsContainer.appendChild(chip);
    });
}

async function sendChatMessage(event) {
    if (event) event.preventDefault();
    
    const input = document.getElementById('chat-input');
    if (!input) return;
    
    const question = input.value.trim();
    if (!question) return;
    
    // Display user bubble
    appendMessage('user', question);
    input.value = '';
    
    // Show bot typing animation
    showTypingIndicator();
    
    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                company: state.currentCompany,
                question: question,
                threshold: state.threshold
            })
        });
        
        const data = await response.json();
        
        // Remove typing animation
        removeTypingIndicator();
        
        // Append response
        appendMessage(
            'bot', 
            data.answer, 
            data.score, 
            data.matched_question, 
            data.fallback
        );
        
        // Refresh background statistics silently if admin view is not open
        fetchStats();
    } catch (err) {
        removeTypingIndicator();
        appendMessage('bot', "Server communication error. Please try again.");
        showToast("Error processing chat: " + err.message, "error");
    }
}

function showTypingIndicator() {
    const chatBox = document.getElementById('chat-messages-box');
    if (!chatBox) return;
    
    const indicatorDiv = document.createElement('div');
    indicatorDiv.classList.add('message', 'bot', 'typing-message-temp');
    
    const contentDiv = document.createElement('div');
    contentDiv.classList.add('message-content');
    
    const typingSpan = document.createElement('div');
    typingSpan.className = 'typing-indicator';
    typingSpan.innerHTML = `
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
    `;
    
    contentDiv.appendChild(typingSpan);
    indicatorDiv.appendChild(contentDiv);
    chatBox.appendChild(indicatorDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function removeTypingIndicator() {
    const indicator = document.querySelector('.typing-message-temp');
    if (indicator) {
        indicator.remove();
    }
}

// --- Admin Subview: Stats Overview ---
function renderStats() {
    document.getElementById('stat-total-queries').innerText = state.stats.total_queries || 0;
    
    const confidencePct = Math.round((state.stats.avg_confidence || 0) * 100);
    document.getElementById('stat-avg-confidence').innerText = confidencePct + '%';
    document.getElementById('stat-avg-confidence-bar').style.width = confidencePct + '%';
    
    document.getElementById('stat-low-confidence').innerText = state.stats.low_confidence_count || 0;
    document.getElementById('stat-total-faqs').innerText = state.stats.total_faqs || 0;
    
    // Build Company bar chart
    const chartContainer = document.getElementById('bar-chart-companies');
    if (!chartContainer) return;
    
    chartContainer.innerHTML = '';
    
    const chartData = state.stats.company_queries || {};
    const entries = Object.entries(chartData);
    
    if (entries.length === 0) {
        chartContainer.innerHTML = '<div class="chart-empty">No queries logged yet. Start chatting to view analytics!</div>';
        return;
    }
    
    // Find max queries to scale relative widths
    const maxQueries = Math.max(...Object.values(chartData));
    
    entries.forEach(([company, count]) => {
        const widthPct = maxQueries > 0 ? (count / maxQueries) * 100 : 0;
        
        const row = document.createElement('div');
        row.className = 'bar-row';
        row.innerHTML = `
            <div class="bar-header">
                <span>${formatCompanyName(company)}</span>
                <span>${count} query(s)</span>
            </div>
            <div class="bar-wrapper">
                <div class="bar-fill" style="width: ${widthPct}%"></div>
            </div>
        `;
        chartContainer.appendChild(row);
    });
}

function updateThresholdDisplay(value) {
    state.threshold = parseFloat(value) / 100;
    const disp = document.getElementById('threshold-val-display');
    if (disp) {
        disp.innerText = value + '%';
    }
}

// --- Admin Subview: FAQ CRUD ---
function renderFAQTable() {
    const tableBody = document.getElementById('faqs-table-body');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    const searchVal = document.getElementById('faq-search').value.toLowerCase();
    const filterCompany = document.getElementById('faq-company-filter').value;
    
    // Filter rows based on input
    const filtered = state.faqs.filter(faq => {
        const matchesSearch = faq.question.toLowerCase().includes(searchVal) || 
                              faq.answer.toLowerCase().includes(searchVal);
        const matchesCompany = filterCompany === 'all' || faq.company.toLowerCase() === filterCompany.toLowerCase();
        
        return matchesSearch && matchesCompany;
    });
    
    if (filtered.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="4" style="text-align: center; color: var(--text-muted); padding: 40px;">
                    No FAQs matching query and filter.
                </td>
            </tr>
        `;
        return;
    }
    
    filtered.forEach(faq => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><span class="company-badge">${formatCompanyName(faq.company)}</span></td>
            <td class="truncate-text" title="${faq.question}">${faq.question}</td>
            <td class="truncate-text" title="${faq.answer}">${faq.answer}</td>
            <td>
                <div class="actions-cell">
                    <button class="btn-action edit" onclick="editFAQ('${faq.id}')" title="Edit FAQ">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="btn-action delete" onclick="deleteFAQ('${faq.id}')" title="Delete FAQ">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </td>
        `;
        tableBody.appendChild(tr);
    });
}

function filterFAQTable() {
    renderFAQTable();
}

// Modal handling
function openFAQModal() {
    document.getElementById('faq-modal').classList.add('active');
    document.getElementById('faq-modal-title').innerText = "Add New FAQ";
    document.getElementById('faq-edit-id').value = "";
    document.getElementById('faq-form').reset();
    syncCompanyInput("");
}

function closeFAQModal() {
    document.getElementById('faq-modal').classList.remove('active');
}

function syncCompanyInput(val) {
    const textInput = document.getElementById('faq-form-company');
    textInput.value = val;
    
    // If selected pre-existing company, hide textInput or make it read-only
    if (val !== "") {
        textInput.required = false;
        textInput.style.display = "none";
    } else {
        textInput.required = true;
        textInput.style.display = "block";
    }
}

async function saveFAQ(event) {
    event.preventDefault();
    
    const editId = document.getElementById('faq-edit-id').value;
    const selectCompany = document.getElementById('faq-form-company-select').value;
    const textCompany = document.getElementById('faq-form-company').value.trim();
    
    const company = selectCompany || textCompany.toLowerCase().replace(/\s+/g, '_');
    const question = document.getElementById('faq-form-question').value.trim();
    const answer = document.getElementById('faq-form-answer').value.trim();
    
    if (!company || !question || !answer) {
        showToast("All fields are required.", "error");
        return;
    }
    
    const body = { company, question, answer };
    const url = editId ? `/api/faqs/${editId}` : '/api/faqs';
    const method = editId ? 'PUT' : 'POST';
    
    try {
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });
        
        if (!response.ok) throw new Error("API call failed");
        
        showToast(`FAQ successfully ${editId ? 'updated' : 'added'}!`, "success");
        closeFAQModal();
        
        // Re-load companies in case a new one was added
        await fetchCompanies();
        
        // Refresh FAQ and stats grids
        refreshDashboardData();
    } catch (err) {
        showToast("Error saving FAQ: " + err.message, "error");
    }
}

function editFAQ(id) {
    const faq = state.faqs.find(f => f.id === id);
    if (!faq) return;
    
    openFAQModal();
    document.getElementById('faq-modal-title').innerText = "Edit FAQ";
    document.getElementById('faq-edit-id').value = id;
    
    // Select the company if it exists in list
    const select = document.getElementById('faq-form-company-select');
    const companyOptionExists = Array.from(select.options).some(opt => opt.value === faq.company);
    
    if (companyOptionExists) {
        select.value = faq.company;
        syncCompanyInput(faq.company);
    } else {
        select.value = "";
        syncCompanyInput("");
        document.getElementById('faq-form-company').value = faq.company;
    }
    
    document.getElementById('faq-form-question').value = faq.question;
    document.getElementById('faq-form-answer').value = faq.answer;
}

async function deleteFAQ(id) {
    if (!confirm("Are you sure you want to delete this FAQ? This action cannot be undone.")) return;
    
    try {
        const response = await fetch(`/api/faqs/${id}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) throw new Error("API call failed");
        
        showToast("FAQ successfully deleted!", "success");
        
        // Re-fetch companies in case this was the last FAQ for that company
        await fetchCompanies();
        
        refreshDashboardData();
    } catch (err) {
        showToast("Error deleting FAQ: " + err.message, "error");
    }
}

// --- Admin Subview: Logs ---
function renderLogsTable() {
    const tableBody = document.getElementById('logs-table-body');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    if (state.history.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 40px;">
                    No search logs logged in history.
                </td>
            </tr>
        `;
        return;
    }
    
    // Render list sorted by timestamp descending (newest first)
    const sortedHistory = [...state.history].reverse();
    
    sortedHistory.forEach(log => {
        const date = new Date(log.timestamp);
        const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        
        const scoreVal = Math.round(log.score * 100);
        let badgeClass = 'low';
        if (log.score >= 0.75) badgeClass = 'high';
        else if (log.score >= 0.6) badgeClass = 'medium';
        
        const statusBadge = log.fallback 
            ? '<span class="badge-status fallback">Fallback</span>'
            : '<span class="badge-status success">Match</span>';
            
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="white-space: nowrap;">${dateStr}</td>
            <td><span class="company-badge">${formatCompanyName(log.company)}</span></td>
            <td class="truncate-text" title="${log.question}">${log.question}</td>
            <td class="truncate-text" title="${log.matched_question || 'N/A'}">${log.matched_question || '<em>None</em>'}</td>
            <td style="text-align: center;"><span class="confidence-badge ${badgeClass}">${scoreVal}%</span></td>
            <td style="text-align: center;">${statusBadge}</td>
        `;
        tableBody.appendChild(tr);
    });
}

async function clearQueryLogs() {
    if (!confirm("Are you sure you want to clear the entire chat history logs? This is irreversible.")) return;
    
    try {
        const response = await fetch('/api/history/clear', {
            method: 'POST'
        });
        
        if (!response.ok) throw new Error("API call failed");
        
        showToast("History logs cleared successfully!", "success");
        refreshDashboardData();
    } catch (err) {
        showToast("Error clearing logs: " + err.message, "error");
    }
}

// --- Toast System ---
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'fa-info-circle';
    if (type === 'success') icon = 'fa-check-circle';
    else if (type === 'error') icon = 'fa-exclamation-circle';
    else if (type === 'warning') icon = 'fa-exclamation-triangle';
    
    toast.innerHTML = `
        <i class="fa-solid ${icon}"></i>
        <span>${message}</span>
    `;
    
    container.appendChild(toast);
    
    // Auto-remove after 4 seconds
    setTimeout(() => {
        toast.style.animation = 'toastSlide 0.3s cubic-bezier(0.16, 1, 0.3, 1) reverse';
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 4000);
}
