// Données simulées pour les services
let services = [
  {
    id: 1,
    name: "Cardiologie",
    location: "Bâtiment A - 2ème étage",
    maxWaitTime: 30,
    priority: "high",
    status: "active",
    description: "Service de cardiologie pour les consultations et examens cardiaques",
    currentWaiting: 8,
    avgWaitTime: 25
  },
  {
    id: 2,
    name: "Dermatologie",
    location: "Bâtiment B - 1er étage",
    maxWaitTime: 20,
    priority: "medium",
    status: "active",
    description: "Consultations dermatologiques et traitements de la peau",
    currentWaiting: 12,
    avgWaitTime: 18
  },
  {
    id: 3,
    name: "Pédiatrie",
    location: "Bâtiment C - Rez-de-chaussée",
    maxWaitTime: 15,
    priority: "high",
    status: "active",
    description: "Soins pédiatriques et consultations enfants",
    currentWaiting: 5,
    avgWaitTime: 15
  },
  {
    id: 4,
    name: "Radiologie",
    location: "Bâtiment D - Sous-sol",
    maxWaitTime: 45,
    priority: "medium",
    status: "active",
    description: "Examens radiologiques et imagerie médicale",
    currentWaiting: 3,
    avgWaitTime: 30
  },
  {
    id: 5,
    name: "Urgences",
    location: "Bâtiment Principal - Rez-de-chaussée",
    maxWaitTime: 10,
    priority: "high",
    status: "emergency",
    description: "Service d'urgences médicales 24h/24",
    currentWaiting: 15,
    avgWaitTime: 8
  }
];

// Fonction pour afficher les services
function displayServices() {
  const servicesGrid = document.getElementById('servicesGrid');
  
  servicesGrid.innerHTML = services.map(service => `
    <div class="service-card" data-id="${service.id}">
      <div class="service-header">
        <div class="service-title">
          <h3>${service.name}</h3>
          <span class="service-priority ${service.priority}">
            ${service.priority === 'high' ? 'Haute' : service.priority === 'medium' ? 'Moyenne' : 'Basse'} Priorité
          </span>
        </div>
        <div class="service-status ${service.status}">
          ${service.status === 'active' ? 'Actif' : service.status === 'inactive' ? 'Inactif' : 'Urgence'}
        </div>
      </div>
      
      <div class="service-info">
        <p><strong>📍 Localisation:</strong> ${service.location}</p>
        <p><strong>⏱️ Temps max:</strong> ${service.maxWaitTime} minutes</p>
        <p><strong>👥 En attente:</strong> ${service.currentWaiting} patients</p>
        <p><strong>📊 Temps moyen:</strong> ${service.avgWaitTime} minutes</p>
        <p><strong>📝 Description:</strong> ${service.description}</p>
      </div>
      
      <div class="service-actions">
        <button class="edit-btn" onclick="editService(${service.id})">Modifier</button>
        <button class="delete-btn" onclick="deleteService(${service.id})">Supprimer</button>
      </div>
    </div>
  `).join('');
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
}

// Fonction pour éditer un service
function editService(serviceId) {
  const service = services.find(s => s.id === serviceId);
  if (!service) return;
  
  // Remplir le formulaire d'édition
  document.getElementById('editServiceId').value = service.id;
  document.getElementById('editServiceName').value = service.name;
  document.getElementById('editServiceLocation').value = service.location;
  document.getElementById('editMaxWaitTime').value = service.maxWaitTime;
  document.getElementById('editServicePriority').value = service.priority;
  document.getElementById('editServiceDescription').value = service.description;
  
  // Afficher le modal
  document.getElementById('editServiceModal').style.display = 'flex';
}

// Fonction pour supprimer un service
function deleteService(serviceId) {
  if (confirm('Êtes-vous sûr de vouloir supprimer ce service ?')) {
    services = services.filter(s => s.id !== serviceId);
    displayServices();
    showNotification('Service supprimé avec succès', 'success');
  }
}

