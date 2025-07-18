// Patients data from backend
let patients = [];
let currentFilter = 'all';
let searchTerm = '';

// Check authentication and role
function checkAdminAuth() {
  if (!apiClient.isAuthenticated()) {
    window.location.href = '../Acceuil/acceuil.html?login=true';
    return false;
  }
  
  if (!apiClient.isAdmin()) {
    APIUtils.showNotification('Accès non autorisé. Cette page est réservée aux administrateurs.', 'error');
    window.location.href = '../qr code/qr.html';
    return false;
  }
  
  return true;
}

// Load patients data from backend
async function loadPatients() {
  try {
    APIUtils.showLoading(document.getElementById('patientsTableBody'));
    
    const patientsData = await apiClient.getPatients();
    if (patientsData) {
      patients = patientsData;
      displayPatients();
    }
  } catch (error) {
    console.error('Error loading patients:', error);
    APIUtils.showError(document.getElementById('patientsTableBody'), 'Erreur lors du chargement des patients');
    APIUtils.showNotification('Erreur de connexion au serveur', 'error');
  }
}

// Fonction pour afficher les patients
function displayPatients() {
  const tbody = document.getElementById('patientsTableBody');
  
  if (!patients || patients.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8">Aucun patient trouvé</td></tr>';
    return;
  }
  
  const filteredPatients = patients.filter(patient => {
    const matchesFilter = currentFilter === 'all' || patient.status === currentFilter;
    const matchesSearch = searchTerm === '' || 
      patient.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      patient.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      patient.phone.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesFilter && matchesSearch;
  });
  
  tbody.innerHTML = filteredPatients.map(patient => `
    <tr data-id="${patient.id}">
      <td class="patient-id">P${String(patient.id).padStart(3, '0')}</td>
      <td class="patient-name">${patient.full_name}</td>
      <td>${patient.service_name || 'N/A'}</td>
      <td>
        <span class="status-badge status-${patient.status || 'waiting'}">
          ${getStatusText(patient.status || 'waiting')}
        </span>
      </td>
      <td class="arrival-time">${APIUtils.formatDate(patient.created_at)}</td>
      <td class="wait-time">${patient.wait_time || '0 min'}</td>
      <td>
        <span class="priority-badge priority-medium">
          Normale
        </span>
      </td>
      <td>
        <div class="action-buttons">
          <button class="action-btn edit-action-btn" onclick="editPatient(${patient.id})" title="Modifier">
            ✏️
          </button>
          <button class="action-btn delete-action-btn" onclick="deletePatient(${patient.id})" title="Supprimer">
            🗑️
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

// Fonction pour obtenir le texte du statut
function getStatusText(status) {
  switch (status) {
    case 'waiting': return 'En attente';
    case 'consulting': return 'En consultation';
    case 'completed': return 'Terminé';
    default: return 'En attente';
  }
}

// Fonction pour obtenir le texte de la priorité
function getPriorityText(priority) {
  switch (priority) {
    case 'high': return 'Haute';
    case 'medium': return 'Moyenne';
    case 'low': return 'Basse';
    default: return 'Normale';
  }
}

// Fonction pour filtrer les patients
function filterPatients(filter) {
  currentFilter = filter;
  
  // Mettre à jour les boutons de filtre
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  event.target.classList.add('active');
  
  displayPatients();
}

// Fonction pour rechercher des patients
function searchPatients() {
  searchTerm = document.getElementById('searchPatient').value;
  displayPatients();
}

// Fonction pour ouvrir le modal d'ajout
function openAddPatientModal() {
  document.getElementById('addPatientModal').style.display = 'flex';
  document.getElementById('addPatientForm').reset();
  
  // Load services for the dropdown
  loadServicesForDropdown('patientService');
}

// Fonction pour fermer les modals
function closeModal() {
  document.getElementById('addPatientModal').style.display = 'none';
  document.getElementById('editPatientModal').style.display = 'none';
  
  // Clear any error messages
  const errorElements = document.querySelectorAll('.error');
  errorElements.forEach(element => {
    element.style.display = 'none';
  });
}

// Load services for dropdown
async function loadServicesForDropdown(selectId) {
  try {
    const services = await apiClient.getActiveServices();
    const select = document.getElementById(selectId);
    
    if (select) {
      select.innerHTML = '<option value="">Sélectionner un service</option>';
      services.forEach(service => {
        select.innerHTML += `<option value="${service.name}">${service.name}</option>`;
      });
    }
  } catch (error) {
    console.error('Error loading services:', error);
  }
}

// Fonction pour éditer un patient
function editPatient(patientId) {
  const patient = patients.find(p => p.id === patientId);
  if (!patient) return;
  
  // Remplir le formulaire d'édition
  document.getElementById('editPatientId').value = patient.id;
  document.getElementById('editPatientFirstName').value = patient.full_name.split(' ')[0] || '';
  document.getElementById('editPatientLastName').value = patient.full_name.split(' ').slice(1).join(' ') || '';
  document.getElementById('editPatientAge').value = patient.age || '';
  document.getElementById('editPatientPhone').value = patient.phone || '';
  document.getElementById('editPatientService').value = patient.service_name || '';
  document.getElementById('editPatientStatus').value = patient.status || 'waiting';
  document.getElementById('editPatientPriority').value = 'medium'; // Default priority
  document.getElementById('editPatientNotes').value = patient.notes || '';
  
  // Load services for edit dropdown
  loadServicesForDropdown('editPatientService').then(() => {
    document.getElementById('editPatientService').value = patient.service_name || '';
  });
  
  // Afficher le modal
  document.getElementById('editPatientModal').style.display = 'flex';
}

// Fonction pour supprimer un patient
async function deletePatient(patientId) {
  if (!confirm('Êtes-vous sûr de vouloir supprimer ce patient ?')) {
    return;
  }
  
  try {
    // Note: This would require implementing a delete patient endpoint in the backend
    // For now, we'll show a notification that this feature is not yet implemented
    APIUtils.showNotification('Suppression de patients non encore implémentée dans le backend', 'warning');
    // await apiClient.deletePatient(patientId);
    // APIUtils.showNotification('Patient supprimé avec succès', 'success');
    // await loadPatients(); // Reload patients
  } catch (error) {
    console.error('Error deleting patient:', error);
    APIUtils.showNotification('Erreur lors de la suppression du patient', 'error');
  }
}

// Fonction pour ajouter un nouveau patient
async function addPatient(formData) {
  try {
    // Get active services first to find service ID
    const services = await apiClient.getActiveServices();
    const selectedServiceName = formData.get('patientService');
    const selectedService = services.find(s => s.name === selectedServiceName);
    
    if (!selectedService) {
      APIUtils.showNotification('Veuillez sélectionner un service valide', 'error');
      return;
    }
    
    const patientData = {
      full_name: `${formData.get('patientFirstName')} ${formData.get('patientLastName')}`,
      phone: formData.get('patientPhone'),
      service_id: selectedService.id,
      priority: formData.get('patientPriority') || 'medium'
    };
    
    await apiClient.createPatient(patientData);
    APIUtils.showNotification('Patient ajouté avec succès', 'success');
    closeModal();
    await loadPatients(); // Reload patients
  } catch (error) {
    console.error('Error adding patient:', error);
    APIUtils.showNotification('Erreur lors de l\'ajout du patient', 'error');
  }
}

// Fonction pour modifier un patient
async function updatePatient(formData) {
  try {
    // Note: This would require implementing an update patient endpoint in the backend
    // For now, we'll show a notification that this feature is not yet implemented
    APIUtils.showNotification('Modification de patients non encore implémentée dans le backend', 'warning');
    closeModal();
    
    // When implemented, this would be:
    // const patientId = parseInt(formData.get('editPatientId'));
    // const patientData = { ... };
    // await apiClient.updatePatient(patientId, patientData);
    // APIUtils.showNotification('Patient modifié avec succès', 'success');
    // await loadPatients();
  } catch (error) {
    console.error('Error updating patient:', error);
    APIUtils.showNotification('Erreur lors de la modification du patient', 'error');
  }
}

// Fonction pour mettre à jour les temps d'attente
function updateWaitTimes() {
  // This would be handled by the backend real-time updates
  // For now, we'll just reload the patients data
  loadPatients();
}

// Fonction pour exporter les données des patients
function exportPatientsData() {
  const data = {
    timestamp: new Date().toISOString(),
    patients: patients
  };
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `patients-data-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
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

// Gestionnaires d'événements
document.addEventListener('DOMContentLoaded', async () => {
  // Check authentication and authorization
  if (!checkAdminAuth()) {
    return;
  }
  
  // Load initial patients data
  await loadPatients();
  
  // Gestionnaire pour le formulaire d'ajout
  const addForm = document.getElementById('addPatientForm');
  if (addForm) {
    addForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      await addPatient(formData);
    });
  }
  
  // Gestionnaire pour le formulaire d'édition
  const editForm = document.getElementById('editPatientForm');
  if (editForm) {
    editForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      await updatePatient(formData);
    });
  }
  
  // Fermer les modals en cliquant à l'extérieur
  document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });
  });
  
  // Fermer les modals avec la touche Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
    }
  });
  
  // Mettre à jour les temps d'attente toutes les minutes
  setInterval(updateWaitTimes, 60000);
  
  console.log('Patients page initialized for admin user');
});

// Exposer les fonctions globalement
window.openAddPatientModal = openAddPatientModal;
window.closeModal = closeModal;
window.editPatient = editPatient;
window.deletePatient = deletePatient;
window.filterPatients = filterPatients;
window.searchPatients = searchPatients;
window.exportPatientsData = exportPatientsData;
window.handleLogout = handleLogout; 