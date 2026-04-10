// =============================================
// CONFIGURATION - YOUR ACTUAL SUPABASE KEYS
// =============================================
const SUPABASE_URL = 'https://kqzauqxyvqgncebyulds.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtxemF1cXh5dnFnbmNlYnl1bGRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzM0NDUsImV4cCI6MjA5MTQwOTQ0NX0.SyGcJfsOYdkeo0K6szjU8OIv4Hb1g2CXzfD57Vo_PjU';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Global state
let allClients = [];

// =============================================
// INITIALIZATION - WAIT FOR DOM TO BE READY
// =============================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded - initializing app');
    
    // Load initial data
    loadAllData();
    loadClientDropdown();
    
    // Attach form handlers
    const newClientForm = document.getElementById('newClientForm');
    if (newClientForm) {
        newClientForm.addEventListener('submit', handleNewClient);
    }
    
    const logServiceForm = document.getElementById('logServiceForm');
    if (logServiceForm) {
        logServiceForm.addEventListener('submit', handleLogService);
    }
    
    // Service selection auto-fills amount
    document.querySelectorAll('input[name="service"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            document.getElementById('serviceAmount').value = e.target.dataset.price;
        });
    });
    
    // Client selection in service modal checks discount
    const clientSelect = document.getElementById('serviceClientSelect');
    if (clientSelect) {
        clientSelect.addEventListener('change', checkDiscountEligibility);
    }
    
    // Attach modal close on outside click
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    });
    
    // Escape key closes modals
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal.active').forEach(modal => {
                modal.classList.remove('active');
            });
        }
    });
    
    console.log('App initialized');
});

// =============================================
// GLOBAL FUNCTIONS (CALLED FROM HTML ONCLICK)
// =============================================
function openNewClientModal() {
    console.log('Opening new client modal');
    const modal = document.getElementById('newClientModal');
    if (modal) modal.classList.add('active');
}

function openLogServiceModal() {
    console.log('Opening log service modal');
    const modal = document.getElementById('logServiceModal');
    if (modal) modal.classList.add('active');
    loadClientDropdown();
}

function closeModal(modalId) {
    console.log('Closing modal:', modalId);
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
}

function switchServiceTab(tab) {
    console.log('Switching tab:', tab);
    
    // Remove active class from all tabs and contents
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    // Activate selected tab
    const buttons = document.querySelectorAll('.tab-btn');
    if (tab === 'technical' && buttons[0]) {
        buttons[0].classList.add('active');
        document.getElementById('technicalTab')?.classList.add('active');
    } else if (buttons[1]) {
        buttons[1].classList.add('active');
        document.getElementById('professionalTab')?.classList.add('active');
    }
}

function filterClients() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        renderClientTable(searchInput.value);
    }
}

function viewClientHistory(clientId) {
    console.log('Viewing history for client:', clientId);
    const client = allClients.find(c => c.id === clientId);
    if (!client) return;
    
    const detailName = document.getElementById('detailClientName');
    if (detailName) {
        detailName.textContent = `${escapeHtml(client.name)} — Service History`;
    }
    
    const services = client.services || [];
    const historyContent = document.getElementById('clientHistoryContent');
    
    if (!historyContent) return;
    
    if (services.length === 0) {
        historyContent.innerHTML = `<p class="text-gray-500 text-center py-8">No services logged yet.</p>`;
    } else {
        historyContent.innerHTML = `
            <div class="space-y-3">
                ${services.map((s) => `
                    <div class="border rounded-lg p-4 ${s.discounted ? 'bg-green-50 border-green-200' : 'bg-gray-50'}">
                        <div class="flex justify-between items-start">
                            <div>
                                <div class="font-medium">${escapeHtml(s.service_name)}</div>
                                <div class="text-sm text-gray-500">${new Date(s.created_at).toLocaleDateString('en-GB')}</div>
                                ${s.notes ? `<div class="text-sm text-gray-400 mt-1">📝 ${escapeHtml(s.notes)}</div>` : ''}
                            </div>
                            <div class="text-right">
                                <div class="font-bold ${s.discounted ? 'text-green-700' : 'text-gray-900'}">
                                    M${parseFloat(s.amount).toFixed(2)}
                                </div>
                                ${s.discounted ? '<span class="text-xs text-green-600">20% off applied</span>' : ''}
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
            <div class="mt-4 pt-4 border-t flex justify-between">
                <span class="font-medium">Total Spent:</span>
                <span class="font-bold text-lg">M${client.totalSpent.toFixed(2)}</span>
            </div>
        `;
    }
    
    const modal = document.getElementById('clientDetailModal');
    if (modal) modal.classList.add('active');
}

// Expose functions to global window object
window.openNewClientModal = openNewClientModal;
window.openLogServiceModal = openLogServiceModal;
window.closeModal = closeModal;
window.switchServiceTab = switchServiceTab;
window.filterClients = filterClients;
window.viewClientHistory = viewClientHistory;

// =============================================
// DATA LOADING
// =============================================
async function loadAllData() {
    console.log('Loading all data...');
    
    const { data: clients, error } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false });
    
    if (error) {
        console.error('Error loading clients:', error);
        const tbody = document.getElementById('clientTableBody');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-red-500">Error: ${error.message}</td></tr>`;
        }
        return;
    }
    
    if (!clients || clients.length === 0) {
        allClients = [];
        renderClientTable();
        updateStats();
        console.log('No clients found');
        return;
    }
    
    // For each client, get their service count and total spent
    const enrichedClients = await Promise.all(clients.map(async (client) => {
        const { data: services, error: svcError } = await supabase
            .from('services')
            .select('*')
            .eq('client_id', client.id)
            .order('created_at', { ascending: false });
        
        const visitCount = services?.length || 0;
        const totalSpent = services?.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0) || 0;
        const lastService = services?.[0]?.service_name || '—';
        const discountEligible = visitCount >= 3;
        
        return {
            ...client,
            visitCount,
            totalSpent,
            lastService,
            discountEligible,
            services: services || []
        };
    }));
    
    allClients = enrichedClients;
    renderClientTable();
    updateStats();
    console.log('Data loaded:', allClients.length, 'clients');
}

