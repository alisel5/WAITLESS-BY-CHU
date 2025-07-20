// STAFF MANAGEMENT JAVASCRIPT

// Global variables
let currentStaff = null;
let staffList = [];
let servicesList = [];
let selectedStaffId = null;

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    initializeStaffPage();
});

async function initializeStaffPage() {
    try {
        // Check authentication using shared API client
        if (!apiClient.isAuthenticated()) {
            window.location.href = '../signup/signup.html';
            return;
        }

        // Check if user is admin
        if (!apiClient.isAdmin()) {
            showMessage('Accès non autorisé. Seuls les administrateurs peuvent accéder à cette page.', 'error');
            window.location.href = '../Acceuil/acceuil.html';
            return;
        }

        // Load initial data
        await Promise.all([
            loadStaffList(),
            loadServices(),
            loadStaffStats()
        ]);

        // Set up event listeners
        setupEventListeners();

        // Update admin name
        updateAdminInfo();

    } catch (error) {
        console.error('Error initializing staff page:', error);
        showMessage('Erreur lors du chargement de la page', 'error');
    }
}

function setupEventListeners() {
    // Search functionality
    const staffSearch = document.getElementById('staffSearch');
    if (staffSearch) {
        staffSearch.addEventListener('input', filterStaffList);
    }

    // Filter functionality
    const roleFilter = document.getElementById('roleFilter');
    const statusFilter = document.getElementById('statusFilter');
    
    if (roleFilter) {
        roleFilter.addEventListener('change', filterStaffList);
    }
    if (statusFilter) {
        statusFilter.addEventListener('change', filterStaffList);
    }

    // Form submissions
    const addStaffForm = document.getElementById('addStaffForm');
    if (addStaffForm) {
        addStaffForm.addEventListener('submit', handleAddStaff);
    }

    const editStaffForm = document.getElementById('editStaffForm');
    if (editStaffForm) {
        editStaffForm.addEventListener('submit', handleEditStaff);
    }

    const assignServiceForm = document.getElementById('assignServiceForm');
    if (assignServiceForm) {
        assignServiceForm.addEventListener('submit', handleAssignService);
    }
}

// Load staff list from API - Updated to use shared API client
async function loadStaffList() {
    try {
        showLoading('staffList');
        
        const response = await apiClient.makeRequest('/api/admin/staff');
        
        if (response) {
            staffList = response;
            renderStaffList(staffList);
        } else {
            throw new Error('No staff data received');
        }
    } catch (error) {
        console.error('Error loading staff list:', error);
        showMessage('Erreur lors du chargement du personnel', 'error');
        renderStaffList([]);
    } finally {
        hideLoading('staffList');
    }
}

// Load services for assignment - Updated to use shared API client
async function loadServices() {
    try {
        const response = await apiClient.getServices();
        
        if (response) {
            servicesList = response;
            populateServiceSelects();
        }
    } catch (error) {
        console.error('Error loading services:', error);
    }
}

// Load staff statistics - Updated to use shared API client
async function loadStaffStats() {
    try {
        const response = await apiClient.makeRequest('/api/admin/staff/stats');
        
        if (response) {
            updateStaffStats(response);
        }
    } catch (error) {
        console.error('Error loading staff stats:', error);
    }
}

// Render staff list
function renderStaffList(staff) {
    const staffListContainer = document.getElementById('staffList');
    if (!staffListContainer) return;

    if (staff.length === 0) {
        staffListContainer.innerHTML = `
            <div class="no-staff">
                <i class="fas fa-users"></i>
                <h3>Aucun personnel trouvé</h3>
                <p>Commencez par ajouter un nouveau membre du personnel</p>
            </div>
        `;
        return;
    }

    staffListContainer.innerHTML = staff.map(staffMember => `
        <div class="staff-item ${selectedStaffId === staffMember.id ? 'selected' : ''}" 
             onclick="selectStaff(${staffMember.id})">
            <div class="staff-header-info">
                <div class="staff-name">${staffMember.full_name}</div>
                <div class="staff-role">${getRoleDisplayName(staffMember.role)}</div>
            </div>
            <div class="staff-details-info">
                <div class="staff-detail">
                    <i class="fas fa-envelope"></i>
                    <span>${staffMember.email}</span>
                </div>
                <div class="staff-detail">
                    <i class="fas fa-phone"></i>
                    <span>${staffMember.phone || 'Non renseigné'}</span>
                </div>
                <div class="staff-detail">
                    <i class="fas fa-hospital"></i>
                    <span>${staffMember.assigned_service ? staffMember.assigned_service.name : 'Aucun service'}</span>
                </div>
                <div class="staff-detail">
                    <i class="fas fa-circle ${staffMember.is_active ? 'status-active' : 'status-inactive'}"></i>
                    <span>${staffMember.is_active ? 'Actif' : 'Inactif'}</span>
                </div>
            </div>
        </div>
    `).join('');
}

