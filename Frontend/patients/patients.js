// Données simulées pour les patients
let patients = [
  {
    id: "P001",
    firstName: "Ahmed",
    lastName: "Benali",
    age: 45,
    phone: "0612345678",
    service: "Cardiologie",
    status: "waiting",
    priority: "high",
    arrivalTime: "09:15",
    waitTime: "25 min",
    notes: "Patient avec antécédents cardiaques"
  },
  {
    id: "P002",
    firstName: "Fatima",
    lastName: "El Mansouri",
    age: 32,
    phone: "0623456789",
    service: "Dermatologie",
    status: "consulting",
    priority: "medium",
    arrivalTime: "08:30",
    waitTime: "45 min",
    notes: "Consultation de routine"
  },
  {
    id: "P003",
    firstName: "Mohammed",
    lastName: "Tazi",
    age: 28,
    phone: "0634567890",
    service: "Pédiatrie",
    status: "waiting",
    priority: "high",
    arrivalTime: "10:00",
    waitTime: "15 min",
    notes: "Enfant de 5 ans, fièvre"
  },
  {
    id: "P004",
    firstName: "Amina",
    lastName: "Bouazza",
    age: 67,
    phone: "0645678901",
    service: "Radiologie",
    status: "waiting",
    priority: "medium",
    arrivalTime: "09:45",
    waitTime: "30 min",
    notes: "Radiographie thoracique"
  },
  {
    id: "P005",
    firstName: "Karim",
    lastName: "Lahlou",
    age: 23,
    phone: "0656789012",
    service: "Urgences",
    status: "consulting",
    priority: "high",
    arrivalTime: "11:00",
    waitTime: "5 min",
    notes: "Accident de la route"
  },
  {
    id: "P006",
    firstName: "Sara",
    lastName: "El Fassi",
    age: 41,
    phone: "0667890123",
    service: "Cardiologie",
    status: "completed",
    priority: "medium",
    arrivalTime: "08:00",
    waitTime: "0 min",
    notes: "Consultation terminée"
  }
];

let currentFilter = 'all';
let searchTerm = '';

