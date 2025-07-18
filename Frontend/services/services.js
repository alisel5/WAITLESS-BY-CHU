// Services data from backend
let services = [];
let currentFilter = 'all';

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

// Load services data from backend
async function loadServices() {
  try {
    APIUtils.showLoading(document.getElementById('servicesGrid'));
    
    const servicesData = await apiClient.getServices();
    if (servicesData) {
      services = servicesData;
      displayServices();
    }
  } catch (error) {
    console.error('Error loading services:', error);
    APIUtils.showError(document.getElementById('servicesGrid'), 'Erreur lors du chargement des services');
    APIUtils.showNotification('Erreur de connexion au serveur', 'error');
  }
}

// Fonction pour afficher les services
function displayServices() {
  const servicesGrid = document.getElementById('servicesGrid');
  
  if (!services || services.length === 0) {
    servicesGrid.innerHTML = '<p>Aucun service disponible</p>';
    return;
  }
  
  const filteredServices = filterServicesData(services);
  
  servicesGrid.innerHTML = filteredServices.map(service => `
    <div class="service-card" data-id="${service.id}">
      <div class="service-header">
        <div class="service-title">
          <h3>${service.name}</h3>
          <span class="service-priority ${service.priority}">
            ${getPriorityText(service.priority)} Priorité
          </span>
        </div>
        <div class="service-status ${service.status}">
          ${getStatusText(service.status)}
        </div>
      </div>
      
      <div class="service-info">
        <p><strong>📍 Localisation:</strong> ${service.location}</p>
        <p><strong>⏱️ Temps max:</strong> ${service.max_wait_time} minutes</p>
        <p><strong>👥 En attente:</strong> ${service.current_waiting} patients</p>
        <p><strong>📊 Temps moyen:</strong> ${APIUtils.formatWaitTime(service.avg_wait_time)}</p>
        <p><strong>📝 Description:</strong> ${service.description}</p>
      </div>
      
      <div class="service-actions">
        <button class="qr-btn" onclick="showServiceQR(${service.id}, '${service.name}')">🔳 QR Code</button>
        ${service.current_waiting > 0 ? 
          `<button class="call-btn" onclick="callNextPatient(${service.id}, '${service.name}')">📞 Appeler Suivant</button>` : 
          '<button class="call-btn disabled" disabled>📞 Aucun Patient</button>'
        }
        <button class="queue-btn" onclick="viewQueue(${service.id}, '${service.name}')">👥 Voir Queue</button>
        <button class="edit-btn" onclick="editService(${service.id})">Modifier</button>
        <button class="delete-btn" onclick="deleteService(${service.id})">Supprimer</button>
      </div>
    </div>
  `).join('');
}

// Filter services based on current filter
function filterServicesData(servicesArray) {
  return servicesArray.filter(service => {
    switch (currentFilter) {
      case 'active':
        return service.status === 'active';
      case 'emergency':
        return service.status === 'emergency';
      case 'high-priority':
        return service.priority === 'high';
      case 'all':
      default:
        return true;
    }
  });
}

// Helper functions
function getPriorityText(priority) {
  switch (priority) {
    case 'high': return 'Haute';
    case 'medium': return 'Moyenne';
    case 'low': return 'Basse';
    default: return priority;
  }
}

function getStatusText(status) {
  switch (status) {
    case 'active': return 'Actif';
    case 'inactive': return 'Inactif';
    case 'emergency': return 'Urgence';
    default: return status;
  }
}

// Fonction pour ouvrir le modal d'ajout
function openAddServiceModal() {
  document.getElementById('addServiceModal').style.display = 'flex';
  document.getElementById('addServiceForm').reset();
}

// Fonction pour fermer les modals
function closeModal() {
  document.getElementById('addServiceModal').style.display = 'none';
  document.getElementById('editServiceModal').style.display = 'none';
  
  // Clear any error messages
  const errorElements = document.querySelectorAll('.error');
  errorElements.forEach(element => {
    element.style.display = 'none';
  });
}

// Fonction pour éditer un service
function editService(serviceId) {
  const service = services.find(s => s.id === serviceId);
  if (!service) return;
  
  // Remplir le formulaire d'édition
  document.getElementById('editServiceId').value = service.id;
  document.getElementById('editServiceName').value = service.name;
  document.getElementById('editServiceLocation').value = service.location;
  document.getElementById('editMaxWaitTime').value = service.max_wait_time;
  document.getElementById('editServicePriority').value = service.priority;
  document.getElementById('editServiceStatus').value = service.status;
  document.getElementById('editServiceDescription').value = service.description;
  
  // Afficher le modal
  document.getElementById('editServiceModal').style.display = 'flex';
}