async function loadClientDropdown() {
    const { data: clients, error } = await supabase
        .from('clients')
        .select('id, name')
        .order('name');
    
    if (error) {
        console.error('Error loading client dropdown:', error);
        return;
    }
    
    const select = document.getElementById('serviceClientSelect');
    if (select) {
        select.innerHTML = '<option value="">-- Choose Client --</option>' +
            (clients || []).map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
    }
}

// =============================================
// FORM HANDLERS
// =============================================
async function handleNewClient(e) {
    e.preventDefault();
    console.log('Handling new client...');
    
    const nameInput = document.getElementById('clientName');
    const phoneInput = document.getElementById('clientPhone');
    const emailInput = document.getElementById('clientEmail');
    
    const name = nameInput?.value.trim();
    const phone = phoneInput?.value.trim();
    const email = emailInput?.value.trim();
    
    if (!name) {
        alert('Client name is required');
        return;
    }
    
    const { data, error } = await supabase
        .from('clients')
        .insert([{ 
            name, 
            phone: phone || null, 
            email: email || null 
        }])
        .select();
    
    if (error) {
        alert('Error: ' + error.message);
        console.error('Insert error:', error);
        return;
    }
    
    closeModal('newClientModal');
    if (nameInput) nameInput.value = '';
    if (phoneInput) phoneInput.value = '';
    if (emailInput) emailInput.value = '';
    
    await loadAllData();
    await loadClientDropdown();
    
    if (data && data[0]) {
        setTimeout(() => {
            openLogServiceModal();
            const select = document.getElementById('serviceClientSelect');
            if (select) select.value = data[0].id;
        }, 200);
    }
}

async function handleLogService(e) {
    e.preventDefault();
    console.log('Handling log service...');
    
    const clientSelect = document.getElementById('serviceClientSelect');
    const clientId = clientSelect?.value;
    const serviceRadio = document.querySelector('input[name="service"]:checked');
    const amountInput = document.getElementById('serviceAmount');
    const notesInput = document.getElementById('serviceNotes');
    
    if (!clientId) {
        alert('Please select a client');
        return;
    }
    
    if (!serviceRadio) {
        alert('Please select a service');
        return;
    }
    
    const serviceName = serviceRadio.value;
    let amount = parseFloat(amountInput?.value) || parseFloat(serviceRadio.dataset.price) || 0;
    const notes = notesInput?.value;
    
    const client = allClients.find(c => c.id === clientId);
    const previousVisits = client?.visitCount || 0;
    const isDiscounted = previousVisits >= 2;
    
    if (isDiscounted) {
        amount = amount * 0.8;
    }
    
    const { error } = await supabase
        .from('services')
        .insert([{
            client_id: clientId,
            service_name: serviceName,
            amount: amount,
            discounted: isDiscounted,
            notes: notes || null
        }]);
    
    if (error) {
        alert('Error logging service: ' + error.message);
        console.error('Insert error:', error);
        return;
    }
    
    const newVisitCount = previousVisits + 1;
    
    closeModal('logServiceModal');
    
    // Reset form
    if (clientSelect) clientSelect.value = '';
    document.querySelectorAll('input[name="service"]').forEach(r => r.checked = false);
    if (amountInput) amountInput.value = '';
    if (notesInput) notesInput.value = '';
    document.getElementById('discountNotice')?.classList.add('hidden');
    
    await loadAllData();
    await loadClientDropdown();
    
    if (newVisitCount === 3) {
        alert(`🎉 MILESTONE! ${client?.name || 'Client'} just completed their 3rd visit and received 20% off!\n\nThey are now a VIP loyalty member.`);
    } else if (isDiscounted) {
        alert(`✅ Service logged with 20% loyalty discount applied.`);
    } else {
        alert(`✅ Service logged successfully.`);
    }
}

