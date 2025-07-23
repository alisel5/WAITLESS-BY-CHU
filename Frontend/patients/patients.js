// Patients data
let patientsData = [];
let filteredPatients = [];
let currentFilter = 'all';
let servicesData = [];

// Check authentication and role
function checkAdminAuth() {
  if (!apiClient.isAuthenticated()) {
    window.location.href = '../Acceuil/acceuil.html?login=true';
    return false;
  }
  
  if (!apiClient.isAdmin()) {
    APIUtils.showNotification('Accès non autorisé. Cette page est réservée aux administrateurs.', 'error');
    window.location.href = '../dashboard/dashboard.html';
    return false;
  }
  
  return true;
}

// Load services data
async function loadServices() {
  try {
    const response = await apiClient.getServices();
    if (response && Array.isArray(response)) {
      servicesData = response;
      populateServiceSelects();
    }
  } catch (error) {
    console.error('Error loading services:', error);
  }
}

// Populate service select dropdowns
function populateServiceSelects() {
  const addServiceSelect = document.getElementById('patientService');
  const editServiceSelect = document.getElementById('editPatientService');
  
  if (addServiceSelect) {
    addServiceSelect.innerHTML = '<option value="">Sélectionner un service</option>';
    servicesData.forEach(service => {
      addServiceSelect.innerHTML += `<option value="${service.name}">${service.name}</option>`;
    });
  }
  
  if (editServiceSelect) {
    editServiceSelect.innerHTML = '<option value="">Sélectionner un service</option>';
    servicesData.forEach(service => {
      editServiceSelect.innerHTML += `<option value="${service.name}">${service.name}</option>`;
    });
  }
}

// Load patients data from backend
async function loadPatientsData() {
  try {
    showLoading(true);
    
    // Get patients from backend
    const response = await apiClient.getPatients();
    console.log('Patients Response:', response);
    
    if (response && Array.isArray(response)) {
      patientsData = response;
      filteredPatients = [...patientsData];
      displayPatients();
    } else {
      throw new Error('Invalid response format');
    }
    
  } catch (error) {
    console.error('Error loading patients data:', error);
    APIUtils.showNotification('Erreur lors du chargement des patients', 'error');
    patientsData = [];
    filteredPatients = [];
    displayPatients();
  } finally {
    showLoading(false);
  }
}

// Mock data function removed - using real backend data only