// Fonction pour supprimer un service
async function deleteService(serviceId) {
  if (!confirm('Êtes-vous sûr de vouloir supprimer ce service ?')) {
    return;
  }
  
  try {
    await apiClient.deleteService(serviceId);
    APIUtils.showNotification('Service supprimé avec succès', 'success');
    await loadServices(); // Reload services
  } catch (error) {
    console.error('Error deleting service:', error);
    APIUtils.showNotification('Erreur lors de la suppression du service', 'error');
  }
}

// Fonction pour ajouter un nouveau service
async function addService(formData) {
  try {
    const serviceData = {
      name: formData.get('serviceName'),
      description: formData.get('serviceDescription') || 'Aucune description',
      location: formData.get('serviceLocation'),
      max_wait_time: parseInt(formData.get('maxWaitTime')),
      priority: formData.get('servicePriority'),
      status: 'active' // Default to active
    };
    
    await apiClient.createService(serviceData);
    APIUtils.showNotification('Service ajouté avec succès', 'success');
    closeModal();
    await loadServices(); // Reload services
  } catch (error) {
    console.error('Error adding service:', error);
    APIUtils.showNotification('Erreur lors de l\'ajout du service', 'error');
  }
}

// Fonction pour modifier un service
async function updateService(formData) {
  try {
    const serviceId = parseInt(formData.get('editServiceId'));
    const serviceData = {
      name: formData.get('editServiceName'),
      description: formData.get('editServiceDescription'),
      location: formData.get('editServiceLocation'),
      max_wait_time: parseInt(formData.get('editMaxWaitTime')),
      priority: formData.get('editServicePriority'),
      status: formData.get('editServiceStatus')
    };
    
    await apiClient.updateService(serviceId, serviceData);
    APIUtils.showNotification('Service modifié avec succès', 'success');
    closeModal();
    await loadServices(); // Reload services
  } catch (error) {
    console.error('Error updating service:', error);
    APIUtils.showNotification('Erreur lors de la modification du service', 'error');
  }
}

// Fonction pour filtrer les services
function filterServices(filter) {
  currentFilter = filter;
  displayServices();
  
  // Update active filter button
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  document.querySelector(`[onclick="filterServices('${filter}')"]`).classList.add('active');
}

