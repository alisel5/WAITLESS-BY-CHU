// Variables globales
let currentDepartment = 'Cardiologie';
let currentSecretary = 'Secrétaire';
let currentServiceId = 1; // Default service ID for Cardiologie
let patients = [];
let queue = [];
let isConnected = false;

// Use shared API client
const API_BASE_URL = window.apiClient.baseURL;

// Authentication check
function checkAuthentication() {
  if (!window.apiClient.isAuthenticated()) {
    window.location.href = '../Acceuil/acceuil.html?login=true';
    return false;
  }
  
  // Check if user has staff/admin privileges
  if (!window.apiClient.canManageQueues()) {
    alert('Accès refusé. Vous devez avoir des privilèges de personnel.');
    window.location.href = '../Acceuil/acceuil.html';
    return false;
  }
  
  return true;
}

// Initialisation au chargement de la page
document.addEventListener('DOMContentLoaded', function() {
  console.log('Page secrétariat chargée');
  
  // Check authentication first
  if (!checkAuthentication()) {
    return;
  }
  
  initializeSecretaryPage();
  setupEventListeners();
  loadInitialData();
});

// Initialisation de la page
function initializeSecretaryPage() {
  // Récupérer les informations de l'utilisateur connecté
  const user = window.apiClient.getCurrentUser();
  if (user) {
    currentSecretary = user.full_name;
    document.getElementById('secretaryName').textContent = currentSecretary;
    
    // Set department based on assigned service
    if (user.assigned_service_id) {
      currentServiceId = user.assigned_service_id;
      // You could map service IDs to department names here
      loadServiceInfo(currentServiceId);
    }
  }
  
  // Initialiser les statistiques
  updateStats();
  
  // Charger les données initiales
  loadQueue();
  loadPatients();
}