// Display patients in table
function displayPatients() {
  const tableBody = document.getElementById('patientsTableBody');
  
  if (!tableBody) return;
  
  if (filteredPatients.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 2rem; color: #666;">
          <i class="fas fa-users" style="font-size: 2rem; margin-bottom: 1rem; display: block;"></i>
          Aucun patient trouvé
        </td>
      </tr>
    `;
    return;
  }
  
  tableBody.innerHTML = filteredPatients.map(patient => `
    <tr data-patient-id="${patient.id}">
      <td>${patient.id}</td>
      <td>${patient.name}</td>
      <td>${patient.service}</td>
      <td>
        <span class="status-badge ${patient.status}">
          ${getStatusText(patient.status)}
        </span>
      </td>
      <td>${formatDateTime(patient.arrival_time)}</td>
      <td>${formatWaitTime(patient.wait_time)}</td>
      <td>
        <span class="priority-badge ${patient.priority}">
          ${getPriorityText(patient.priority)}
        </span>
      </td>
      <td>
        <div class="action-buttons">
          <button onclick="editPatient(${patient.id})" class="edit-btn" title="Modifier">
            <i class="fas fa-edit"></i>
          </button>
          <button onclick="viewPatientDetails(${patient.id})" class="view-btn" title="Voir détails">
            <i class="fas fa-eye"></i>
          </button>
          <button onclick="deletePatient(${patient.id})" class="delete-btn" title="Supprimer">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

// Search patients
function searchPatients() {
  const searchTerm = document.getElementById('searchPatient').value.toLowerCase();
  
  filteredPatients = patientsData.filter(patient => 
    patient.name.toLowerCase().includes(searchTerm) ||
    patient.service.toLowerCase().includes(searchTerm) ||
    patient.phone.includes(searchTerm)
  );
  
  displayPatients();
}

// Filter patients by status
function filterPatients(status) {
  currentFilter = status;
  
  // Update filter buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  event.target.classList.add('active');
  
  // Apply filter
  if (status === 'all') {
    filteredPatients = [...patientsData];
  } else {
    filteredPatients = patientsData.filter(patient => patient.status === status);
  }
  
  displayPatients();
}

// Open add patient modal
function openAddPatientModal() {
  document.getElementById('addPatientModal').style.display = 'flex';
  document.getElementById('addPatientForm').reset();
}

// Close modal
function closeModal() {
  document.getElementById('addPatientModal').style.display = 'none';
  document.getElementById('editPatientModal').style.display = 'none';
}

// Add new patient
async function addPatient(event) {
  event.preventDefault();
  
  const formData = {
    first_name: document.getElementById('patientFirstName').value,
    last_name: document.getElementById('patientLastName').value,
    email: document.getElementById('patientEmail').value,
    phone: document.getElementById('patientPhone').value,
    service: document.getElementById('patientService').value,
    priority: document.getElementById('patientPriority').value,
    notes: document.getElementById('patientNotes').value || null
  };
  
  try {
    showLoading(true);
    
    const response = await apiClient.createPatient(formData);
    console.log('Patient created:', response);
    
    APIUtils.showNotification('Patient ajouté avec succès', 'success');
    closeModal();
    loadPatientsData(); // Reload data
    
  } catch (error) {
    console.error('Error creating patient:', error);
    const errorMessage = error.message || 'Erreur lors de l\'ajout du patient';
    APIUtils.showNotification(errorMessage, 'error');
  } finally {
    showLoading(false);
  }
}

// Edit patient
function editPatient(patientId) {
  const patient = patientsData.find(p => p.id === patientId);
  if (!patient) return;
  
  // Populate edit form
  document.getElementById('editPatientId').value = patient.id;
  
  // Split full name into first and last name
  const nameParts = patient.name.split(' ');
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';
  
  document.getElementById('editPatientFirstName').value = firstName;
  document.getElementById('editPatientLastName').value = lastName;
  document.getElementById('editPatientEmail').value = patient.email || '';
  document.getElementById('editPatientPhone').value = patient.phone || '';
  document.getElementById('editPatientService').value = patient.service || '';
  document.getElementById('editPatientPriority').value = patient.priority || '';
  document.getElementById('editPatientNotes').value = patient.notes || '';
  
  // Show modal
  document.getElementById('editPatientModal').style.display = 'flex';
}

// Update patient
async function updatePatient(event) {
  event.preventDefault();
  
  const patientId = document.getElementById('editPatientId').value;
  const formData = {
    first_name: document.getElementById('editPatientFirstName').value,
    last_name: document.getElementById('editPatientLastName').value,
    email: document.getElementById('editPatientEmail').value,
    phone: document.getElementById('editPatientPhone').value,
    service: document.getElementById('editPatientService').value,
    priority: document.getElementById('editPatientPriority').value,
    notes: document.getElementById('editPatientNotes').value || null
  };
  
  try {
    showLoading(true);
    
    // Update patient in backend
    const response = await apiClient.updatePatient(patientId, formData);
    console.log('Patient updated:', response);
    
    APIUtils.showNotification('Patient modifié avec succès', 'success');
    closeModal();
    loadPatientsData(); // Reload data
    
  } catch (error) {
    console.error('Error updating patient:', error);
    const errorMessage = error.message || 'Erreur lors de la modification du patient';
    APIUtils.showNotification(errorMessage, 'error');
  } finally {
    showLoading(false);
  }
}

// View patient details
function viewPatientDetails(patientId) {
  const patient = patientsData.find(p => p.id === patientId);
  if (!patient) return;
  
  // Create details modal
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal patient-details-modal">
      <span class="close-btn" onclick="this.parentElement.parentElement.remove()">&times;</span>
      <h2>Détails du Patient</h2>
      <div class="patient-details">
        <div class="detail-row">
          <strong>Nom complet:</strong> ${patient.name}
        </div>
        <div class="detail-row">
          <strong>Service:</strong> ${patient.service}
        </div>
        <div class="detail-row">
          <strong>Statut:</strong> 
          <span class="status-badge ${patient.status}">${getStatusText(patient.status)}</span>
        </div>
        <div class="detail-row">
          <strong>Priorité:</strong> 
          <span class="priority-badge ${patient.priority}">${getPriorityText(patient.priority)}</span>
        </div>
        <div class="detail-row">
          <strong>Téléphone:</strong> ${patient.phone}
        </div>
        <div class="detail-row">
          <strong>Arrivée:</strong> ${formatDateTime(patient.arrival_time)}
        </div>
        <div class="detail-row">
          <strong>Temps d'attente:</strong> ${formatWaitTime(patient.wait_time)}
        </div>
        ${patient.notes ? `
        <div class="detail-row">
          <strong>Notes:</strong> ${patient.notes}
        </div>
        ` : ''}
      </div>
      <div class="modal-actions">
        <button onclick="editPatient(${patient.id})" class="btn btn-primary">
          <i class="fas fa-edit"></i> Modifier
        </button>
        <button onclick="this.parentElement.parentElement.parentElement.remove()" class="btn btn-secondary">
          Fermer
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

// Delete patient
async function deletePatient(patientId) {
  if (!confirm('Êtes-vous sûr de vouloir supprimer ce patient ?')) {
    return;
  }
  
  try {
    showLoading(true);
    
    // Delete patient from backend
    await apiClient.deletePatient(patientId);
    
    APIUtils.showNotification('Patient supprimé avec succès', 'success');
    loadPatientsData(); // Reload data
    
  } catch (error) {
    console.error('Error deleting patient:', error);
    const errorMessage = error.message || 'Erreur lors de la suppression du patient';
    APIUtils.showNotification(errorMessage, 'error');
  } finally {
    showLoading(false);
  }
}

// Export patients data
function exportPatientsData() {
  try {
    const data = {
      exported_at: new Date().toISOString(),
      filter: currentFilter,
      patients: filteredPatients
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `patients-export-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    
    APIUtils.showNotification('Données exportées avec succès', 'success');
  } catch (error) {
    console.error('Error exporting data:', error);
    APIUtils.showNotification('Erreur lors de l\'export', 'error');
  }
}

// Helper functions
function getStatusText(status) {
  const statusMap = {
    'waiting': 'En attente',
    'completed': 'Terminé',
    'cancelled': 'Annulé',
    'expired': 'Expiré'
  };
  return statusMap[status] || status;
}

function getPriorityText(priority) {
  const priorityMap = {
    'high': 'Haute',
    'medium': 'Moyenne',
    'low': 'Basse'
  };
  return priorityMap[priority] || priority;
}

function formatDateTime(dateString) {
  return new Date(dateString).toLocaleString('fr-FR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatWaitTime(minutes) {
  if (minutes < 60) {
    return `${minutes} min`;
  } else {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}min`;
  }
}

// Replace the showLoading function to only show a small spinner in the patients table area, not a full-screen overlay.
function showLoading(show) {
  const tableBody = document.getElementById('patientsTableBody');
  if (!tableBody) return;

  if (show) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 2rem; color: #666;">
          <div class="spinner" style="margin: 0 auto;"></div>
          <div>Chargement des patients...</div>
        </td>
      </tr>
    `;
  } else {
    // Do nothing, as displayPatients will overwrite the table
  }
}

// Logout function
async function handleLogout() {
  if (confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) {
    try {
      await apiClient.logout();
      APIUtils.showNotification('Déconnexion réussie', 'success');
      window.location.href = '../Acceuil/acceuil.html';
    } catch (error) {
      console.error('Logout error:', error);
      // Force logout even if backend call fails
      apiClient.removeToken();
      window.location.href = '../Acceuil/acceuil.html';
    }
  }
}

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
  if (checkAdminAuth()) {
    // Load services first, then patients
    loadServices().then(() => {
      loadPatientsData();
    });
    
    // Setup form event listeners
    document.getElementById('addPatientForm').addEventListener('submit', addPatient);
    document.getElementById('editPatientForm').addEventListener('submit', updatePatient);
  }
});

// Add CSS for loading spinner and modals
const style = document.createElement('style');
style.textContent = `
  .loading-spinner {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    z-index: 9999;
    color: white;
  }
  
  .spinner {
    width: 50px;
    height: 50px;
    border: 5px solid #f3f3f3;
    border-top: 5px solid #3498db;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 20px;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  .status-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 15px;
    font-size: 0.8rem;
    font-weight: 600;
    text-transform: uppercase;
  }
  
  .status-badge.waiting {
    background: #f39c12;
    color: white;
  }
  
  .status-badge.cancelled {
    background: #95a5a6;
    color: white;
  }
  
  .status-badge.expired {
    background: #7f8c8d;
    color: white;
  }
  
  .status-badge.completed {
    background: #27ae60;
    color: white;
  }
  
  .status-badge.cancelled {
    background: #95a5a6;
    color: white;
  }
  
  .priority-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 15px;
    font-size: 0.8rem;
    font-weight: 600;
  }
  
  .priority-badge.high {
    background: #e74c3c;
    color: white;
  }
  
  .priority-badge.medium {
    background: #f39c12;
    color: white;
  }
  
  .priority-badge.low {
    background: #27ae60;
    color: white;
  }
  
  .action-buttons {
    display: flex;
    gap: 0.5rem;
  }
  
  .action-buttons button {
    padding: 0.5rem;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    transition: all 0.3s ease;
  }
  
  .edit-btn {
    background: #3498db;
    color: white;
  }
  
  .edit-btn:hover {
    background: #2980b9;
  }
  
  .view-btn {
    background: #27ae60;
    color: white;
  }
  
  .view-btn:hover {
    background: #229954;
  }
  
  .delete-btn {
    background: #e74c3c;
    color: white;
  }
  
  .delete-btn:hover {
    background: #c0392b;
  }
  
  .patient-details-modal {
    max-width: 600px;
  }
  
  .patient-details {
    margin: 1rem 0;
  }
  
  .detail-row {
    padding: 0.75rem 0;
    border-bottom: 1px solid #eee;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .detail-row:last-child {
    border-bottom: none;
  }
  
  .modal-actions {
    display: flex;
    gap: 1rem;
    justify-content: flex-end;
    margin-top: 2rem;
  }
`;
document.head.appendChild(style); 