// Fonction pour exporter les données des services
function exportServicesData() {
  const data = {
    timestamp: new Date().toISOString(),
    services: services
  };
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `services-data-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// Queue Management Functions
async function callNextPatient(serviceId, serviceName) {
  if (!confirm(`Appeler le prochain patient pour ${serviceName} ?`)) {
    return;
  }
  
  try {
    const result = await apiClient.callNextPatient(serviceId);
    if (result) {
      let message = `Patient appelé pour ${serviceName}`;
      
      // Check if tickets were auto-completed
      if (result.auto_completed) {
        message += ' - Tous les tickets en consultation ont été automatiquement terminés';
        APIUtils.showNotification(message, 'warning');
      } else {
        APIUtils.showNotification(message, 'success');
      }
      
      // Refresh the services to update waiting count
      await loadServices();
    }
  } catch (error) {
    console.error('Error calling next patient:', error);
    APIUtils.showNotification('Erreur lors de l\'appel du patient', 'error');
  }
}

async function viewQueue(serviceId, serviceName) {
  try {
    const queueStatus = await apiClient.getQueueStatus(serviceId);
    showQueueModal(queueStatus, serviceName);
  } catch (error) {
    console.error('Error loading queue:', error);
    APIUtils.showNotification('Erreur lors du chargement de la queue', 'error');
  }
}

function showQueueModal(queueStatus, serviceName) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h2>Queue: ${serviceName}</h2>
        <button class="close-btn" onclick="this.closest('.modal-overlay').remove()">&times;</button>
      </div>
      <div class="modal-content">
        <div class="queue-stats">
          <p><strong>Total en attente:</strong> ${queueStatus.total_waiting}</p>
          <p><strong>Temps d'attente moyen:</strong> ${APIUtils.formatWaitTime(queueStatus.avg_wait_time)}</p>
        </div>
        <div class="queue-list">
          <h3>Patients en attente:</h3>
          ${queueStatus.queue && queueStatus.queue.length > 0 ? 
            queueStatus.queue.map(patient => `
              <div class="queue-item">
                <span class="position">${patient.position}</span>
                <span class="ticket">${patient.ticket_number}</span>
                <span class="wait-time">${APIUtils.formatWaitTime(patient.estimated_wait_time)}</span>
              </div>
            `).join('') : 
            '<p>Aucun patient en attente</p>'
          }
        </div>
      </div>
      <div class="modal-actions">
        <button class="secondary-btn" onclick="this.closest('.modal-overlay').remove()">Fermer</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  modal.style.display = 'flex';
  
  // Close on outside click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
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
  
  // Load initial services data
  await loadServices();
  
  // Gestionnaire pour le formulaire d'ajout
  const addForm = document.getElementById('addServiceForm');
  if (addForm) {
    addForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      await addService(formData);
    });
  }
  
  // Gestionnaire pour le formulaire d'édition
  const editForm = document.getElementById('editServiceForm');
  if (editForm) {
    editForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      await updateService(formData);
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
  
  console.log('Services page initialized for admin user');
});

// Show QR code for service
async function showServiceQR(serviceId, serviceName) {
  try {
    const qrResponse = await apiClient.getServiceQRCode(serviceId);
    if (qrResponse && qrResponse.qr_code) {
      // Create QR modal
      const modal = document.createElement('div');
      modal.className = 'modal-overlay';
      modal.innerHTML = `
        <div class="modal qr-modal">
          <span class="close-btn" onclick="this.parentElement.parentElement.remove()">&times;</span>
          <h2>🔳 QR Code - ${serviceName}</h2>
          <div class="qr-content">
            <img src="${qrResponse.qr_code}" alt="QR Code pour ${serviceName}" class="qr-image">
            <p><strong>Instructions:</strong></p>
            <ul>
              <li>Affichez ce QR code à l'entrée de votre service</li>
              <li>Les patients peuvent le scanner pour rejoindre la file</li>
              <li>Aucune inscription nécessaire pour les patients</li>
            </ul>
            <div class="qr-actions">
              <button onclick="printQRCode('${qrCodeUrl}', '${serviceName}')" class="print-btn">
                🖨️ Imprimer
              </button>
              <button onclick="downloadQRCode('${qrCodeUrl}', '${serviceName}')" class="download-btn">
                💾 Télécharger
              </button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    }
  } catch (error) {
    console.error('Error loading QR code:', error);
    APIUtils.showNotification('Erreur lors du chargement du QR code', 'error');
  }
}

// Print QR code
function printQRCode(qrCodeUrl, serviceName) {
  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <html>
      <head>
        <title>QR Code - ${serviceName}</title>
        <style>
          body { text-align: center; padding: 20px; font-family: Arial, sans-serif; }
          .qr-print { max-width: 400px; margin: 0 auto; }
          img { width: 300px; height: 300px; }
          h1 { color: #2c3e50; margin-bottom: 10px; }
          .instructions { text-align: left; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="qr-print">
          <h1>🏥 ${serviceName}</h1>
          <p><strong>Scannez pour rejoindre la file d'attente</strong></p>
          <img src="${qrCodeUrl}" alt="QR Code ${serviceName}">
          <div class="instructions">
            <h3>Instructions pour les patients:</h3>
            <ol>
              <li>Scannez ce QR code avec votre téléphone</li>
              <li>Entrez vos informations (nom, téléphone)</li>
              <li>Recevez votre numéro de ticket</li>
              <li>Suivez votre position en temps réel</li>
            </ol>
          </div>
        </div>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.print();
}

// Download QR code
function downloadQRCode(qrCodeUrl, serviceName) {
  const link = document.createElement('a');
  link.download = `qr-code-${serviceName.toLowerCase().replace(/\s/g, '-')}.png`;
  link.href = qrCodeUrl;
  link.click();
}

// Exposer les fonctions globalement
window.openAddServiceModal = openAddServiceModal;
window.closeModal = closeModal;
window.editService = editService;
window.deleteService = deleteService;
window.filterServices = filterServices;
window.exportServicesData = exportServicesData;
window.showServiceQR = showServiceQR;
window.printQRCode = printQRCode;
window.downloadQRCode = downloadQRCode;
window.handleLogout = handleLogout; 