// Select staff member
function selectStaff(staffId) {
    selectedStaffId = staffId;
    currentStaff = staffList.find(staff => staff.id === staffId);
    
    // Update UI
    renderStaffList(staffList);
    renderStaffDetails(currentStaff);
    showDetailActions();
}

// Render staff details
function renderStaffDetails(staff) {
    const staffDetails = document.getElementById('staffDetails');
    const serviceAssignment = document.getElementById('serviceAssignment');
    const activityLog = document.getElementById('activityLog');
    
    if (!staff) {
        staffDetails.innerHTML = `
            <div class="no-selection">
                <i class="fas fa-user"></i>
                <h3>Sélectionnez un membre du personnel</h3>
                <p>Cliquez sur un membre du personnel pour voir ses détails</p>
            </div>
        `;
        serviceAssignment.style.display = 'none';
        activityLog.style.display = 'none';
        return;
    }

    // Main details
    staffDetails.innerHTML = `
        <div class="staff-detail-card">
            <div class="staff-detail-header">
                <div class="staff-avatar">
                    ${getInitials(staff.full_name)}
                </div>
                <div class="staff-info">
                    <h3>${staff.full_name}</h3>
                    <div class="staff-role-badge">${getRoleDisplayName(staff.role)}</div>
                </div>
            </div>
            <div class="staff-detail-grid">
                <div class="detail-item">
                    <i class="fas fa-envelope"></i>
                    <span>${staff.email}</span>
                </div>
                <div class="detail-item">
                    <i class="fas fa-phone"></i>
                    <span>${staff.phone || 'Non renseigné'}</span>
                </div>
                <div class="detail-item">
                    <i class="fas fa-calendar-alt"></i>
                    <span>Créé le ${formatDate(staff.created_at)}</span>
                </div>
                <div class="detail-item">
                    <i class="fas fa-circle ${staff.is_active ? 'status-active' : 'status-inactive'}"></i>
                    <span>${staff.is_active ? 'Actif' : 'Inactif'}</span>
                </div>
            </div>
        </div>
    `;

    // Show service assignment section
    serviceAssignment.style.display = 'block';
    renderAssignedServices(staff);

    // Show activity log
    activityLog.style.display = 'block';
    loadStaffActivity(staff.id);
}