// Fonction pour afficher les patients
function displayPatients() {
  const tbody = document.getElementById('patientsTableBody');
  
  const filteredPatients = patients.filter(patient => {
    const matchesFilter = currentFilter === 'all' || patient.status === currentFilter;
    const matchesSearch = searchTerm === '' || 
      patient.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      patient.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      patient.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      patient.service.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesFilter && matchesSearch;
  });
  
  tbody.innerHTML = filteredPatients.map(patient => `
    <tr data-id="${patient.id}">
      <td class="patient-id">${patient.id}</td>
      <td class="patient-name">${patient.firstName} ${patient.lastName}</td>
      <td>${patient.service}</td>
      <td>
        <span class="status-badge status-${patient.status}">
          ${getStatusText(patient.status)}
        </span>
      </td>
      <td class="arrival-time">${patient.arrivalTime}</td>
      <td class="wait-time">${patient.waitTime}</td>
      <td>
        <span class="priority-badge priority-${patient.priority}">
          ${getPriorityText(patient.priority)}
        </span>
      </td>
      <td>
        <div class="action-buttons">
          <button class="action-btn edit-action-btn" onclick="editPatient('${patient.id}')" title="Modifier">
            ✏️
          </button>
          <button class="action-btn delete-action-btn" onclick="deletePatient('${patient.id}')" title="Supprimer">
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
    default: return status;
  }
}

// Fonction pour obtenir le texte de la priorité
function getPriorityText(priority) {
  switch (priority) {
    case 'high': return 'Haute';
    case 'medium': return 'Moyenne';
    case 'low': return 'Basse';
    default: return priority;
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
}

// Fonction pour fermer les modals
function closeModal() {
  document.getElementById('addPatientModal').style.display = 'none';
  document.getElementById('editPatientModal').style.display = 'none';
}

// Fonction pour éditer un patient
function editPatient(patientId) {
  const patient = patients.find(p => p.id === patientId);
  if (!patient) return;
  
  // Remplir le formulaire d'édition
  document.getElementById('editPatientId').value = patient.id;
  document.getElementById('editPatientFirstName').value = patient.firstName;
  document.getElementById('editPatientLastName').value = patient.lastName;
  document.getElementById('editPatientAge').value = patient.age;
  document.getElementById('editPatientPhone').value = patient.phone;
  document.getElementById('editPatientService').value = patient.service;
  document.getElementById('editPatientStatus').value = patient.status;
  document.getElementById('editPatientPriority').value = patient.priority;
  document.getElementById('editPatientNotes').value = patient.notes || '';
  
  // Afficher le modal
  document.getElementById('editPatientModal').style.display = 'flex';
}

// Fonction pour supprimer un patient
function deletePatient(patientId) {
  if (confirm('Êtes-vous sûr de vouloir supprimer ce patient ?')) {
    patients = patients.filter(p => p.id !== patientId);
    displayPatients();
    showNotification('Patient supprimé avec succès', 'success');
  }
}

// Fonction pour ajouter un nouveau patient
function addPatient(formData) {
  const newPatient = {
    id: generatePatientId(),
    firstName: formData.get('patientFirstName'),
    lastName: formData.get('patientLastName'),
    age: parseInt(formData.get('patientAge')),
    phone: formData.get('patientPhone'),
    service: formData.get('patientService'),
    status: 'waiting',
    priority: formData.get('patientPriority'),
    arrivalTime: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    waitTime: '0 min',
    notes: formData.get('patientNotes') || ''
  };
  
  patients.push(newPatient);
  displayPatients();
  closeModal();
  showNotification('Patient ajouté avec succès', 'success');
}

// Fonction pour modifier un patient
function updatePatient(formData) {
  const patientId = formData.get('editPatientId');
  const patientIndex = patients.findIndex(p => p.id === patientId);
  
  if (patientIndex === -1) return;
  
  patients[patientIndex] = {
    ...patients[patientIndex],
    firstName: formData.get('editPatientFirstName'),
    lastName: formData.get('editPatientLastName'),
    age: parseInt(formData.get('editPatientAge')),
    phone: formData.get('editPatientPhone'),
    service: formData.get('editPatientService'),
    status: formData.get('editPatientStatus'),
    priority: formData.get('editPatientPriority'),
    notes: formData.get('editPatientNotes') || ''
  };
  
  // Mettre à jour le temps d'attente si le statut a changé
  if (patients[patientIndex].status === 'completed') {
    patients[patientIndex].waitTime = '0 min';
  }
  
  displayPatients();
  closeModal();
  showNotification('Patient modifié avec succès', 'success');
}

// Fonction pour générer un ID de patient
function generatePatientId() {
  const lastPatient = patients[patients.length - 1];
  if (!lastPatient) return 'P001';
  
  const lastNumber = parseInt(lastPatient.id.substring(1));
  return `P${String(lastNumber + 1).padStart(3, '0')}`;
}

// Fonction pour afficher des notifications
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 1rem 2rem;
    border-radius: 8px;
    color: white;
    font-weight: 600;
    z-index: 10000;
    animation: slideInRight 0.3s ease-out;
    background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#4A90E2'};
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.animation = 'slideOutRight 0.3s ease-out';
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 300);
  }, 3000);
}

// Fonction pour exporter les données des patients
function exportPatientsData() {
  const data = {
    timestamp: new Date().toISOString(),
    patients: patients,
    filters: {
      currentFilter,
      searchTerm
    }
  };
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `patients-data-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  
  showNotification('Données exportées avec succès', 'success');
}

// Fonction pour mettre à jour les temps d'attente
function updateWaitTimes() {
  const now = new Date();
  
  patients.forEach(patient => {
    if (patient.status === 'waiting') {
      const arrivalTime = new Date();
      arrivalTime.setHours(...patient.arrivalTime.split(':'));
      
      const diffMinutes = Math.floor((now - arrivalTime) / (1000 * 60));
      patient.waitTime = `${Math.max(0, diffMinutes)} min`;
    }
  });
  
  displayPatients();
}

// Fonction pour obtenir des statistiques sur les patients
function getPatientStats() {
  const stats = {
    total: patients.length,
    waiting: patients.filter(p => p.status === 'waiting').length,
    consulting: patients.filter(p => p.status === 'consulting').length,
    completed: patients.filter(p => p.status === 'completed').length,
    highPriority: patients.filter(p => p.priority === 'high').length,
    avgWaitTime: 0
  };
  
  const waitingPatients = patients.filter(p => p.status === 'waiting');
  if (waitingPatients.length > 0) {
    const totalWaitTime = waitingPatients.reduce((sum, p) => {
      const waitMinutes = parseInt(p.waitTime);
      return sum + (isNaN(waitMinutes) ? 0 : waitMinutes);
    }, 0);
    stats.avgWaitTime = Math.round(totalWaitTime / waitingPatients.length);
  }
  
  return stats;
}

// Gestionnaires d'événements
document.addEventListener('DOMContentLoaded', () => {
  displayPatients();
  
  // Gestionnaire pour le formulaire d'ajout
  document.getElementById('addPatientForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    addPatient(formData);
  });
  
  // Gestionnaire pour le formulaire d'édition
  document.getElementById('editPatientForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    updatePatient(formData);
  });
  
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
  
  // Simuler des changements de statut aléatoires
  setInterval(() => {
    const waitingPatients = patients.filter(p => p.status === 'waiting');
    if (waitingPatients.length > 0) {
      const randomPatient = waitingPatients[Math.floor(Math.random() * waitingPatients.length)];
      const randomStatus = Math.random() > 0.7 ? 'consulting' : 'waiting';
      
      if (randomStatus === 'consulting') {
        randomPatient.status = 'consulting';
        showNotification(`${randomPatient.firstName} ${randomPatient.lastName} est maintenant en consultation`, 'info');
      }
    }
    
    const consultingPatients = patients.filter(p => p.status === 'consulting');
    if (consultingPatients.length > 0) {
      const randomPatient = consultingPatients[Math.floor(Math.random() * consultingPatients.length)];
      if (Math.random() > 0.8) {
        randomPatient.status = 'completed';
        randomPatient.waitTime = '0 min';
        showNotification(`Consultation terminée pour ${randomPatient.firstName} ${randomPatient.lastName}`, 'success');
      }
    }
    
    displayPatients();
  }, 30000);
});

// Exposer les fonctions globalement
window.openAddPatientModal = openAddPatientModal;
window.closeModal = closeModal;
window.editPatient = editPatient;
window.deletePatient = deletePatient;
window.filterPatients = filterPatients;
window.searchPatients = searchPatients;
window.exportPatientsData = exportPatientsData; 