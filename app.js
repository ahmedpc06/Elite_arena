// ========== Elite Arena Football Contact Manager App ==========

// App State
let contacts = [];
let filteredContacts = [];
let currentPage = 1;
let perPage = 50;
let sortField = 'sno';
let sortDir = 'asc';
let editingIndex = -1;

// ========== Initialize ==========
document.addEventListener('DOMContentLoaded', () => {
    loadContacts();
    setupEventListeners();
    renderTable();
    updateStats();
});

// ========== Load Contacts ==========
function loadContacts() {
    // Check local storage first
    const saved = localStorage.getItem('hof_contacts_v2');
    if (saved) {
        contacts = JSON.parse(saved);
    } else {
        // Initialize from RAW_CONTACTS
        contacts = RAW_CONTACTS.map((c, i) => ({
            id: i + 1,
            name: c.name || '',
            phone: c.phone,
            role: c.role || 'member',
            status: 'not_called',
            payment: 'unpaid',
            amount: 0,
            bringingFriends: 'no',
            friendCount: 0,
            position: '',
            availability: '',
            lastPlayed: '',
            totalGames: 0,
            rating: 0,
            notes: '',
            createdAt: new Date().toISOString()
        }));
        saveContacts();
    }
    filteredContacts = [...contacts];
}

// ========== Save Contacts ==========
function saveContacts() {
    localStorage.setItem('hof_contacts_v2', JSON.stringify(contacts));
}

// ========== Setup Event Listeners ==========
function setupEventListeners() {
    // Search
    document.getElementById('searchInput').addEventListener('input', debounce(() => {
        currentPage = 1;
        applyFilters();
    }, 300));

    // Filters
    ['statusFilter', 'paymentFilter', 'roleFilter'].forEach(id => {
        document.getElementById(id).addEventListener('change', () => {
            currentPage = 1;
            applyFilters();
        });
    });

    // Per page
    document.getElementById('perPage').addEventListener('change', (e) => {
        perPage = e.target.value === 'all' ? filteredContacts.length : parseInt(e.target.value);
        currentPage = 1;
        renderTable();
    });

    // Pagination
    document.getElementById('prevPage').addEventListener('click', () => {
        if (currentPage > 1) { currentPage--; renderTable(); }
    });
    document.getElementById('nextPage').addEventListener('click', () => {
        const totalPages = Math.ceil(filteredContacts.length / perPage);
        if (currentPage < totalPages) { currentPage++; renderTable(); }
    });

    // Select all
    document.getElementById('selectAll').addEventListener('change', (e) => {
        document.querySelectorAll('.row-checkbox').forEach(cb => cb.checked = e.target.checked);
    });

    // Sort
    document.querySelectorAll('.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const field = th.dataset.sort;
            if (sortField === field) {
                sortDir = sortDir === 'asc' ? 'desc' : 'asc';
            } else {
                sortField = field;
                sortDir = 'asc';
            }
            document.querySelectorAll('.sortable').forEach(t => t.classList.remove('asc', 'desc', 'active'));
            th.classList.add(sortDir, 'active');
            applyFilters();
        });
    });

    // Add contact button
    document.getElementById('addContactBtn').addEventListener('click', () => openModal());

    // Delete selected button
    document.getElementById('deleteSelectedBtn').addEventListener('click', deleteSelected);

    // Export buttons
    document.getElementById('exportBtn').addEventListener('click', exportToExcel);
    document.getElementById('exportCSVBtn').addEventListener('click', exportToCSV);

    // Save button
    document.getElementById('saveBtn').addEventListener('click', () => {
        saveContacts();
        showToast('✅ All changes saved successfully!');
    });

    // Modal
    document.getElementById('modalClose').addEventListener('click', closeModal);
    document.getElementById('modalCancel').addEventListener('click', closeModal);
    document.getElementById('modalSave').addEventListener('click', saveModal);
    document.getElementById('modalOverlay').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeModal();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
        if (e.ctrlKey && e.key === 's') { e.preventDefault(); saveContacts(); showToast('✅ Saved!'); }
        if (e.ctrlKey && e.key === 'f') { e.preventDefault(); document.getElementById('searchInput').focus(); }
    });
}