// Render assigned services
function renderAssignedServices(staff) {
    const assignedServices = document.getElementById('assignedServices');
    
    if (staff.assigned_service) {
        assignedServices.innerHTML = `
            <div class="service-tag">
                <i class="fas fa-hospital"></i>
                ${staff.assigned_service.name}
                <button class="remove-service" onclick="removeServiceAssignment(${staff.id})">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
    } else {
        assignedServices.innerHTML = `
            <p>Aucun service assigné</p>
        `;
    }
}

// Load staff activity - Updated to use shared API client
async function loadStaffActivity(staffId) {
    try {
        const response = await apiClient.makeRequest(`/api/admin/staff/${staffId}/activity`);
        
        if (response) {
            renderActivityLog(response);
        }
    } catch (error) {
        console.error('Error loading staff activity:', error);
        renderActivityLog([]);
    }
}

// Render activity log
function renderActivityLog(activities) {
    const activityList = document.getElementById('activityList');
    
    if (activities.length === 0) {
        activityList.innerHTML = `
            <p>Aucune activité récente</p>
        `;
        return;
    }

    activityList.innerHTML = activities.map(activity => `
        <div class="activity-item">
            <div class="activity-icon ${getActivityIconClass(activity.type)}">
                <i class="${getActivityIcon(activity.type)}"></i>
            </div>
            <div class="activity-content">
                <div class="activity-title">${activity.title}</div>
                <div class="activity-time">${formatDate(activity.timestamp)}</div>
            </div>
        </div>
    `).join('');
}

// Filter staff list
function filterStaffList() {
    const searchTerm = document.getElementById('staffSearch').value.toLowerCase();
    const roleFilter = document.getElementById('roleFilter').value;
    const statusFilter = document.getElementById('statusFilter').value;

    const filteredStaff = staffList.filter(staff => {
        const matchesSearch = staff.full_name.toLowerCase().includes(searchTerm) ||
                            staff.email.toLowerCase().includes(searchTerm);
        const matchesRole = !roleFilter || staff.role === roleFilter;
        const matchesStatus = !statusFilter || 
                            (statusFilter === 'active' && staff.is_active) ||
                            (statusFilter === 'inactive' && !staff.is_active);

        return matchesSearch && matchesRole && matchesStatus;
    });

    renderStaffList(filteredStaff);
}

// Show add staff modal
function showAddStaffModal() {
    const modal = document.getElementById('addStaffModal');
    modal.style.display = 'flex';
    populateServiceSelects();
}

// Show edit staff modal
function showEditStaffModal() {
    if (!currentStaff) return;
    
    const modal = document.getElementById('editStaffModal');
    const form = document.getElementById('editStaffForm');
    
    // Populate form
    document.getElementById('editStaffId').value = currentStaff.id;
    document.getElementById('editStaffFirstName').value = getFirstName(currentStaff.full_name);
    document.getElementById('editStaffLastName').value = getLastName(currentStaff.full_name);
    document.getElementById('editStaffEmail').value = currentStaff.email;
    document.getElementById('editStaffPhone').value = currentStaff.phone || '';
    document.getElementById('editStaffRole').value = currentStaff.role;
    document.getElementById('editStaffService').value = currentStaff.assigned_service_id || '';
    
    // Clear passwords
    document.getElementById('editStaffPassword').value = '';
    document.getElementById('editStaffConfirmPassword').value = '';
    
    populateServiceSelects('editStaffService');
    modal.style.display = 'flex';
}

// Show assign service modal
function showAssignServiceModal() {
    if (!currentStaff) return;
    
    const modal = document.getElementById('assignServiceModal');
    document.getElementById('assignStaffId').value = currentStaff.id;
    populateServiceSelects('assignServiceSelect');
    modal.style.display = 'flex';
}

// Handle add staff - Updated to use shared API client
async function handleAddStaff(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    const password = formData.get('staffPassword');
    const confirmPassword = formData.get('staffConfirmPassword');
    
    if (password !== confirmPassword) {
        showMessage('Les mots de passe ne correspondent pas', 'error');
        return;
    }
    
    try {
        const staffData = {
            first_name: formData.get('staffFirstName'),
            last_name: formData.get('staffLastName'),
            email: formData.get('staffEmail'),
            phone: formData.get('staffPhone') || null,
            role: formData.get('staffRole'),
            service_id: parseInt(formData.get('staffService')) || null,
            password: password
        };
        
        const response = await apiClient.makeRequest('/api/admin/staff', {
            method: 'POST',
            body: JSON.stringify(staffData)
        });
        
        if (response) {
            showMessage('Personnel ajouté avec succès', 'success');
            closeModal('addStaffModal');
            form.reset();
            await loadStaffList();
            await loadStaffStats();
        }
    } catch (error) {
        console.error('Error adding staff:', error);
        showMessage(error.message || 'Erreur lors de l\'ajout du personnel', 'error');
    }
}

// Handle edit staff - Updated to use shared API client  
async function handleEditStaff(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    const password = formData.get('editStaffPassword');
    const confirmPassword = formData.get('editStaffConfirmPassword');
    
    if (password && password !== confirmPassword) {
        showMessage('Les mots de passe ne correspondent pas', 'error');
        return;
    }
    
    try {
        const staffData = {
            first_name: formData.get('editStaffFirstName'),
            last_name: formData.get('editStaffLastName'),
            email: formData.get('editStaffEmail'),
            phone: formData.get('editStaffPhone') || null,
            role: formData.get('editStaffRole'),
            service_id: parseInt(formData.get('editStaffService')) || null
        };
        
        if (password) {
            staffData.password = password;
        }
        
        const staffId = formData.get('editStaffId');
        const response = await apiClient.makeRequest(`/api/admin/staff/${staffId}`, {
            method: 'PUT',
            body: JSON.stringify(staffData)
        });
        
        if (response) {
            showMessage('Personnel modifié avec succès', 'success');
            closeModal('editStaffModal');
            await loadStaffList();
            if (currentStaff && currentStaff.id === parseInt(staffId)) {
                selectStaff(parseInt(staffId));
            }
        }
    } catch (error) {
        console.error('Error editing staff:', error);
        showMessage(error.message || 'Erreur lors de la modification du personnel', 'error');
    }
}

// Handle assign service - Updated to use shared API client
async function handleAssignService(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    const staffId = formData.get('assignStaffId');
    const serviceId = formData.get('assignServiceSelect');
    
    try {
        const assignmentData = {
            service_id: parseInt(serviceId)
        };
        
        const response = await apiClient.makeRequest(`/api/admin/staff/${staffId}/assign-service`, {
            method: 'POST',
            body: JSON.stringify(assignmentData)
        });
        
        if (response) {
            showMessage('Service assigné avec succès', 'success');
            closeModal('assignServiceModal');
            await loadStaffList();
            if (currentStaff && currentStaff.id === parseInt(staffId)) {
                selectStaff(parseInt(staffId));
            }
        }
    } catch (error) {
        console.error('Error assigning service:', error);
        showMessage(error.message || 'Erreur lors de l\'assignation du service', 'error');
    }
}

// Deactivate staff - Updated to use shared API client
async function deactivateStaff() {
    if (!currentStaff) return;
    
    if (!confirm(`Êtes-vous sûr de vouloir désactiver ${currentStaff.full_name} ?`)) {
        return;
    }
    
    try {
        const response = await apiClient.makeRequest(`/api/admin/staff/${currentStaff.id}/deactivate`, {
            method: 'PUT'
        });
        
        if (response) {
            showMessage('Personnel désactivé avec succès', 'success');
            await loadStaffList();
            await loadStaffStats();
            selectStaff(currentStaff.id);
        }
    } catch (error) {
        console.error('Error deactivating staff:', error);
        showMessage(error.message || 'Erreur lors de la désactivation', 'error');
    }
}

// Remove service assignment - Updated to use shared API client
async function removeServiceAssignment(staffId) {
    if (!confirm('Êtes-vous sûr de vouloir retirer l\'assignation de service ?')) {
        return;
    }
    
    try {
        const response = await apiClient.makeRequest(`/api/admin/staff/${staffId}/service-assignment`, {
            method: 'DELETE'
        });
        
        if (response) {
            showMessage('Assignation de service supprimée', 'success');
            await loadStaffList();
            if (currentStaff && currentStaff.id === staffId) {
                selectStaff(staffId);
            }
        }
    } catch (error) {
        console.error('Error removing service assignment:', error);
        showMessage(error.message || 'Erreur lors de la suppression de l\'assignation', 'error');
    }
}

// Refresh staff list
async function refreshStaffList() {
    await loadStaffList();
    await loadStaffStats();
}

// Show add staff modal
function showAddStaffModal() {
    const modal = document.getElementById('addStaffModal');
    modal.style.display = 'flex';
    populateServiceSelects();
}

// Show edit staff modal
function showEditStaffModal() {
    if (!currentStaff) return;
    
    const modal = document.getElementById('editStaffModal');
    
    // Populate form
    document.getElementById('editStaffId').value = currentStaff.id;
    document.getElementById('editStaffFirstName').value = getFirstName(currentStaff.full_name);
    document.getElementById('editStaffLastName').value = getLastName(currentStaff.full_name);
    document.getElementById('editStaffEmail').value = currentStaff.email;
    document.getElementById('editStaffPhone').value = currentStaff.phone || '';
    document.getElementById('editStaffRole').value = currentStaff.role;
    document.getElementById('editStaffService').value = currentStaff.assigned_service_id || '';
    
    // Clear passwords
    document.getElementById('editStaffPassword').value = '';
    document.getElementById('editStaffConfirmPassword').value = '';
    
    populateServiceSelects('editStaffService');
    modal.style.display = 'flex';
}

// Show assign service modal
function showAssignServiceModal() {
    if (!currentStaff) return;
    
    const modal = document.getElementById('assignServiceModal');
    document.getElementById('assignStaffId').value = currentStaff.id;
    populateServiceSelects('assignServiceSelect');
    modal.style.display = 'flex';
}

// Edit staff function
function editStaff() {
    showEditStaffModal();
}

// Update staff statistics
function updateStaffStats(stats) {
    document.getElementById('totalStaff').textContent = stats.total_staff || 0;
    document.getElementById('activeStaff').textContent = stats.active_staff || 0;
    document.getElementById('totalServices').textContent = stats.total_services || 0;
}

// Populate service selects
function populateServiceSelects(selectId = null) {
    const selects = selectId ? [document.getElementById(selectId)] : [
        document.getElementById('staffService'),
        document.getElementById('editStaffService'),
        document.getElementById('assignServiceSelect')
    ];
    
    selects.forEach(select => {
        if (!select) return;
        
        // Keep the first option (placeholder)
        const placeholder = select.querySelector('option[value=""]');
        select.innerHTML = '';
        if (placeholder) {
            select.appendChild(placeholder);
        }
        
        servicesList.forEach(service => {
            const option = document.createElement('option');
            option.value = service.id;
            option.textContent = service.name;
            select.appendChild(option);
        });
    });
}

// Show detail actions
function showDetailActions() {
    const detailActions = document.getElementById('detailActions');
    if (detailActions) {
        detailActions.style.display = 'flex';
    }
}

// Close modal
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

// Utility functions
function getRoleDisplayName(role) {
    const roleNames = {
        'admin': 'Administrateur',
        'staff': 'Secrétaire',
        'doctor': 'Médecin',
        'patient': 'Patient'
    };
    return roleNames[role] || role;
}

function getInitials(name) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
}

function getFirstName(fullName) {
    return fullName.split(' ')[0] || '';
}

function getLastName(fullName) {
    const parts = fullName.split(' ');
    return parts.slice(1).join(' ') || '';
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getActivityIcon(type) {
    const icons = {
        'login': 'fas fa-sign-in-alt',
        'logout': 'fas fa-sign-out-alt',
        'add_patient': 'fas fa-user-plus',
        'update_patient': 'fas fa-user-edit',
        'call_patient': 'fas fa-bell',
        'complete_ticket': 'fas fa-check-circle'
    };
    return icons[type] || 'fas fa-info-circle';
}

function getActivityIconClass(type) {
    const classes = {
        'login': 'success',
        'logout': 'info',
        'add_patient': 'success',
        'update_patient': 'info',
        'call_patient': 'warning',
        'complete_ticket': 'success'
    };
    return classes[type] || 'info';
}

// Quick action functions
function showBulkImportModal() {
    showMessage('Fonctionnalité d\'import en lot à implémenter', 'info');
}

function showPermissionsModal() {
    showMessage('Fonctionnalité de gestion des permissions à implémenter', 'info');
}

function showReports() {
    window.location.href = '../reports/reports.html';
}

function showBackupModal() {
    showMessage('Fonctionnalité d\'export à implémenter', 'info');
}

// Update admin info - Updated to use shared API client
async function updateAdminInfo() {
    try {
        const user = await apiClient.getCurrentUserInfo();
        if (user) {
            const adminNameElement = document.getElementById('adminName');
            if (adminNameElement) {
                adminNameElement.textContent = user.full_name || 'Administrateur';
            }
        }
    } catch (error) {
        console.error('Error getting user info:', error);
        // Fallback to stored user info
        const user = apiClient.getCurrentUser();
        if (user) {
            const adminNameElement = document.getElementById('adminName');
            if (adminNameElement) {
                adminNameElement.textContent = user.full_name || 'Administrateur';
            }
        }
    }
}

// Handle logout - Updated to use shared API client
function handleLogout() {
    apiClient.logout();
    window.location.href = '../Acceuil/acceuil.html';
}

// Loading states
function showLoading(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.classList.add('loading');
    }
}

function hideLoading(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.classList.remove('loading');
    }
}

// Message display - Updated to use shared message manager
function showMessage(message, type = 'info') {
    // Use the shared message manager if available
    if (window.MessageManager) {
        window.MessageManager.show(type, message, { duration: 3000 });
    } else {
        // Fallback to alert
        alert(message);
    }
} 