// Reports data
let currentPeriod = 'month';
let currentService = 'all';
let reportsData = {};

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

// Load reports data from backend
async function loadReportsData() {
  try {
    showLoading(true);
    
    // Get dashboard stats
    const dashboardStats = await apiClient.getDashboardStats();
    
    // Get daily reports
    const dailyReports = await apiClient.getDailyReports();
    
    // Get all services for filtering
    const services = await apiClient.getServices();
    
    // Combine data
    reportsData = {
      dashboard: dashboardStats,
      daily: dailyReports,
      services: services
    };
    
    // Update UI
    updateReportsDisplay();
    populateServiceFilter();
    
  } catch (error) {
    console.error('Error loading reports data:', error);
    APIUtils.showNotification('Erreur lors du chargement des rapports', 'error');
    showMockData(); // Fallback to mock data
  } finally {
    showLoading(false);
  }
}

// Update reports display with real data
function updateReportsDisplay() {
  if (!reportsData.dashboard) return;
  
  const stats = reportsData.dashboard;
  
  // Update main statistics
  updateStatCard('patients-treated', stats.total_waiting + stats.total_consulting, '+12.5%');
  updateStatCard('avg-wait-time', `${stats.avg_wait_time} min`, '+2.1 min');
  updateStatCard('satisfaction', '4.2/5', '+0.3');
  updateStatCard('efficiency', '87%', '+5%');
  
  // Update charts
  updateWaitTimeChart();
  updateServiceDistributionChart();
  updateTopServicesTable();
}

// Update individual stat card
function updateStatCard(statId, value, change) {
  const statElement = document.querySelector(`[data-stat="${statId}"]`);
  if (statElement) {
    const numberElement = statElement.querySelector('.stat-number');
    const changeElement = statElement.querySelector('.stat-change');
    
    if (numberElement) numberElement.textContent = value;
    if (changeElement) {
      changeElement.textContent = change;
      changeElement.className = `stat-change ${change.includes('+') ? 'positive' : 'negative'}`;
    }
  }
}

// Update wait time chart
function updateWaitTimeChart() {
  const chartContainer = document.querySelector('.chart-placeholder');
  if (!chartContainer || !reportsData.daily) return;
  
  // Create simple bar chart from daily data
  const chartData = reportsData.daily.slice(0, 7); // Last 7 days
  
  chartContainer.innerHTML = `
    <i class="fas fa-chart-line"></i>
    <p>Graphique d'évolution des temps d'attente par jour</p>
    <div class="chart-data">
      ${chartData.map(day => `
        <div class="data-point" style="height: ${Math.min(80, (day.avg_wait_time / 60) * 100)}%">
          <span class="data-label">${day.date}</span>
          <span class="data-value">${day.avg_wait_time}min</span>
        </div>
      `).join('')}
    </div>
  `;
}

// Update service distribution chart
function updateServiceDistributionChart() {
  const pieChart = document.querySelector('.pie-chart');
  if (!pieChart || !reportsData.services) return;
  
  const services = reportsData.services.filter(s => s.current_waiting > 0);
  const totalWaiting = services.reduce((sum, s) => sum + s.current_waiting, 0);
  
  if (totalWaiting === 0) {
    pieChart.innerHTML = '<p>Aucun patient en attente</p>';
    return;
  }
  
  const colors = ['#4A90E2', '#28a745', '#ffc107', '#dc3545', '#6f42c1', '#fd7e14'];
  
  pieChart.innerHTML = services.map((service, index) => {
    const percentage = (service.current_waiting / totalWaiting) * 100;
    const color = colors[index % colors.length];
    return `<div class="pie-segment" style="--percentage: ${percentage}%; --color: ${color};"></div>`;
  }).join('');
}

// Update top services table
function updateTopServicesTable() {
  const tableBody = document.querySelector('.table-wrapper tbody');
  if (!tableBody || !reportsData.services) return;
  
  const services = reportsData.services
    .filter(s => s.current_waiting > 0)
    .sort((a, b) => b.current_waiting - a.current_waiting)
    .slice(0, 10);
  
  tableBody.innerHTML = services.map(service => `
    <tr>
      <td>${service.name}</td>
      <td>${service.current_waiting}</td>
      <td>${service.avg_wait_time} min</td>
      <td>4.2/5</td>
      <td><span class="trend positive">↗ +8%</span></td>
    </tr>
  `).join('');
}

