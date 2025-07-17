// Données simulées pour les rapports
let reportData = {
  patients: 1247,
  waitTime: 23,
  satisfaction: 4.2,
  efficiency: 87,
  services: [
    { name: 'Cardiologie', patients: 156, waitTime: 28, satisfaction: 4.5, trend: 8 },
    { name: 'Dermatologie', patients: 142, waitTime: 18, satisfaction: 4.2, trend: 5 },
    { name: 'Neurologie', patients: 98, waitTime: 35, satisfaction: 4.1, trend: -2 },
    { name: 'Pédiatrie', patients: 87, waitTime: 22, satisfaction: 4.6, trend: 12 },
    { name: 'Orthopédie', patients: 76, waitTime: 32, satisfaction: 4.0, trend: 0 }
  ]
};

// Initialisation de la page
document.addEventListener('DOMContentLoaded', function() {
  initializeReports();
  setupEventListeners();
  animateStats();
});

// Initialisation des rapports
function initializeReports() {
  updateStats();
  updateCharts();
  setupFilters();
}

// Configuration des écouteurs d'événements
function setupEventListeners() {
  // Filtres
  document.getElementById('period').addEventListener('change', filterData);
  document.getElementById('service').addEventListener('change', filterData);
  
  // Boutons d'action
  document.querySelector('.generate-btn').addEventListener('click', generateReport);
  
  // Animations au scroll
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  };
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
      }
    });
  }, observerOptions);
  
  document.querySelectorAll('.stat-card, .chart-container, .table-container').forEach(el => {
    observer.observe(el);
  });
}

// Mise à jour des statistiques
function updateStats() {
  const statNumbers = document.querySelectorAll('.stat-number');
  
  statNumbers.forEach((stat, index) => {
    const finalValue = [reportData.patients, reportData.waitTime, reportData.satisfaction, reportData.efficiency][index];
    animateNumber(stat, 0, finalValue, index === 1 ? 'min' : index === 2 ? '/5' : index === 3 ? '%' : '');
  });
}

// Animation des nombres
function animateNumber(element, start, end, suffix = '') {
  const duration = 2000;
  const startTime = performance.now();
  
  function updateNumber(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    const current = Math.floor(start + (end - start) * progress);
    element.textContent = current + suffix;
    
    if (progress < 1) {
      requestAnimationFrame(updateNumber);
    }
  }
  
  requestAnimationFrame(updateNumber);
}

// Animation des statistiques
function animateStats() {
  const statCards = document.querySelectorAll('.stat-card');
  
  statCards.forEach((card, index) => {
    setTimeout(() => {
      card.style.opacity = '0';
      card.style.transform = 'translateY(30px)';
      
      setTimeout(() => {
        card.style.transition = 'all 0.6s ease-out';
        card.style.opacity = '1';
        card.style.transform = 'translateY(0)';
      }, 100);
    }, index * 200);
  });
}

// Mise à jour des graphiques
function updateCharts() {
  // Animation des barres du graphique
  const dataPoints = document.querySelectorAll('.data-point');
  
  dataPoints.forEach((point, index) => {
    setTimeout(() => {
      point.style.height = point.style.height;
      point.style.opacity = '1';
    }, index * 100);
  });
  
  // Animation du graphique circulaire
  const pieSegments = document.querySelectorAll('.pie-segment');
  pieSegments.forEach((segment, index) => {
    setTimeout(() => {
      segment.style.opacity = '1';
    }, index * 200);
  });
}

// Configuration des filtres
function setupFilters() {
  const periodSelect = document.getElementById('period');
  const serviceSelect = document.getElementById('service');
  
  // Données par période
  const periodData = {
    today: { patients: 45, waitTime: 18, satisfaction: 4.3, efficiency: 92 },
    week: { patients: 312, waitTime: 21, satisfaction: 4.1, efficiency: 89 },
    month: { patients: 1247, waitTime: 23, satisfaction: 4.2, efficiency: 87 },
    quarter: { patients: 3847, waitTime: 25, satisfaction: 4.0, efficiency: 85 },
    year: { patients: 15420, waitTime: 27, satisfaction: 3.9, efficiency: 82 }
  };
  
  // Données par service
  const serviceData = {
    all: reportData,
    cardiology: { patients: 156, waitTime: 28, satisfaction: 4.5, efficiency: 85 },
    dermatology: { patients: 142, waitTime: 18, satisfaction: 4.2, efficiency: 92 },
    neurology: { patients: 98, waitTime: 35, satisfaction: 4.1, efficiency: 78 },
    pediatrics: { patients: 87, waitTime: 22, satisfaction: 4.6, efficiency: 95 }
  };
  
  // Stockage des données pour utilisation dans les filtres
  window.periodData = periodData;
  window.serviceData = serviceData;
}

// Filtrage des données
function filterData() {
  const period = document.getElementById('period').value;
  const service = document.getElementById('service').value;
  
  let filteredData;
  
  if (service === 'all') {
    filteredData = window.periodData[period];
  } else {
    filteredData = window.serviceData[service];
  }
  
  // Mise à jour des statistiques avec les données filtrées
  updateStatsWithData(filteredData);
  
  // Animation de mise à jour
  animateStatsUpdate();
}