// ========== Apply Filters ==========
function applyFilters() {
    const search = document.getElementById('searchInput').value.toLowerCase().trim();
    const statusFilter = document.getElementById('statusFilter').value;
    const paymentFilter = document.getElementById('paymentFilter').value;
    const roleFilter = document.getElementById('roleFilter').value;

    filteredContacts = contacts.filter(c => {
        // Search filter
        if (search) {
            const searchStr = `${c.name} ${c.phone} ${c.notes}`.toLowerCase();
            if (!searchStr.includes(search)) return false;
        }
        // Status filter
        if (statusFilter !== 'all' && c.status !== statusFilter) return false;
        // Payment filter
        if (paymentFilter !== 'all' && c.payment !== paymentFilter) return false;
        // Role filter
        if (roleFilter !== 'all' && c.role !== roleFilter) return false;
        return true;
    });

    // Sort
    filteredContacts.sort((a, b) => {
        let valA, valB;
        switch (sortField) {
            case 'name':
                valA = (a.name || a.phone).toLowerCase();
                valB = (b.name || b.phone).toLowerCase();
                break;
            case 'status':
                valA = a.status;
                valB = b.status;
                break;
            case 'payment':
                valA = a.payment;
                valB = b.payment;
                break;
            case 'rating':
                valA = a.rating;
                valB = b.rating;
                break;
            case 'lastplayed':
                valA = a.lastPlayed || '';
                valB = b.lastPlayed || '';
                break;
            default:
                valA = a.id;
                valB = b.id;
        }
        if (valA < valB) return sortDir === 'asc' ? -1 : 1;
        if (valA > valB) return sortDir === 'asc' ? 1 : -1;
        return 0;
    });

    renderTable();
    updateStats();
}