// =============================================
// UI RENDERING
// =============================================
function renderClientTable(filterText = '') {
    const tbody = document.getElementById('clientTableBody');
    const totalClientsSpan = document.getElementById('totalClients');
    
    if (!tbody) return;
    
    if (!allClients || allClients.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-gray-400">
            No clients yet. Click "New Client" to get started.
        </td></tr>`;
        if (totalClientsSpan) totalClientsSpan.textContent = '0';
        return;
    }
    
    const searchTerm = filterText.toLowerCase();
    const filteredClients = allClients.filter(c => 
        c.name.toLowerCase().includes(searchTerm) ||
        (c.phone && c.phone.includes(filterText)) ||
        (c.email && c.email.toLowerCase().includes(searchTerm))
    );
    
    if (filteredClients.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-gray-400">No clients match your search</td></tr>`;
        return;
    }
    
    tbody.innerHTML = filteredClients.map(client => `
        <tr class="border-b hover:bg-gray-50 transition">
            <td class="p-4">
                <div class="font-medium text-gray-900">${escapeHtml(client.name)}</div>
                <div class="text-sm text-gray-500">${escapeHtml(client.phone || 'No phone')} ${client.email ? '· ' + escapeHtml(client.email) : ''}</div>
            </td>
            <td class="p-4">
                <span class="font-mono text-lg font-bold ${client.visitCount >= 3 ? 'text-green-600' : 'text-gray-700'}">
                    ${client.visitCount}
                </span>
            </td>
            <td class="p-4">
                ${client.discountEligible 
                    ? '<span class="bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-medium">🌟 VIP Discount</span>' 
                    : client.visitCount === 2
                        ? '<span class="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs font-medium">⭐ Next visit = 20% off</span>'
                        : `<span class="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-xs">${3 - client.visitCount} to discount</span>`
                }
            </td>
            <td class="p-4 font-medium text-purple-700">M${client.totalSpent.toFixed(2)}</td>
            <td class="p-4 text-sm text-gray-600 max-w-[200px] truncate">${escapeHtml(client.lastService)}</td>
            <td class="p-4">
                <button onclick="viewClientHistory('${client.id}')" class="text-indigo-600 hover:text-indigo-800 text-sm font-medium">
                    View History →
                </button>
            </td>
        </tr>
    `).join('');
    
    if (totalClientsSpan) totalClientsSpan.textContent = allClients.length;
}

function updateStats() {
    const totalServices = allClients.reduce((sum, c) => sum + c.visitCount, 0);
    const discountEligible = allClients.filter(c => c.discountEligible).length;
    const totalRevenue = allClients.reduce((sum, c) => sum + c.totalSpent, 0);
    
    const totalServicesEl = document.getElementById('totalServices');
    const discountEligibleEl = document.getElementById('discountEligible');
    const totalRevenueEl = document.getElementById('totalRevenue');
    
    if (totalServicesEl) totalServicesEl.textContent = totalServices;
    if (discountEligibleEl) discountEligibleEl.textContent = discountEligible;
    if (totalRevenueEl) totalRevenueEl.textContent = `M${totalRevenue.toFixed(2)}`;
}

function checkDiscountEligibility() {
    const clientSelect = document.getElementById('serviceClientSelect');
    const clientId = clientSelect?.value;
    const client = allClients.find(c => c.id === clientId);
    const discountNotice = document.getElementById('discountNotice');
    
    if (discountNotice) {
        if (client && client.visitCount >= 2) {
            discountNotice.classList.remove('hidden');
        } else {
            discountNotice.classList.add('hidden');
        }
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