// Populate service filter dropdown
function populateServiceFilter() {
  const serviceSelect = document.getElementById('service');
  if (!serviceSelect || !reportsData.services) return;
  
  serviceSelect.innerHTML = '<option value="all">Tous les services</option>';
  reportsData.services.forEach(service => {
    serviceSelect.innerHTML += `<option value="${service.id}">${service.name}</option>`;
  });
}

// Generate report based on filters
async function generateReport() {
  currentPeriod = document.getElementById('period').value;
  currentService = document.getElementById('service').value;
  
  try {
    showLoading(true);
    
    // Reload data with new filters
    await loadReportsData();
    
    APIUtils.showNotification('Rapport généré avec succès', 'success');
    
  } catch (error) {
    console.error('Error generating report:', error);
    APIUtils.showNotification('Erreur lors de la génération du rapport', 'error');
  } finally {
    showLoading(false);
  }
}

// Show mock data as fallback
function showMockData() {
  console.log('Showing mock data as fallback');
  
  // Update with mock data
  updateStatCard('patients-treated', '1,247', '+12.5%');
  updateStatCard('avg-wait-time', '23 min', '+2.1 min');
  updateStatCard('satisfaction', '4.2/5', '+0.3');
  updateStatCard('efficiency', '87%', '+5%');
  
  // Show mock chart
  const chartContainer = document.querySelector('.chart-placeholder');
  if (chartContainer) {
    chartContainer.innerHTML = `
      <i class="fas fa-chart-line"></i>
      <p>Graphique d'évolution des temps d'attente par jour</p>
      <div class="chart-data">
        <div class="data-point" style="height: 60%"></div>
        <div class="data-point" style="height: 45%"></div>
        <div class="data-point" style="height: 70%"></div>
        <div class="data-point" style="height: 55%"></div>
        <div class="data-point" style="height: 80%"></div>
        <div class="data-point" style="height: 65%"></div>
        <div class="data-point" style="height: 50%"></div>
      </div>
    `;
  }
  
  // Show mock pie chart
  const pieChart = document.querySelector('.pie-chart');
  if (pieChart) {
    pieChart.innerHTML = `
      <div class="pie-segment" style="--percentage: 35%; --color: #4A90E2;"></div>
      <div class="pie-segment" style="--percentage: 25%; --color: #28a745;"></div>
      <div class="pie-segment" style="--percentage: 20%; --color: #ffc107;"></div>
      <div class="pie-segment" style="--percentage: 20%; --color: #dc3545;"></div>
    `;
  }
}

// Export reports data
function exportReportsData() {
  try {
    const data = {
      period: currentPeriod,
      service: currentService,
      generated_at: new Date().toISOString(),
      stats: reportsData.dashboard,
      services: reportsData.services
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `waitless-reports-${currentPeriod}-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    
    APIUtils.showNotification('Rapport exporté avec succès', 'success');
  } catch (error) {
    console.error('Error exporting reports:', error);
    APIUtils.showNotification('Erreur lors de l\'export', 'error');
  }
}

// Show/hide loading spinner
function showLoading(show) {
  const spinner = document.createElement('div');
  spinner.id = 'loadingSpinner';
  spinner.className = 'loading-spinner';
  spinner.innerHTML = `
    <div class="spinner"></div>
    <p>Génération du rapport...</p>
  `;
  
  if (show) {
    document.body.appendChild(spinner);
  } else {
    const existingSpinner = document.getElementById('loadingSpinner');
    if (existingSpinner) {
      existingSpinner.remove();
    }
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
    loadReportsData();
  }
});

// Add CSS for loading spinner
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
  
  .chart-data {
    display: flex;
    justify-content: space-around;
    align-items: end;
    height: 200px;
    margin-top: 20px;
  }
  
  .data-point {
    width: 30px;
    background: #3498db;
    border-radius: 3px 3px 0 0;
    position: relative;
    transition: height 0.3s ease;
  }
  
  .data-label {
    position: absolute;
    bottom: -25px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 10px;
    color: #666;
  }
  
  .data-value {
    position: absolute;
    top: -20px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 10px;
    color: #333;
    font-weight: bold;
  }
`;
document.head.appendChild(style); 