// ========== Render Table ==========
function renderTable() {
    const tbody = document.getElementById('contactTableBody');
    const total = filteredContacts.length;
    const effectivePerPage = perPage || total;
    const totalPages = Math.ceil(total / effectivePerPage) || 1;
    
    if (currentPage > totalPages) currentPage = totalPages;
    
    const start = (currentPage - 1) * effectivePerPage;
    const end = Math.min(start + effectivePerPage, total);
    const pageData = filteredContacts.slice(start, end);

    tbody.innerHTML = pageData.map((contact, idx) => {
        const globalIdx = contacts.indexOf(contact);
        const displayName = contact.name || contact.phone;
        const isNumber = !contact.name;
        const cleanPhone = contact.phone.replace(/[\s\-()]/g, '');
        const waLink = `https://wa.me/${cleanPhone.replace('+', '')}`;
        const telLink = `tel:${cleanPhone}`;
        const stars = '★'.repeat(contact.rating || 0) + '☆'.repeat(5 - (contact.rating || 0));
        
        const rowClass = contact.status === 'confirmed' ? 'row-confirmed' : 
                        contact.status === 'declined' ? 'row-declined' : '';
        
        return `<tr class="${rowClass}" data-idx="${globalIdx}">
            <td><input type="checkbox" class="row-checkbox" data-idx="${globalIdx}"></td>
            <td>${start + idx + 1}</td>
            <td>
                <span class="contact-name ${isNumber ? 'is-number' : ''}">${escapeHtml(displayName)}</span>
            </td>
            <td><a href="${telLink}" class="phone-link">${escapeHtml(contact.phone)}</a></td>
            <td><a href="${waLink}" target="_blank" class="wa-btn">💬 Chat</a></td>
            <td><span class="role-badge role-${contact.role}">${contact.role}</span></td>
            <td>
                <select class="inline-select status-select" data-idx="${globalIdx}" data-field="status">
                    <option value="not_called" ${contact.status === 'not_called' ? 'selected' : ''}>⬜ Not Called</option>
                    <option value="called" ${contact.status === 'called' ? 'selected' : ''}>📞 Called</option>
                    <option value="confirmed" ${contact.status === 'confirmed' ? 'selected' : ''}>✅ Confirmed</option>
                    <option value="declined" ${contact.status === 'declined' ? 'selected' : ''}>❌ Declined</option>
                    <option value="no_answer" ${contact.status === 'no_answer' ? 'selected' : ''}>📵 No Answer</option>
                </select>
            </td>
            <td>
                <select class="inline-select payment-select" data-idx="${globalIdx}" data-field="payment">
                    <option value="unpaid" ${contact.payment === 'unpaid' ? 'selected' : ''}>❌ Unpaid</option>
                    <option value="paid" ${contact.payment === 'paid' ? 'selected' : ''}>✅ Paid</option>
                    <option value="partial" ${contact.payment === 'partial' ? 'selected' : ''}>🔶 Partial</option>
                </select>
            </td>
            <td>
                <input type="number" class="inline-edit" style="width:80px" value="${contact.amount || ''}" 
                    data-idx="${globalIdx}" data-field="amount" placeholder="₹">
            </td>
            <td>
                <select class="inline-select" data-idx="${globalIdx}" data-field="bringingFriends">
                    <option value="no" ${contact.bringingFriends === 'no' ? 'selected' : ''}>No</option>
                    <option value="yes" ${contact.bringingFriends === 'yes' ? 'selected' : ''}>Yes ✅</option>
                </select>
            </td>
            <td>
                <input type="number" class="inline-edit" style="width:60px" value="${contact.friendCount || ''}" 
                    data-idx="${globalIdx}" data-field="friendCount" placeholder="0">
            </td>
            <td>
                <select class="inline-select" data-idx="${globalIdx}" data-field="position">
                    <option value="" ${!contact.position ? 'selected' : ''}>-</option>
                    <option value="GK" ${contact.position === 'GK' ? 'selected' : ''}>GK</option>
                    <option value="DEF" ${contact.position === 'DEF' ? 'selected' : ''}>DEF</option>
                    <option value="MID" ${contact.position === 'MID' ? 'selected' : ''}>MID</option>
                    <option value="FWD" ${contact.position === 'FWD' ? 'selected' : ''}>FWD</option>
                    <option value="ANY" ${contact.position === 'ANY' ? 'selected' : ''}>ANY</option>
                </select>
            </td>
            <td>
                <select class="inline-select" data-idx="${globalIdx}" data-field="availability">
                    <option value="" ${!contact.availability ? 'selected' : ''}>-</option>
                    <option value="weekdays" ${contact.availability === 'weekdays' ? 'selected' : ''}>Weekdays</option>
                    <option value="weekends" ${contact.availability === 'weekends' ? 'selected' : ''}>Weekends</option>
                    <option value="both" ${contact.availability === 'both' ? 'selected' : ''}>Both</option>
                    <option value="evenings" ${contact.availability === 'evenings' ? 'selected' : ''}>Evenings</option>
                    <option value="mornings" ${contact.availability === 'mornings' ? 'selected' : ''}>Mornings</option>
                </select>
            </td>
            <td>
                <input type="date" class="inline-edit" style="width:130px" value="${contact.lastPlayed || ''}" 
                    data-idx="${globalIdx}" data-field="lastPlayed">
            </td>
            <td>
                <input type="number" class="inline-edit" style="width:60px" value="${contact.totalGames || ''}" 
                    data-idx="${globalIdx}" data-field="totalGames" placeholder="0">
            </td>
            <td><span class="star-rating" data-idx="${globalIdx}">${stars}</span></td>
            <td>
                <input type="text" class="inline-edit" style="width:140px" value="${escapeHtml(contact.notes || '')}" 
                    data-idx="${globalIdx}" data-field="notes" placeholder="Add notes...">
            </td>
            <td>
                <div class="action-btns">
                    <button class="action-btn edit" onclick="openModal(${globalIdx})" title="Edit">✏️</button>
                    <a href="${telLink}" class="action-btn call" title="Call">📞</a>
                    <button class="action-btn delete" onclick="deleteContact(${globalIdx})" title="Delete">🗑️</button>
                </div>
            </td>
        </tr>`;
    }).join('');

    // Attach inline edit listeners
    tbody.querySelectorAll('.inline-edit').forEach(input => {
        input.addEventListener('change', (e) => {
            const idx = parseInt(e.target.dataset.idx);
            const field = e.target.dataset.field;
            let value = e.target.value;
            if (['amount', 'friendCount', 'totalGames'].includes(field)) {
                value = parseInt(value) || 0;
            }
            contacts[idx][field] = value;
            saveContacts();
        });
    });

    tbody.querySelectorAll('.inline-select').forEach(select => {
        select.addEventListener('change', (e) => {
            const idx = parseInt(e.target.dataset.idx);
            const field = e.target.dataset.field;
            contacts[idx][field] = e.target.value;
            saveContacts();
            updateStats();
            // Re-render if status changed (for row highlighting)
            if (field === 'status') renderTable();
        });
    });

    // Star rating click handler
    tbody.querySelectorAll('.star-rating').forEach(el => {
        el.addEventListener('click', (e) => {
            const idx = parseInt(el.dataset.idx);
            const rect = el.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const rating = Math.ceil((x / rect.width) * 5);
            contacts[idx].rating = Math.min(5, Math.max(1, rating));
            saveContacts();
            renderTable();
        });
        el.style.cursor = 'pointer';
    });

    // Update pagination
    updatePagination(total, totalPages);
}

