// Reports data from backend
let reportData = {
  dashboard_stats: null,
  services: [],
  daily_reports: null
};

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

// Load reports data from backend
async function loadReportsData() {
  try {
    APIUtils.showLoading(document.querySelector('.stats-grid'));
    
    // Load dashboard statistics
    const dashboardStats = await apiClient.getDashboardStats();
    if (dashboardStats) {
      reportData.dashboard_stats = dashboardStats;
      reportData.services = dashboardStats.services || [];
    }
    
    // Load daily reports
    const dailyReports = await apiClient.getDailyReports();
    if (dailyReports) {
      reportData.daily_reports = dailyReports;
    }
    
    // Update all displays
    updateStats();
    updateCharts();
    updateServicesTable();
    
  } catch (error) {
    console.error('Error loading reports data:', error);
    APIUtils.showError(document.querySelector('.stats-grid'), 'Erreur lors du chargement des données');
    APIUtils.showNotification('Erreur de connexion au serveur', 'error');
  }
}

// Initialisation de la page
document.addEventListener('DOMContentLoaded', async function() {
  // Check authentication and authorization
  if (!checkAdminAuth()) {
    return;
  }
  
  await initializeReports();
  setupEventListeners();
  animateStats();
});

// Initialisation des rapports
async function initializeReports() {
  await loadReportsData();
  setupFilters();
}

// Configuration des écouteurs d'événements
function setupEventListeners() {
  // Filtres
  const periodSelect = document.getElementById('period');
  const serviceSelect = document.getElementById('service');
  
  if (periodSelect) {
    periodSelect.addEventListener('change', filterData);
  }
  
  if (serviceSelect) {
    serviceSelect.addEventListener('change', filterData);
  }
  
  // Boutons d'action
  const generateBtn = document.querySelector('.generate-btn');
  if (generateBtn) {
    generateBtn.addEventListener('click', generateReport);
  }
  
  const exportBtn = document.querySelector('.export-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', exportReports);
  }
  
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

// Setup filters with real services data
function setupFilters() {
  const serviceSelect = document.getElementById('service');
  if (serviceSelect && reportData.services.length > 0) {
    serviceSelect.innerHTML = '<option value="">Tous les services</option>';
    reportData.services.forEach(service => {
      serviceSelect.innerHTML += `<option value="${service.id}">${service.name}</option>`;
    });
  }
}