// Mise à jour des statistiques avec nouvelles données
function updateStatsWithData(data) {
  const statNumbers = document.querySelectorAll('.stat-number');
  const statChanges = document.querySelectorAll('.stat-change');
  
  // Mise à jour des nombres
  statNumbers[0].textContent = data.patients.toLocaleString();
  statNumbers[1].textContent = data.waitTime + ' min';
  statNumbers[2].textContent = data.satisfaction + '/5';
  statNumbers[3].textContent = data.efficiency + '%';
  
  // Mise à jour des tendances (simulation)
  const trends = [
    { value: '+12.5%', class: 'positive' },
    { value: '+2.1 min', class: 'negative' },
    { value: '+0.3', class: 'positive' },
    { value: '+5%', class: 'positive' }
  ];
  
  statChanges.forEach((change, index) => {
    change.textContent = trends[index].value + ' vs mois dernier';
    change.className = 'stat-change ' + trends[index].class;
  });
}

// Animation de mise à jour des statistiques
function animateStatsUpdate() {
  const statCards = document.querySelectorAll('.stat-card');
  
  statCards.forEach(card => {
    card.style.transform = 'scale(1.05)';
    card.style.boxShadow = '0 15px 40px rgba(0, 0, 0, 0.2)';
    
    setTimeout(() => {
      card.style.transform = 'scale(1)';
      card.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.1)';
    }, 300);
  });
}

// Génération de rapport
function generateReport() {
  const generateBtn = document.querySelector('.generate-btn');
  const originalText = generateBtn.innerHTML;
  
  // Animation du bouton
  generateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Génération...';
  generateBtn.disabled = true;
  
  // Simulation de génération
  setTimeout(() => {
    generateBtn.innerHTML = '<i class="fas fa-check"></i> Rapport généré !';
    generateBtn.style.background = '#28a745';
    
    // Notification de succès
    showNotification('Rapport généré avec succès !', 'success');
    
    setTimeout(() => {
      generateBtn.innerHTML = originalText;
      generateBtn.style.background = '#4A90E2';
      generateBtn.disabled = false;
    }, 2000);
  }, 2000);
}

// Export de rapport
function exportReport() {
  showNotification('Export en cours...', 'info');
  
  setTimeout(() => {
    // Simulation d'export
    const link = document.createElement('a');
    link.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(generateCSV());
    link.download = 'rapport_waitless_' + new Date().toISOString().split('T')[0] + '.csv';
    link.click();
    
    showNotification('Rapport exporté avec succès !', 'success');
  }, 1500);
}

// Programmation de rapport
function scheduleReport() {
  showNotification('Fonctionnalité de programmation à venir...', 'info');
}

// Partage de rapport
function shareReport() {
  if (navigator.share) {
    navigator.share({
      title: 'Rapport WaitLess',
      text: 'Rapport de performance des files d\'attente',
      url: window.location.href
    });
  } else {
    // Fallback pour les navigateurs qui ne supportent pas l'API Share
    navigator.clipboard.writeText(window.location.href);
    showNotification('Lien copié dans le presse-papiers !', 'success');
  }
}

// Génération de CSV pour export
function generateCSV() {
  const headers = ['Service', 'Patients', 'Temps moyen (min)', 'Satisfaction', 'Tendance'];
  const rows = reportData.services.map(service => [
    service.name,
    service.patients,
    service.waitTime,
    service.satisfaction,
    service.trend + '%'
  ]);
  
  return [headers, ...rows].map(row => row.join(',')).join('\n');
}

// Système de notifications
function showNotification(message, type = 'info') {
  // Supprimer les notifications existantes
  const existingNotifications = document.querySelectorAll('.notification');
  existingNotifications.forEach(notification => notification.remove());
  
  // Créer la nouvelle notification
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.innerHTML = `
    <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
    <span>${message}</span>
  `;
  
  // Styles de la notification
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#4A90E2'};
    color: white;
    padding: 1rem 1.5rem;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 10000;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 500;
    transform: translateX(100%);
    transition: transform 0.3s ease;
  `;
  
  document.body.appendChild(notification);
  
  // Animation d'entrée
  setTimeout(() => {
    notification.style.transform = 'translateX(0)';
  }, 100);
  
  // Auto-suppression
  setTimeout(() => {
    notification.style.transform = 'translateX(100%)';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 300);
  }, 4000);
}

// Mise à jour en temps réel (simulation)
function startRealTimeUpdates() {
  setInterval(() => {
    // Mise à jour aléatoire des données
    reportData.patients += Math.floor(Math.random() * 3);
    reportData.waitTime = Math.max(15, Math.min(40, reportData.waitTime + (Math.random() - 0.5) * 2));
    reportData.satisfaction = Math.max(3.5, Math.min(5, reportData.satisfaction + (Math.random() - 0.5) * 0.1));
    reportData.efficiency = Math.max(75, Math.min(95, reportData.efficiency + (Math.random() - 0.5) * 2));
    
    // Mise à jour de l'affichage si les filtres ne sont pas actifs
    if (document.getElementById('period').value === 'month' && document.getElementById('service').value === 'all') {
      updateStatsWithData(reportData);
    }
  }, 30000); // Mise à jour toutes les 30 secondes
}

// Démarrer les mises à jour en temps réel
startRealTimeUpdates();

// Gestion des erreurs
window.addEventListener('error', function(e) {
  console.error('Erreur JavaScript:', e.error);
  showNotification('Une erreur est survenue. Veuillez rafraîchir la page.', 'error');
});

// Optimisation des performances
function optimizePerformance() {
  // Lazy loading des images
  const images = document.querySelectorAll('img[data-src]');
  const imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        img.src = img.dataset.src;
        img.classList.remove('lazy');
        observer.unobserve(img);
      }
    });
  });
  
  images.forEach(img => imageObserver.observe(img));
}

// Initialiser l'optimisation des performances
optimizePerformance(); 