// ========== Update Pagination ==========
function updatePagination(total, totalPages) {
    const start = Math.min((currentPage - 1) * perPage + 1, total);
    const end = Math.min(currentPage * perPage, total);
    
    document.getElementById('showingStart').textContent = total > 0 ? start : 0;
    document.getElementById('showingEnd').textContent = end;
    document.getElementById('showingTotal').textContent = total;
    
    document.getElementById('prevPage').disabled = currentPage <= 1;
    document.getElementById('nextPage').disabled = currentPage >= totalPages;
    
    // Page numbers
    const pageNumbersEl = document.getElementById('pageNumbers');
    let pages = [];
    for (let i = 1; i <= totalPages; i++) {
        if (i <= 3 || i > totalPages - 2 || Math.abs(i - currentPage) <= 1) {
            pages.push(i);
        } else if (pages[pages.length - 1] !== '...') {
            pages.push('...');
        }
    }
    
    pageNumbersEl.innerHTML = pages.map(p => {
        if (p === '...') return '<span class="page-num" style="cursor:default;border:none;">...</span>';
        return `<button class="page-num ${p === currentPage ? 'active' : ''}" onclick="goToPage(${p})">${p}</button>`;
    }).join('');
}

function goToPage(page) {
    currentPage = page;
    renderTable();
    window.scrollTo({ top: 200, behavior: 'smooth' });
}

// ========== Update Stats ==========
function updateStats() {
    document.getElementById('totalContacts').textContent = contacts.length;
    document.getElementById('calledCount').textContent = contacts.filter(c => c.status !== 'not_called').length;
    document.getElementById('confirmedCount').textContent = contacts.filter(c => c.status === 'confirmed').length;
    document.getElementById('paidCount').textContent = contacts.filter(c => c.payment === 'paid').length;

    // Animate numbers
    document.querySelectorAll('.stat-number').forEach(el => {
        el.style.transform = 'scale(1.1)';
        setTimeout(() => el.style.transform = 'scale(1)', 200);
    });
}