// Mise à jour des statistiques
function updateStats() {
  if (!reportData.dashboard_stats) {
    return;
  }
  
  const stats = reportData.dashboard_stats;
  
  // Update main statistics
  const totalPatientsEl = document.querySelector('[data-stat="patients"] .stat-number');
  const avgWaitTimeEl = document.querySelector('[data-stat="waitTime"] .stat-number');
  const activeServicesEl = document.querySelector('[data-stat="services"] .stat-number');
  const efficiencyEl = document.querySelector('[data-stat="efficiency"] .stat-number');
  
  if (totalPatientsEl) {
    animateNumber(totalPatientsEl, 0, stats.total_waiting + stats.total_consulting);
  }
  
  if (avgWaitTimeEl) {
    animateNumber(avgWaitTimeEl, 0, stats.avg_wait_time, ' min');
  }
  
  if (activeServicesEl) {
    animateNumber(activeServicesEl, 0, stats.active_services);
  }
  
  if (efficiencyEl) {
    // Calculate efficiency as percentage (mock calculation)
    const efficiency = Math.min(100, Math.max(0, 100 - (stats.avg_wait_time / 60) * 100));
    animateNumber(efficiencyEl, 0, Math.round(efficiency), '%');
  }
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

// Update charts with real data
function updateCharts() {
  if (!reportData.services || reportData.services.length === 0) {
    return;
  }
  
  // Update services performance chart
  updateServicesChart();
  
  // Update wait time trends (mock for now)
  updateWaitTimeTrends();
}

// Update services chart
function updateServicesChart() {
  const chartContainer = document.querySelector('.chart-container');
  if (!chartContainer) return;
  
  // Simple bar chart representation
  const chartData = reportData.services.map(service => ({
    name: service.name,
    waiting: service.current_waiting,
    avgTime: service.avg_wait_time
  }));
  
  const chart = chartContainer.querySelector('.chart');
  if (chart) {
    chart.innerHTML = chartData.map(service => `
      <div class="chart-bar">
        <div class="bar-label">${service.name}</div>
        <div class="bar-container">
          <div class="bar" style="height: ${Math.min(100, service.waiting * 10)}px; background: #4A90E2;">
            <span class="bar-value">${service.waiting}</span>
          </div>
        </div>
      </div>
    `).join('');
  }
}

// Update wait time trends (placeholder)
function updateWaitTimeTrends() {
  // This would be implemented with real historical data from backend
  console.log('Wait time trends would be updated here with historical data');
}

// Update services table
function updateServicesTable() {
  const servicesTable = document.querySelector('.services-table tbody');
  if (!servicesTable || !reportData.services) return;
  
  servicesTable.innerHTML = reportData.services.map(service => {
    // Calculate trend (mock for now)
    const trend = service.current_waiting > 5 ? '+5%' : service.current_waiting > 2 ? '0%' : '-3%';
    const trendClass = service.current_waiting > 5 ? 'positive' : service.current_waiting > 2 ? 'neutral' : 'negative';
    
    return `
      <tr>
        <td>${service.name}</td>
        <td>${service.current_waiting}</td>
        <td>${APIUtils.formatWaitTime(service.avg_wait_time)}</td>
        <td><span class="trend ${trendClass}">${trend}</span></td>
        <td>
          <div class="efficiency-bar">
            <div class="efficiency-fill" style="width: ${Math.min(100, 100 - (service.avg_wait_time / 60) * 100)}%"></div>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// Filter data based on period and service
async function filterData() {
  const period = document.getElementById('period')?.value;
  const serviceId = document.getElementById('service')?.value;
  
  console.log('Filtering data:', { period, serviceId });
  
  // In a real implementation, this would call backend APIs with filters
  // For now, we'll just reload the current data
  APIUtils.showNotification('Filtres appliqués', 'info');
}

// Generate report
function generateReport() {
  if (!reportData.dashboard_stats) {
    APIUtils.showNotification('Aucune donnée disponible pour générer un rapport', 'warning');
    return;
  }
  
  const report = {
    generated_at: new Date().toISOString(),
    period: document.getElementById('period')?.value || 'month',
    service: document.getElementById('service')?.value || 'all',
    statistics: reportData.dashboard_stats,
    services: reportData.services
  };
  
  // Download as JSON
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `waitless-report-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  
  APIUtils.showNotification('Rapport généré et téléchargé', 'success');
}

// Export reports data
function exportReports() {
  if (!reportData.dashboard_stats) {
    APIUtils.showNotification('Aucune donnée disponible pour l\'export', 'warning');
    return;
  }
  
  // Create CSV data
  const csvData = [
    ['Service', 'Patients en attente', 'Temps moyen (min)', 'Statut'],
    ...reportData.services.map(service => [
      service.name,
      service.current_waiting,
      service.avg_wait_time,
      service.status
    ])
  ];
  
  const csvContent = csvData.map(row => row.join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `waitless-services-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  
  APIUtils.showNotification('Données exportées en CSV', 'success');
}

// Refresh reports data
async function refreshReports() {
  try {
    APIUtils.showNotification('Actualisation des rapports...', 'info');
    await loadReportsData();
    APIUtils.showNotification('Rapports actualisés', 'success');
  } catch (error) {
    console.error('Error refreshing reports:', error);
    APIUtils.showNotification('Erreur lors de l\'actualisation', 'error');
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

// Print report
function printReport() {
  window.print();
}

// Schedule report (placeholder for future implementation)
function scheduleReport() {
  APIUtils.showNotification('Fonctionnalité de programmation à venir...', 'info');
}

// Show notification
function showNotification(message, type = 'info') {
  APIUtils.showNotification(message, type);
}

// Exposer les fonctions globalement
window.generateReport = generateReport;
window.exportReports = exportReports;
window.refreshReports = refreshReports;
window.handleLogout = handleLogout;
window.printReport = printReport;
window.scheduleReport = scheduleReport; 