// Fonction pour ajouter un nouveau service
function addService(formData) {
  const newService = {
    id: Date.now(),
    name: formData.get('serviceName'),
    location: formData.get('serviceLocation'),
    maxWaitTime: parseInt(formData.get('maxWaitTime')),
    priority: formData.get('servicePriority'),
    status: 'active',
    description: formData.get('serviceDescription') || 'Aucune description',
    currentWaiting: 0,
    avgWaitTime: 0
  };
  
  services.push(newService);
  displayServices();
  closeModal();
  showNotification('Service ajouté avec succès', 'success');
}

// Fonction pour modifier un service
function updateService(formData) {
  const serviceId = parseInt(formData.get('editServiceId'));
  const serviceIndex = services.findIndex(s => s.id === serviceId);
  
  if (serviceIndex === -1) return;
  
  services[serviceIndex] = {
    ...services[serviceIndex],
    name: formData.get('editServiceName'),
    location: formData.get('editServiceLocation'),
    maxWaitTime: parseInt(formData.get('editMaxWaitTime')),
    priority: formData.get('editServicePriority'),
    description: formData.get('editServiceDescription') || 'Aucune description'
  };
  
  displayServices();
  closeModal();
  showNotification('Service modifié avec succès', 'success');
}

// Fonction pour afficher des notifications
function showNotification(message, type = 'info') {
  // Créer une notification temporaire
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
  
  // Supprimer la notification après 3 secondes
  setTimeout(() => {
    notification.style.animation = 'slideOutRight 0.3s ease-out';
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 300);
  }, 3000);
}

// Fonction pour filtrer les services
function filterServices(filter) {
  const filteredServices = services.filter(service => {
    switch (filter) {
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
  
  displayFilteredServices(filteredServices);
}

// Fonction pour afficher les services filtrés
function displayFilteredServices(filteredServices) {
  const servicesGrid = document.getElementById('servicesGrid');
  
  servicesGrid.innerHTML = filteredServices.map(service => `
    <div class="service-card" data-id="${service.id}">
      <div class="service-header">
        <div class="service-title">
          <h3>${service.name}</h3>
          <span class="service-priority ${service.priority}">
            ${service.priority === 'high' ? 'Haute' : service.priority === 'medium' ? 'Moyenne' : 'Basse'} Priorité
          </span>
        </div>
        <div class="service-status ${service.status}">
          ${service.status === 'active' ? 'Actif' : service.status === 'inactive' ? 'Inactif' : 'Urgence'}
        </div>
      </div>
      
      <div class="service-info">
        <p><strong>📍 Localisation:</strong> ${service.location}</p>
        <p><strong>⏱️ Temps max:</strong> ${service.maxWaitTime} minutes</p>
        <p><strong>👥 En attente:</strong> ${service.currentWaiting} patients</p>
        <p><strong>📊 Temps moyen:</strong> ${service.avgWaitTime} minutes</p>
        <p><strong>📝 Description:</strong> ${service.description}</p>
      </div>
      
      <div class="service-actions">
        <button class="edit-btn" onclick="editService(${service.id})">Modifier</button>
        <button class="delete-btn" onclick="deleteService(${service.id})">Supprimer</button>
      </div>
    </div>
  `).join('');
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

// Gestionnaires d'événements
document.addEventListener('DOMContentLoaded', () => {
  displayServices();
  
  // Gestionnaire pour le formulaire d'ajout
  document.getElementById('addServiceForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    addService(formData);
  });
  
  // Gestionnaire pour le formulaire d'édition
  document.getElementById('editServiceForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    updateService(formData);
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
});

// Exposer les fonctions globalement
window.openAddServiceModal = openAddServiceModal;
window.closeModal = closeModal;
window.editService = editService;
window.deleteService = deleteService;
window.filterServices = filterServices;
window.exportServicesData = exportServicesData; 