// ========== Modal ==========
function openModal(idx = -1) {
    editingIndex = idx;
    const modal = document.getElementById('modalOverlay');
    modal.classList.add('active');
    
    if (idx >= 0) {
        const c = contacts[idx];
        document.getElementById('modalTitle').textContent = 'Edit Player';
        document.getElementById('editName').value = c.name || '';
        document.getElementById('editPhone').value = c.phone || '';
        document.getElementById('editStatus').value = c.status || 'not_called';
        document.getElementById('editPayment').value = c.payment || 'unpaid';
        document.getElementById('editAmount').value = c.amount || '';
        document.getElementById('editFriends').value = c.bringingFriends || 'no';
        document.getElementById('editFriendCount').value = c.friendCount || '';
        document.getElementById('editPosition').value = c.position || '';
        document.getElementById('editAvailability').value = c.availability || '';
        document.getElementById('editRating').value = c.rating || '';
        document.getElementById('editNotes').value = c.notes || '';
    } else {
        document.getElementById('modalTitle').textContent = 'Add New Player';
        document.querySelectorAll('.modal input, .modal textarea').forEach(el => el.value = '');
        document.querySelectorAll('.modal select').forEach(el => el.selectedIndex = 0);
    }
}

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('active');
    editingIndex = -1;
}

function saveModal() {
    const data = {
        name: document.getElementById('editName').value.trim(),
        phone: document.getElementById('editPhone').value.trim(),
        status: document.getElementById('editStatus').value,
        payment: document.getElementById('editPayment').value,
        amount: parseInt(document.getElementById('editAmount').value) || 0,
        bringingFriends: document.getElementById('editFriends').value,
        friendCount: parseInt(document.getElementById('editFriendCount').value) || 0,
        position: document.getElementById('editPosition').value,
        availability: document.getElementById('editAvailability').value,
        rating: parseInt(document.getElementById('editRating').value) || 0,
        notes: document.getElementById('editNotes').value.trim()
    };

    if (!data.phone) {
        showToast('⚠️ Phone number is required!');
        return;
    }

    if (editingIndex >= 0) {
        Object.assign(contacts[editingIndex], data);
        showToast('✅ Player updated successfully!');
    } else {
        contacts.push({
            id: contacts.length + 1,
            ...data,
            role: 'member',
            lastPlayed: '',
            totalGames: 0,
            createdAt: new Date().toISOString()
        });
        showToast('✅ New player added successfully!');
    }

    saveContacts();
    closeModal();
    applyFilters();
}

// ========== Delete Contact ==========
function deleteContact(idx) {
    if (confirm(`Delete ${contacts[idx].name || contacts[idx].phone}?`)) {
        contacts.splice(idx, 1);
        // Re-assign IDs
        contacts.forEach((c, i) => c.id = i + 1);
        saveContacts();
        applyFilters();
        showToast('🗑️ Player deleted.');
    }
}

// ========== Delete Selected Contacts ==========
function deleteSelected() {
    const selectedCheckboxes = document.querySelectorAll('.row-checkbox:checked');
    if (selectedCheckboxes.length === 0) {
        showToast('⚠️ No players selected! Use the checkboxes to select players first.');
        return;
    }
    
    const count = selectedCheckboxes.length;
    if (!confirm(`Are you sure you want to delete ${count} selected player(s)? This cannot be undone.`)) {
        return;
    }
    
    // Get indices to delete (sort descending so splice doesn't mess up indices)
    const indicesToDelete = Array.from(selectedCheckboxes)
        .map(cb => parseInt(cb.dataset.idx))
        .sort((a, b) => b - a);
    
    indicesToDelete.forEach(idx => {
        contacts.splice(idx, 1);
    });
    
    // Re-assign IDs
    contacts.forEach((c, i) => c.id = i + 1);
    
    // Uncheck select all
    document.getElementById('selectAll').checked = false;
    
    saveContacts();
    applyFilters();
    showToast(`🗑️ ${count} player(s) deleted successfully!`);
}

