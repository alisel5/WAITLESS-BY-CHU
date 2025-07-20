// Variables globales
let currentService = null; // Changed from department to service
let currentServiceId = 1; // Default service ID
let currentSecretary = 'Secrétaire';
let patients = [];
let queue = [];
let isConnected = false;

// Initialisation au chargement de la page
document.addEventListener('DOMContentLoaded', function() {
  console.log('Page secrétariat chargée');
  initializeSecretaryPage();
  setupEventListeners();
  loadInitialData();
});

// Initialisation de la page
async function initializeSecretaryPage() {
  // Check authentication using the shared API client
  if (!apiClient.isAuthenticated()) {
    window.location.href = '../signup/signup.html';
    return;
  }

  try {
    // Get current user info
    const userInfo = await apiClient.getCurrentUserInfo();
    if (userInfo) {
      currentSecretary = userInfo.full_name;
      document.getElementById('secretaryName').textContent = currentSecretary;
      
      // Get user's assigned service
      if (userInfo.assigned_service_id) {
        currentServiceId = userInfo.assigned_service_id;
        // Get service details
        const service = await apiClient.getService(currentServiceId);
        if (service) {
          currentService = service;
          document.getElementById('departmentName').textContent = service.name;
        }
      } else if (userInfo.role === 'admin') {
        // Admin can see all services, default to first one
        const services = await apiClient.getServices();
        if (services && services.length > 0) {
          currentServiceId = services[0].id;
          currentService = services[0];
          document.getElementById('departmentName').textContent = services[0].name;
        }
      }
      
      // Show staff management link for admins
      if (userInfo.role === 'admin') {
        const staffLink = document.getElementById('staffLink');
        if (staffLink) {
          staffLink.style.display = 'inline';
        }
      }
    }
  } catch (error) {
    console.error('Error getting user info:', error);
    // Use fallback values
    currentServiceId = 1;
  }
  
  // Initialiser les statistiques
  updateStats();
  
  // Charger les données initiales
  loadQueue();
  loadPatients();
}

// Configuration des écouteurs d'événements
function setupEventListeners() {
  // Recherche de patients
  const searchInput = document.getElementById('patientSearch');
  if (searchInput) {
    searchInput.addEventListener('input', filterPatients);
  }
  
  // Filtres
  const statusFilter = document.getElementById('statusFilter');
  const priorityFilter = document.getElementById('priorityFilter');
  
  if (statusFilter) {
    statusFilter.addEventListener('change', filterPatients);
  }
  
  if (priorityFilter) {
    priorityFilter.addEventListener('change', filterPatients);
  }
  
  // WebSocket pour les mises à jour en temps réel
  setupWebSocket();
}

// Configuration WebSocket
function setupWebSocket() {
  if (typeof WebSocketClient !== 'undefined') {
    WebSocketClient.onMessage((data) => {
      try {
        const message = JSON.parse(data);
        handleWebSocketMessage(message);
      } catch (error) {
        console.error('Erreur parsing WebSocket message:', error);
      }
    });
    
    WebSocketClient.onConnect(() => {
      console.log('WebSocket connecté pour secrétariat');
      isConnected = true;
    });
    
    WebSocketClient.onDisconnect(() => {
      console.log('WebSocket déconnecté');
      isConnected = false;
    });
  }
}

// Gestion des messages WebSocket
function handleWebSocketMessage(message) {
  switch (message.type) {
    case 'queue_update':
      loadQueue();
      break;
    case 'patient_added':
      loadPatients();
      loadQueue();
      break;
    case 'patient_status_changed':
      loadPatients();
      loadQueue();
      updateStats();
      break;
    case 'department_stats_update':
      updateStats();
      break;
  }
}

// Chargement des données initiales
async function loadInitialData() {
  try {
    await Promise.all([
      loadQueue(),
      loadPatients(),
      updateStats()
    ]);
  } catch (error) {
    console.error('Erreur lors du chargement des données:', error);
    showMessage('Erreur lors du chargement des données', 'error');
  }
}

// Charger la file d'attente - Updated to use correct API
async function loadQueue() {
  try {
    const response = await apiClient.makeRequest(`/api/admin/secretary/queue/${currentServiceId}`);
    queue = response || [];
    displayQueue();
    updateQueueSummary();
  } catch (error) {
    console.error('Erreur lors du chargement de la file:', error);
    showMessage('Erreur lors du chargement de la file d\'attente', 'error');
    queue = [];
    displayQueue();
  }
}