// Load service information
async function loadServiceInfo(serviceId) {
  try {
    const service = await window.apiClient.getService(serviceId);
    if (service) {
      currentDepartment = service.name;
      document.getElementById('departmentName').textContent = currentDepartment;
    }
  } catch (error) {
    console.error('Erreur lors du chargement du service:', error);
  }
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

// Logout function
async function handleLogout() {
  try {
    await window.apiClient.logout();
    window.location.href = '../Acceuil/acceuil.html';
  } catch (error) {
    console.error('Erreur lors de la déconnexion:', error);
    // Force logout even if API call fails
    window.apiClient.removeToken();
    window.location.href = '../Acceuil/acceuil.html';
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

// Charger la file d'attente
async function loadQueue() {
  try {
    const queueStatus = await window.apiClient.getQueueStatus(currentServiceId);
    if (queueStatus) {
      // Transform the queue data to match expected format
      queue = queueStatus.queue.map((item, index) => ({
        id: index + 1,
        name: `Patient ${item.ticket_number}`,
        ticket_number: item.ticket_number,
        position: item.position,
        estimated_wait_time: item.estimated_wait_time,
        status: 'waiting',
        priority: 'medium',
        created_at: new Date().toISOString(),
        reason: 'Consultation'
      }));
      displayQueue();
      updateQueueSummary();
    }
  } catch (error) {
    console.error('Erreur lors du chargement de la file d\'attente:', error);
    // Fallback to mock data for testing
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

// Charger les patients
async function loadPatients() {
  try {
    const allPatients = await window.apiClient.getPatients();
    if (allPatients) {
      // Filter patients by current service/department
      patients = allPatients.filter(patient => 
        patient.assigned_service_id === currentServiceId || 
        patient.department === currentDepartment
      );
      displayPatients();
    }
  } catch (error) {
    console.error('Erreur lors du chargement des patients:', error);
    // Fallback to empty array
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

// Mettre à jour les statistiques
async function updateStats() {
  try {
    const stats = await window.apiClient.getQueueStatistics(currentServiceId);
    if (stats) {
      document.getElementById('totalPatients').textContent = queue.length || 0;
      document.getElementById('avgWaitTime').textContent = stats.avg_wait_time || 15;
      document.getElementById('completedToday').textContent = stats.completed_today || 0;
    } else {
      // Fallback to basic stats
      document.getElementById('totalPatients').textContent = queue.length || 0;
      document.getElementById('avgWaitTime').textContent = '15';
      document.getElementById('completedToday').textContent = '0';
    }
  } catch (error) {
    console.error('Erreur lors de la mise à jour des statistiques:', error);
    // Valeurs par défaut
    document.getElementById('totalPatients').textContent = queue.length || 0;
    document.getElementById('avgWaitTime').textContent = '15';
    document.getElementById('completedToday').textContent = '0';
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

// Appeler le patient suivant
async function callNextPatient() {
  const waitingPatients = queue.filter(p => p.status === 'waiting');
  if (waitingPatients.length === 0) {
    showMessage('Aucun patient en attente', 'info');
    return;
  }
  
  // Priorité aux urgences
  const nextPatient = waitingPatients.sort((a, b) => {
    const priorityOrder = { emergency: 0, high: 1, medium: 2, low: 3 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  })[0];
  
  await callPatient(nextPatient.id);
}

// Appeler un patient
async function callPatient(patientId) {
  try {
    const result = await window.apiClient.callNextPatient(currentServiceId);
    if (result) {
      showMessage('Patient appelé avec succès', 'success');
      loadQueue();
      updateStats();
      
      // Notification sonore (optionnel)
      playNotificationSound();
    }
  } catch (error) {
    console.error('Erreur lors de l\'appel du patient:', error);
    showMessage('Erreur lors de l\'appel du patient: ' + (error.message || 'Erreur réseau'), 'error');
  }
}

// Terminer une consultation
async function completeConsultation(ticketId) {
  try {
    const result = await window.apiClient.completeConsultation(ticketId);
    if (result) {
      showMessage('Consultation terminée', 'success');
      loadQueue();
      loadPatients();
      updateStats();
    }
  } catch (error) {
    console.error('Erreur lors de la finalisation:', error);
    showMessage('Erreur lors de la finalisation: ' + (error.message || 'Erreur réseau'), 'error');
  }
}

// Ajouter un nouveau patient
async function addPatient() {
  const form = document.getElementById('addPatientForm');
  const formData = new FormData(form);
  
  const patientData = {
    name: document.getElementById('patientName').value,
    phone: document.getElementById('patientPhone').value,
    age: document.getElementById('patientAge').value || null,
    gender: document.getElementById('patientGender').value || null,
    reason: document.getElementById('patientReason').value,
    priority: document.getElementById('patientPriority').value,
    notes: document.getElementById('patientNotes').value || null,
    department: currentDepartment
  };
  
  try {
    const newPatient = await window.apiClient.createPatient(patientData);
    if (newPatient) {
      showMessage('Patient ajouté avec succès', 'success');
      closeModal('addPatientModal');
      form.reset();
      loadPatients();
      loadQueue();
      updateStats();
    }
  } catch (error) {
    console.error('Erreur lors de l\'ajout du patient:', error);
    showMessage('Erreur lors de l\'ajout du patient: ' + (error.message || 'Erreur réseau'), 'error');
  }
}

// Ajouter un patient urgent
async function addEmergencyPatient() {
  const patientData = {
    name: document.getElementById('emergencyName').value,
    phone: document.getElementById('emergencyPhone').value,
    reason: document.getElementById('emergencyReason').value,
    notes: document.getElementById('emergencyNotes').value || null,
    priority: 'emergency',
    department: currentDepartment
  };
  
  try {
    const newPatient = await window.apiClient.createPatient(patientData);
    if (newPatient) {
      showMessage('Patient urgent ajouté avec succès', 'success');
      closeModal('emergencyModal');
      document.getElementById('emergencyForm').reset();
      loadPatients();
      loadQueue();
      updateStats();
    }
  } catch (error) {
    console.error('Erreur lors de l\'ajout du patient urgent:', error);
    showMessage('Erreur lors de l\'ajout du patient urgent: ' + (error.message || 'Erreur réseau'), 'error');
  }
}

// Ajouter un patient manuel (sans application)
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
    notes: document.getElementById('manualNotes').value || null,
    department: currentDepartment,
    estimated_arrival: estimatedArrival.toISOString(),
    source: 'manual' // Indique que le patient a été ajouté manuellement
  };
  
  try {
    const response = await fetch(`${API_BASE_URL}/patients`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(patientData)
    });
    
    if (response.ok) {
      const newPatient = await response.json();
      showMessage('Patient ajouté manuellement avec succès', 'success');
      closeModal('manualPatientModal');
      document.getElementById('manualPatientForm').reset();
      loadPatients();
      loadQueue();
      updateStats();
    } else {
      const error = await response.json();
      showMessage(error.detail || 'Erreur lors de l\'ajout du patient', 'error');
    }
  } catch (error) {
    console.error('Erreur lors de l\'ajout du patient manuel:', error);
    showMessage('Erreur réseau', 'error');
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

// Gestion de la déconnexion
function handleLogout() {
  localStorage.removeItem('userInfo');
  localStorage.removeItem('token');
  window.location.href = '../Acceuil/acceuil.html';
}

// Gestion des messages
function showMessage(message, type = 'info') {
  if (typeof showNotification === 'function') {
    showNotification(message, type);
  } else {
    // Fallback simple
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