// ========== Export to Excel (XLSX via HTML table) ==========
function exportToExcel() {
    const dataToExport = filteredContacts.length > 0 ? filteredContacts : contacts;
    
    let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
    <head><meta charset="utf-8">
    <style>
        table { border-collapse: collapse; }
        th { background: #1a5c2a; color: white; font-weight: bold; padding: 8px 12px; border: 1px solid #333; }
        td { padding: 6px 10px; border: 1px solid #ccc; }
        tr:nth-child(even) { background: #f0f8f0; }
    </style>
    </head><body>
    <table>
    <tr>
        <th>#</th>
        <th>Name</th>
        <th>Phone Number</th>
        <th>WhatsApp Link</th>
        <th>Role</th>
        <th>Call Status</th>
        <th>Payment Status</th>
        <th>Amount (₹)</th>
        <th>Bringing Friends</th>
        <th>Friend Count</th>
        <th>Position</th>
        <th>Availability</th>
        <th>Last Played</th>
        <th>Total Games</th>
        <th>Rating</th>
        <th>Notes</th>
    </tr>`;

    dataToExport.forEach((c, i) => {
        const cleanPhone = c.phone.replace(/[\s\-()]/g, '');
        const waLink = `https://wa.me/${cleanPhone.replace('+', '')}`;
        const statusText = { not_called: 'Not Called', called: 'Called', confirmed: 'Confirmed', declined: 'Declined', no_answer: 'No Answer' };
        const paymentText = { unpaid: 'Unpaid', paid: 'Paid', partial: 'Partial' };
        
        html += `<tr>
            <td>${i + 1}</td>
            <td>${escapeHtml(c.name || c.phone)}</td>
            <td>${escapeHtml(c.phone)}</td>
            <td>${waLink}</td>
            <td>${c.role}</td>
            <td>${statusText[c.status] || c.status}</td>
            <td>${paymentText[c.payment] || c.payment}</td>
            <td>${c.amount || 0}</td>
            <td>${c.bringingFriends === 'yes' ? 'Yes' : 'No'}</td>
            <td>${c.friendCount || 0}</td>
            <td>${c.position || '-'}</td>
            <td>${c.availability || '-'}</td>
            <td>${c.lastPlayed || '-'}</td>
            <td>${c.totalGames || 0}</td>
            <td>${c.rating || 0}/5</td>
            <td>${escapeHtml(c.notes || '')}</td>
        </tr>`;
    });

    html += '</table></body></html>';

    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Elite_Arena_Contacts_${new Date().toISOString().split('T')[0]}.xls`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('📊 Excel file downloaded successfully!');
}

// ========== Export to CSV ==========
function exportToCSV() {
    const dataToExport = filteredContacts.length > 0 ? filteredContacts : contacts;
    const statusText = { not_called: 'Not Called', called: 'Called', confirmed: 'Confirmed', declined: 'Declined', no_answer: 'No Answer' };
    const paymentText = { unpaid: 'Unpaid', paid: 'Paid', partial: 'Partial' };
    
    let csv = 'S.No,Name,Phone Number,WhatsApp Link,Role,Call Status,Payment Status,Amount,Bringing Friends,Friend Count,Position,Availability,Last Played,Total Games,Rating,Notes\n';
    
    dataToExport.forEach((c, i) => {
        const cleanPhone = c.phone.replace(/[\s\-()]/g, '');
        const waLink = `https://wa.me/${cleanPhone.replace('+', '')}`;
        csv += [
            i + 1,
            `"${(c.name || c.phone).replace(/"/g, '""')}"`,
            `"${c.phone}"`,
            waLink,
            c.role,
            statusText[c.status] || c.status,
            paymentText[c.payment] || c.payment,
            c.amount || 0,
            c.bringingFriends === 'yes' ? 'Yes' : 'No',
            c.friendCount || 0,
            c.position || '-',
            c.availability || '-',
            c.lastPlayed || '-',
            c.totalGames || 0,
            `${c.rating || 0}/5`,
            `"${(c.notes || '').replace(/"/g, '""')}"`
        ].join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Elite_Arena_Contacts_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('📋 CSV file downloaded successfully!');
}

// ========== Utility Functions ==========
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function debounce(fn, ms) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), ms);
    };
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    document.getElementById('toastMessage').textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}
