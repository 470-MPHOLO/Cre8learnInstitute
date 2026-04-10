// =============================================
// CONFIGURATION - REPLACE WITH YOUR SUPABASE KEYS
// =============================================
const SUPABASE_URL = 'https://YOUR-PROJECT-ID.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR-ANON-KEY';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Global state
let allClients = [];
let currentSelectedClient = null;

// =============================================
// INITIALIZATION
// =============================================
document.addEventListener('DOMContentLoaded', () => {
    loadAllData();
    loadClientDropdown();
    
    // Form handlers
    document.getElementById('newClientForm').addEventListener('submit', handleNewClient);
    document.getElementById('logServiceForm').addEventListener('submit', handleLogService);
    
    // Service selection auto-fills amount
    document.querySelectorAll('input[name="service"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            document.getElementById('serviceAmount').value = e.target.dataset.price;
        });
    });
    
    // Client selection in service modal checks discount
    document.getElementById('serviceClientSelect').addEventListener('change', checkDiscountEligibility);
});

// =============================================
// DATA LOADING
// =============================================
async function loadAllData() {
    // Load clients with their stats
    const { data: clients, error } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false });
    
    if (error) {
        console.error('Error loading clients:', error);
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
    
    // Update UI
    renderClientTable();
    updateStats();
}

async function loadClientDropdown() {
    const { data: clients } = await supabase
        .from('clients')
        .select('id, name')
        .order('name');
    
    const select = document.getElementById('serviceClientSelect');
    select.innerHTML = '<option value="">-- Choose Client --</option>' +
        (clients || []).map(c => `<option value="${c.id}">${c.name}</option>`).join('');
}

// =============================================
// FORM HANDLERS
// =============================================
async function handleNewClient(e) {
    e.preventDefault();
    
    const name = document.getElementById('clientName').value.trim();
    const phone = document.getElementById('clientPhone').value.trim();
    const email = document.getElementById('clientEmail').value.trim();
    
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
        return;
    }
    
    closeModal('newClientModal');
    document.getElementById('newClientForm').reset();
    await loadAllData();
    await loadClientDropdown();
    
    // Auto-open log service for this new client
    if (data && data[0]) {
        setTimeout(() => {
            openLogServiceModal();
            document.getElementById('serviceClientSelect').value = data[0].id;
        }, 200);
    }
}

async function handleLogService(e) {
    e.preventDefault();
    
    const clientId = document.getElementById('serviceClientSelect').value;
    const serviceRadio = document.querySelector('input[name="service"]:checked');
    
    if (!clientId) {
        alert('Please select a client');
        return;
    }
    
    if (!serviceRadio) {
        alert('Please select a service');
        return;
    }
    
    const serviceName = serviceRadio.value;
    let amount = parseFloat(document.getElementById('serviceAmount').value) || parseFloat(serviceRadio.dataset.price) || 0;
    const notes = document.getElementById('serviceNotes').value;
    
    // Check if discount applies (3rd+ visit)
    const client = allClients.find(c => c.id === clientId);
    const isDiscounted = client && client.visitCount >= 2; // 2 previous visits = this is 3rd
    
    if (isDiscounted) {
        amount = amount * 0.8; // 20% off
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
        return;
    }
    
    // Check if this was their 3rd visit (milestone)
    const newVisitCount = (client?.visitCount || 0) + 1;
    
    closeModal('logServiceModal');
    document.getElementById('logServiceForm').reset();
    document.getElementById('discountNotice').classList.add('hidden');
    
    await loadAllData();
    
    if (newVisitCount === 3) {
        const clientName = client?.name || 'Client';
        alert(`🎉 MILESTONE! ${clientName} just completed their 3rd visit and received 20% off!\n\nThey are now a VIP loyalty member.`);
    } else if (isDiscounted) {
        alert(`✅ Service logged with 20% loyalty discount applied.`);
    }
}