// Afficher la file d'attente
function displayQueue() {
  const queueList = document.getElementById('queueList');
  if (!queueList) return;
  
  if (queue.length === 0) {
    queueList.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-users-slash"></i>
        <h3>Aucun patient en attente</h3>
        <p>La file d'attente est vide pour le moment.</p>
      </div>
    `;
    return;
  }
  
  queueList.innerHTML = queue.map((patient, index) => {
    const waitTime = calculateWaitTime(patient.created_at);
    const priorityClass = patient.priority === 'emergency' ? 'urgent' : 
                         patient.priority === 'high' ? 'urgent' : '';
    const statusClass = patient.status === 'in_consultation' ? 'in-consultation' : '';
    
    const manualIndicator = patient.source === 'manual' ? '<span class="manual-indicator"><i class="fas fa-hand-paper"></i></span>' : '';
    
    return `
      <div class="queue-item ${priorityClass} ${statusClass}" onclick="selectPatient(${patient.id})">
        <div class="queue-header">
          <span class="patient-name">${patient.name} ${manualIndicator}</span>
          <span class="patient-number">#${patient.ticket_number}</span>
        </div>
        <div class="queue-details">
          <div>
            <span><i class="fas fa-clock"></i> ${waitTime}</span>
            <span><i class="fas fa-user-md"></i> ${patient.reason || 'Consultation'}</span>
            ${patient.source === 'manual' ? '<span><i class="fas fa-info-circle"></i> Manuel</span>' : ''}
          </div>
          <div class="queue-actions-item">
            ${patient.status === 'waiting' ? `
              <button class="call-btn" onclick="event.stopPropagation(); callPatient(${patient.id})">
                <i class="fas fa-bell"></i> Appeler
              </button>
            ` : ''}
            ${patient.status === 'in_consultation' ? `
              <button class="complete-btn" onclick="event.stopPropagation(); completeConsultation(${patient.id})">
                <i class="fas fa-check"></i> Terminer
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Charger les patients - Updated to use correct API
async function loadPatients() {
  try {
    const response = await apiClient.makeRequest(`/api/admin/secretary/patients/${currentServiceId}`);
    patients = response || [];
    displayPatients();
  } catch (error) {
    console.error('Erreur lors du chargement des patients:', error);
    showMessage('Erreur lors du chargement des patients', 'error');
    patients = [];
    displayPatients();
  }
}

// Afficher les patients
function displayPatients(filteredPatients = null) {
  const patientsList = document.getElementById('patientsList');
  if (!patientsList) return;
  
  const patientsToShow = filteredPatients || patients;
  
  if (patientsToShow.length === 0) {
    patientsList.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-user-slash"></i>
        <h3>Aucun patient trouvé</h3>
        <p>Aucun patient ne correspond aux critères de recherche.</p>
      </div>
    `;
    return;
  }
  
  patientsList.innerHTML = patientsToShow.map(patient => {
    const priorityClass = patient.priority === 'emergency' ? 'emergency' : patient.priority;
    const statusClass = patient.status;
    const urgentClass = patient.priority === 'emergency' ? 'urgent' : '';
    
    const manualIndicator = patient.source === 'manual' ? '<span class="manual-indicator"><i class="fas fa-hand-paper"></i> Manuel</span>' : '';
    
    return `
      <div class="patient-card ${urgentClass}" onclick="selectPatient(${patient.id})">
        <div class="patient-info">
          <div class="patient-details">
            <h4>${patient.name} ${manualIndicator}</h4>
            <p><i class="fas fa-phone"></i> ${patient.phone}</p>
            <p><i class="fas fa-user-md"></i> ${patient.reason || 'Consultation'}</p>
            ${patient.age ? `<p><i class="fas fa-birthday-cake"></i> ${patient.age} ans</p>` : ''}
            ${patient.source === 'manual' ? `<p><i class="fas fa-info-circle"></i> Ajouté manuellement</p>` : ''}
          </div>
          <div class="patient-status">
            <span class="status-badge ${statusClass}">${getStatusLabel(patient.status)}</span>
            <span class="priority-badge ${priorityClass}">${getPriorityLabel(patient.priority)}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Filtrer les patients
function filterPatients() {
  const searchTerm = document.getElementById('patientSearch').value.toLowerCase();
  const statusFilter = document.getElementById('statusFilter').value;
  const priorityFilter = document.getElementById('priorityFilter').value;
  
  const filtered = patients.filter(patient => {
    const matchesSearch = patient.name.toLowerCase().includes(searchTerm) ||
                         patient.phone.includes(searchTerm) ||
                         (patient.reason && patient.reason.toLowerCase().includes(searchTerm));
    
    const matchesStatus = !statusFilter || patient.status === statusFilter;
    const matchesPriority = !priorityFilter || patient.priority === priorityFilter;
    
    return matchesSearch && matchesStatus && matchesPriority;
  });
  
  displayPatients(filtered);
}

// Mettre à jour les statistiques - Updated to use correct API
async function updateStats() {
  try {
    const response = await apiClient.makeRequest(`/api/admin/secretary/stats/${currentServiceId}`);
    if (response) {
      document.getElementById('totalPatients').textContent = response.total_patients || 0;
      document.getElementById('avgWaitTime').textContent = response.avg_wait_time || 0;
      document.getElementById('completedToday').textContent = response.completed_today || 0;
    }
  } catch (error) {
    console.error('Erreur lors de la mise à jour des statistiques:', error);
  }
}

// Mettre à jour le résumé de la file
function updateQueueSummary() {
  const waiting = queue.filter(p => p.status === 'waiting').length;
  const inConsultation = queue.filter(p => p.status === 'in_consultation').length;
  const completed = queue.filter(p => p.status === 'completed').length;
  
  document.getElementById('waitingCount').textContent = waiting;
  document.getElementById('inConsultationCount').textContent = inConsultation;
  document.getElementById('completedCount').textContent = completed;
}

// Actualiser la file d'attente
function refreshQueue() {
  loadQueue();
  showMessage('File d\'attente actualisée', 'success');
}

// Appeler le patient suivant - Updated to use backend queue management
async function callNextPatient() {
  try {
    const response = await apiClient.callNextPatient(currentServiceId);
    if (response) {
      showMessage('Patient suivant appelé avec succès', 'success');
      loadQueue();
      updateStats();
      playNotificationSound();
    }
  } catch (error) {
    console.error('Erreur lors de l\'appel du patient suivant:', error);
    if (error.message.includes('No patients')) {
      showMessage('Aucun patient en attente', 'info');
    } else {
      showMessage('Erreur lors de l\'appel du patient', 'error');
    }
  }
}

// Appeler un patient - Updated to use correct API
async function callPatient(patientId) {
  try {
    const response = await apiClient.makeRequest(`/api/admin/secretary/patients/${patientId}/call`, {
      method: 'POST'
    });
    
    if (response) {
      showMessage('Patient appelé avec succès', 'success');
      loadQueue();
      loadPatients();
      updateStats();
      playNotificationSound();
    }
  } catch (error) {
    console.error('Erreur lors de l\'appel du patient:', error);
    showMessage('Erreur lors de l\'appel du patient', 'error');
  }
}

// Terminer une consultation - Updated to use correct API
async function completeConsultation(patientId) {
  try {
    const response = await apiClient.makeRequest(`/api/admin/secretary/patients/${patientId}/complete`, {
      method: 'POST'
    });
    
    if (response) {
      showMessage('Consultation terminée', 'success');
      loadQueue();
      loadPatients();
      updateStats();
    }
  } catch (error) {
    console.error('Erreur lors de la finalisation:', error);
    showMessage('Erreur lors de la finalisation', 'error');
  }
}

// Ajouter un nouveau patient - Updated to use correct API
async function addPatient() {
  const form = document.getElementById('addPatientForm');
  
  const patientData = {
    name: document.getElementById('patientName').value,
    phone: document.getElementById('patientPhone').value,
    age: document.getElementById('patientAge').value || null,
    gender: document.getElementById('patientGender').value || null,
    reason: document.getElementById('patientReason').value,
    priority: document.getElementById('patientPriority').value,
    notes: document.getElementById('patientNotes').value || null,
    service_id: currentServiceId
  };
  
  try {
    const response = await apiClient.makeRequest('/api/admin/secretary/patients', {
      method: 'POST',
      body: JSON.stringify(patientData)
    });
    
    if (response) {
      showMessage('Patient ajouté avec succès', 'success');
      closeModal('addPatientModal');
      form.reset();
      loadPatients();
      loadQueue();
      updateStats();
    }
  } catch (error) {
    console.error('Erreur lors de l\'ajout du patient:', error);
    showMessage(error.message || 'Erreur lors de l\'ajout du patient', 'error');
  }
}

// Ajouter un patient urgent - Updated to use correct API
async function addEmergencyPatient() {
  const patientData = {
    name: document.getElementById('emergencyName').value,
    phone: document.getElementById('emergencyPhone').value,
    reason: document.getElementById('emergencyReason').value,
    notes: document.getElementById('emergencyNotes').value || null,
    priority: 'high', // Map emergency to high priority
    service_id: currentServiceId
  };
  
  try {
    const response = await apiClient.makeRequest('/api/admin/secretary/patients', {
      method: 'POST',
      body: JSON.stringify(patientData)
    });
    
    if (response) {
      showMessage('Patient urgent ajouté avec succès', 'success');
      closeModal('emergencyModal');
      document.getElementById('emergencyForm').reset();
      loadPatients();
      loadQueue();
      updateStats();
    }
  } catch (error) {
    console.error('Erreur lors de l\'ajout du patient urgent:', error);
    showMessage(error.message || 'Erreur lors de l\'ajout du patient urgent', 'error');
  }
}

// Ajouter un patient manuel (sans application) - Updated to use correct API
async function addManualPatient() {
  const arrivalTime = document.getElementById('manualArrival').value;
  const currentTime = new Date();
  
  // Si une heure d'arrivée est spécifiée, l'utiliser, sinon utiliser l'heure actuelle
  let estimatedArrival;
  if (arrivalTime) {
    const [hours, minutes] = arrivalTime.split(':');
    estimatedArrival = new Date(currentTime);
    estimatedArrival.setHours(parseInt(hours), parseInt(minutes), 0, 0);
  } else {
    estimatedArrival = currentTime;
  }
  
  const patientData = {
    name: document.getElementById('manualName').value,
    phone: document.getElementById('manualPhone').value,
    age: document.getElementById('manualAge').value || null,
    gender: document.getElementById('manualGender').value || null,
    reason: document.getElementById('manualReason').value,
    priority: document.getElementById('manualPriority').value,
    notes: document.getElementById('manualNotes').value || `Manuel - Arrivée: ${estimatedArrival.toLocaleTimeString()}`,
    service_id: currentServiceId,
    estimated_arrival: estimatedArrival.toISOString(),
    source: 'manual' // Indicate manual addition
  };
  
  try {
    const response = await apiClient.makeRequest('/api/admin/secretary/patients', {
      method: 'POST',
      body: JSON.stringify(patientData)
    });
    
    if (response) {
      showMessage('Patient ajouté manuellement avec succès', 'success');
      closeModal('manualPatientModal');
      document.getElementById('manualPatientForm').reset();
      loadPatients();
      loadQueue();
      updateStats();
    }
  } catch (error) {
    console.error('Erreur lors de l\'ajout du patient manuel:', error);
    showMessage(error.message || 'Erreur lors de l\'ajout du patient', 'error');
  }
}

// Sélectionner un patient
function selectPatient(patientId) {
  // Ici on peut ajouter une logique pour afficher les détails du patient
  console.log('Patient sélectionné:', patientId);
  // TODO: Implémenter l'affichage des détails du patient
}

// Afficher le modal d'ajout de patient
function showAddPatientModal() {
  document.getElementById('addPatientModal').style.display = 'flex';
}

// Afficher le modal d'urgence
function showEmergencyModal() {
  document.getElementById('emergencyModal').style.display = 'flex';
}

// Afficher le modal de patient manuel
function showManualPatientModal() {
  document.getElementById('manualPatientModal').style.display = 'flex';
  // Définir l'heure actuelle par défaut
  const now = new Date();
  const timeString = now.toTimeString().slice(0, 5);
  document.getElementById('manualArrival').value = timeString;
}

// Fermer un modal
function closeModal(modalId) {
  document.getElementById(modalId).style.display = 'none';
}

// Actions rapides (à implémenter)
function showBulkActions() {
  showMessage('Fonctionnalité en cours de développement', 'info');
}

function showReports() {
  window.location.href = '../reports/reports.html';
}

function showSettings() {
  showMessage('Fonctionnalité en cours de développement', 'info');
}

// Utilitaires
function calculateWaitTime(createdAt) {
  const created = new Date(createdAt);
  const now = new Date();
  const diffMs = now - created;
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 60) {
    return `${diffMins} min`;
  } else {
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `${hours}h ${mins}min`;
  }
}

function getStatusLabel(status) {
  const labels = {
    'waiting': 'En attente',
    'in_consultation': 'En consultation',
    'completed': 'Terminé'
  };
  return labels[status] || status;
}

function getPriorityLabel(priority) {
  const labels = {
    'low': 'Basse',
    'medium': 'Normale',
    'high': 'Haute',
    'emergency': 'Urgence'
  };
  return labels[priority] || priority;
}

function playNotificationSound() {
  // Créer un son de notification simple
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
  oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
  
  gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
  
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.2);
}

// Gestion de la déconnexion - Updated to use shared API
function handleLogout() {
  apiClient.logout();
  window.location.href = '../Acceuil/acceuil.html';
}

// Gestion des messages - Updated to use shared message manager
function showMessage(message, type = 'info') {
  if (window.MessageManager) {
    window.MessageManager.show(type, message, { duration: 3000 });
  } else {
    // Fallback
    alert(message);
  }
}

// Auto-refresh toutes les 30 secondes
setInterval(() => {
  if (isConnected) {
    loadQueue();
    updateStats();
  }
}, 30000); 