// =============================================
// UI RENDERING
// =============================================
function renderClientTable(filterText = '') {
    const tbody = document.getElementById('clientTableBody');
    
    const filteredClients = allClients.filter(c => 
        c.name.toLowerCase().includes(filterText.toLowerCase()) ||
        (c.phone && c.phone.includes(filterText)) ||
        (c.email && c.email.toLowerCase().includes(filterText.toLowerCase()))
    );
    
    if (filteredClients.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-gray-400">No clients found</td></tr>`;
        return;
    }
    
    tbody.innerHTML = filteredClients.map(client => `
        <tr class="border-b hover:bg-gray-50 transition">
            <td class="p-4">
                <div class="font-medium text-gray-900">${client.name}</div>
                <div class="text-sm text-gray-500">${client.phone || 'No phone'} ${client.email ? '· ' + client.email : ''}</div>
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
            <td class="p-4 text-sm text-gray-600 max-w-[200px] truncate">${client.lastService}</td>
            <td class="p-4">
                <button onclick='viewClientHistory(${JSON.stringify(client.id)})' class="text-indigo-600 hover:text-indigo-800 text-sm font-medium">
                    View History →
                </button>
            </td>
        </tr>
    `).join('');
    
    document.getElementById('totalClients').textContent = allClients.length;
}

function updateStats() {
    const totalServices = allClients.reduce((sum, c) => sum + c.visitCount, 0);
    const discountEligible = allClients.filter(c => c.discountEligible).length;
    const totalRevenue = allClients.reduce((sum, c) => sum + c.totalSpent, 0);
    
    document.getElementById('totalServices').textContent = totalServices;
    document.getElementById('discountEligible').textContent = discountEligible;
    document.getElementById('totalRevenue').textContent = `M${totalRevenue.toFixed(2)}`;
}

async function viewClientHistory(clientId) {
    const client = allClients.find(c => c.id === clientId);
    if (!client) return;
    
    document.getElementById('detailClientName').textContent = `${client.name} — Service History`;
    
    const services = client.services || [];
    
    if (services.length === 0) {
        document.getElementById('clientHistoryContent').innerHTML = `
            <p class="text-gray-500 text-center py-8">No services logged yet.</p>
        `;
    } else {
        document.getElementById('clientHistoryContent').innerHTML = `
            <div class="space-y-3">
                ${services.map((s, idx) => `
                    <div class="border rounded-lg p-4 ${s.discounted ? 'bg-green-50 border-green-200' : 'bg-gray-50'}">
                        <div class="flex justify-between items-start">
                            <div>
                                <div class="font-medium">${s.service_name}</div>
                                <div class="text-sm text-gray-500">${new Date(s.created_at).toLocaleDateString('en-GB')}</div>
                                ${s.notes ? `<div class="text-sm text-gray-400 mt-1">📝 ${s.notes}</div>` : ''}
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
    
    document.getElementById('clientDetailModal').classList.add('active');
}

// =============================================
// HELPER FUNCTIONS
// =============================================
function checkDiscountEligibility() {
    const clientId = document.getElementById('serviceClientSelect').value;
    const client = allClients.find(c => c.id === clientId);
    
    if (client && client.visitCount >= 2) {
        document.getElementById('discountNotice').classList.remove('hidden');
    } else {
        document.getElementById('discountNotice').classList.add('hidden');
    }
}

function switchServiceTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    if (tab === 'technical') {
        document.querySelectorAll('.tab-btn')[0].classList.add('active');
        document.getElementById('technicalTab').classList.add('active');
    } else {
        document.querySelectorAll('.tab-btn')[1].classList.add('active');
        document.getElementById('professionalTab').classList.add('active');
    }
}

function filterClients() {
    const searchTerm = document.getElementById('searchInput').value;
    renderClientTable(searchTerm);
}

// Modal controls
function openNewClientModal() {
    document.getElementById('newClientModal').classList.add('active');
}

function openLogServiceModal() {
    document.getElementById('logServiceModal').classList.add('active');
    loadClientDropdown();
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// Global function exports for onclick handlers
window.openNewClientModal = openNewClientModal;
window.openLogServiceModal = openLogServiceModal;
window.closeModal = closeModal;
window.switchServiceTab = switchServiceTab;
window.filterClients = filterClients;
window.viewClientHistory = viewClientHistory;

// Close modals on outside click
document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
        }
    });
});
