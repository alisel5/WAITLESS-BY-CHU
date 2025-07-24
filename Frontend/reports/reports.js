// Reports data and chart instances
let currentPeriod = 'month';
let currentService = 'all';
let reportsData = {};
let waitTimeChart = null;
let serviceDistributionChart = null;

// Chart.js global configuration
Chart.defaults.font.family = 'Poppins, sans-serif';
Chart.defaults.font.size = 12;
Chart.defaults.color = '#64748b';
Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(0, 0, 0, 0.8)';
Chart.defaults.plugins.tooltip.cornerRadius = 8;
Chart.defaults.plugins.tooltip.padding = 12;
Chart.defaults.plugins.legend.labels.usePointStyle = true;
Chart.defaults.plugins.legend.labels.padding = 20;

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
  
  // Update main statistics with real data from database
  const patientsTreated = stats.total_completed_today || 0;
  const totalPatients = stats.total_patients || 0;
  const patientsChange = stats.completed_change || 0;
  const changeText = patientsChange >= 0 ? `+${patientsChange}` : `${patientsChange}`;
  
  // Show both today's treated patients and total patients in database
  updateStatCard('patients-treated', `${patientsTreated} / ${totalPatients}`, `${changeText} vs hier`);
  updateStatCard('avg-wait-time', `${stats.avg_wait_time || 0} min`, `${stats.avg_wait_time_change || 0} min vs hier`);
  
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

// Create professional wait time chart
function updateWaitTimeChart() {
  const ctx = document.getElementById('waitTimeChart');
  if (!ctx) return;

  // Destroy existing chart
  if (waitTimeChart) {
    waitTimeChart.destroy();
  }

  // Prepare data
  const chartData = getWaitTimeData();
  
  // Create gradient
  const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 400);
  gradient.addColorStop(0, 'rgba(74, 144, 226, 0.8)');
  gradient.addColorStop(1, 'rgba(74, 144, 226, 0.1)');

  waitTimeChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: chartData.labels,
      datasets: [{
        label: 'Temps d\'attente (minutes)',
        data: chartData.values,
        borderColor: '#4A90E2',
        backgroundColor: gradient,
        borderWidth: 3,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#4A90E2',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 3,
        pointRadius: 6,
        pointHoverRadius: 8,
        pointHoverBorderWidth: 4,
        pointHoverBackgroundColor: '#4A90E2',
        pointHoverBorderColor: '#ffffff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          titleColor: '#ffffff',
          bodyColor: '#ffffff',
          borderColor: '#4A90E2',
          borderWidth: 1,
          cornerRadius: 8,
          padding: 12,
          displayColors: false,
          callbacks: {
            title: function(context) {
              return `Date: ${context[0].label}`;
            },
            label: function(context) {
              return `Temps d'attente: ${context.parsed.y} minutes`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            display: false
          },
          ticks: {
            color: '#64748b',
            font: {
              size: 11
            }
          }
        },
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(100, 116, 139, 0.1)',
            drawBorder: false
          },
          ticks: {
            color: '#64748b',
            font: {
              size: 11
            },
            callback: function(value) {
              return value + ' min';
            }
          }
        }
      },
      interaction: {
        mode: 'nearest',
        axis: 'x',
        intersect: false
      },
      animation: {
        duration: 2000,
        easing: 'easeInOutQuart'
      }
    }
  });
}

// Create professional service distribution chart
function updateServiceDistributionChart() {
  const ctx = document.getElementById('serviceDistributionChart');
  if (!ctx) return;

  // Destroy existing chart
  if (serviceDistributionChart) {
    serviceDistributionChart.destroy();
  }

  // Prepare data
  const chartData = getServiceDistributionData();
  
  serviceDistributionChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: chartData.labels,
      datasets: [{
        data: chartData.values,
        backgroundColor: [
          '#4A90E2',
          '#28a745',
          '#ffc107',
          '#dc3545',
          '#6f42c1',
          '#fd7e14',
          '#20c997',
          '#e83e8c'
        ],
        borderColor: '#ffffff',
        borderWidth: 3,
        hoverBorderWidth: 4,
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 20,
            usePointStyle: true,
            pointStyle: 'circle',
            font: {
              size: 12
            },
            generateLabels: function(chart) {
              const data = chart.data;
              if (data.labels.length && data.datasets.length) {
                return data.labels.map((label, i) => {
                  const dataset = data.datasets[0];
                  const value = dataset.data[i];
                  const total = dataset.data.reduce((a, b) => a + b, 0);
                  const percentage = ((value / total) * 100).toFixed(1);
                  
                  return {
                    text: `${label} (${percentage}%)`,
                    fillStyle: dataset.backgroundColor[i],
                    strokeStyle: dataset.backgroundColor[i],
                    lineWidth: 0,
                    pointStyle: 'circle',
                    hidden: false,
                    index: i
                  };
                });
              }
              return [];
            }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          titleColor: '#ffffff',
          bodyColor: '#ffffff',
          borderColor: '#4A90E2',
          borderWidth: 1,
          cornerRadius: 8,
          padding: 12,
          callbacks: {
            label: function(context) {
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percentage = ((context.parsed / total) * 100).toFixed(1);
              return `${context.label}: ${context.parsed} demandes (${percentage}%)`;
            }
          }
        }
      },
      animation: {
        animateRotate: true,
        animateScale: true,
        duration: 2000,
        easing: 'easeInOutQuart'
      },
      cutout: '60%'
    }
  });
}

// Get wait time data for chart
function getWaitTimeData() {
  if (reportsData.daily && reportsData.daily.length > 0) {
    // Use real data from backend
    const last7Days = reportsData.daily.slice(0, 7).reverse();
    return {
      labels: last7Days.map(day => {
        const date = new Date(day.date);
        return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
      }),
      values: last7Days.map(day => day.avg_wait_time || 0)
    };
  } else {
    // Mock data
    return {
      labels: ['18/07', '19/07', '20/07', '21/07', '22/07', '23/07', '24/07'],
      values: [0, 0, 0, 173, 1196, 18, 224]
    };
  }
}

// Get service distribution data for chart
function getServiceDistributionData() {
  if (reportsData.daily && reportsData.daily.length > 0) {
    // Aggregate service distribution from daily data
    const serviceDistribution = {};
    let totalRequests = 0;
    
    reportsData.daily.forEach(day => {
      if (day.service_distribution) {
        Object.keys(day.service_distribution).forEach(service => {
          if (!serviceDistribution[service]) {
            serviceDistribution[service] = 0;
          }
          serviceDistribution[service] += day.service_distribution[service];
          totalRequests += day.service_distribution[service];
        });
      }
    });
    
    if (totalRequests > 0) {
      const sortedServices = Object.entries(serviceDistribution)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 8); // Top 8 services
      
      return {
        labels: sortedServices.map(([service]) => service),
        values: sortedServices.map(([, count]) => count)
      };
    }
  }
  
  // Mock data
  return {
    labels: ['Cardiologie', 'Neurologie', 'Dermatologie', 'Orthopédie', 'Pédiatrie', 'Radiologie'],
    values: [38.5, 23.1, 15.4, 7.7, 7.7, 7.7]
  };
}

// Update top services table
function updateTopServicesTable() {
  const tableBody = document.querySelector('.table-wrapper tbody');
  if (!tableBody) return;
  
  // Get service data
  const serviceStats = getServiceStats();
  
  tableBody.innerHTML = serviceStats.map(service => {
    const trend = Math.random() > 0.5 ? 'positive' : 'negative';
    const trendValue = Math.floor(Math.random() * 15) + 1;
    const trendSymbol = trend === 'positive' ? '↗' : '↘';
    
    return `
      <tr>
        <td>${service.name}</td>
        <td>${service.totalPatients}</td>
        <td>${service.avgWaitTime > 0 ? service.avgWaitTime + ' min' : 'N/A'}</td>
        <td><span class="trend ${trend}">${trendSymbol} ${trendValue}%</span></td>
      </tr>
    `;
  }).join('');
}

// Get service statistics
function getServiceStats() {
  if (reportsData.daily && reportsData.daily.length > 0) {
    const serviceStats = {};
    
    reportsData.daily.forEach(day => {
      if (day.service_distribution) {
        Object.keys(day.service_distribution).forEach(service => {
          if (!serviceStats[service]) {
            serviceStats[service] = {
              name: service,
              totalPatients: 0,
              avgWaitTime: 0,
              waitTimeCount: 0
            };
          }
          serviceStats[service].totalPatients += day.service_distribution[service];
        });
      }
    });
    
    return Object.values(serviceStats)
      .sort((a, b) => b.totalPatients - a.totalPatients)
      .slice(0, 10);
  }
  
  // Mock data
  return [
    { name: 'Cardiologie', totalPatients: 156, avgWaitTime: 28 },
    { name: 'Dermatologie', totalPatients: 142, avgWaitTime: 18 },
    { name: 'Neurologie', totalPatients: 98, avgWaitTime: 35 },
    { name: 'Pédiatrie', totalPatients: 87, avgWaitTime: 22 },
    { name: 'Orthopédie', totalPatients: 76, avgWaitTime: 32 }
  ];
}

// Populate service filter dropdown
function populateServiceFilter() {
  const serviceSelect = document.getElementById('service');
  if (!serviceSelect) return;
  
  serviceSelect.innerHTML = '<option value="all">Tous les services</option>';
  
  if (reportsData.services && reportsData.services.length > 0) {
    reportsData.services.forEach(service => {
      serviceSelect.innerHTML += `<option value="${service.id}">${service.name}</option>`;
    });
  } else {
    // Mock services
    const mockServices = [
      { id: 'cardiology', name: 'Cardiologie' },
      { id: 'dermatology', name: 'Dermatologie' },
      { id: 'neurology', name: 'Neurologie' },
      { id: 'pediatrics', name: 'Pédiatrie' }
    ];
    
    mockServices.forEach(service => {
      serviceSelect.innerHTML += `<option value="${service.id}">${service.name}</option>`;
    });
  }
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
  
  // Update with realistic mock data
  updateStatCard('patients-treated', '156 / 1,247', '+23 vs hier');
  updateStatCard('avg-wait-time', '23 min', '+2 min vs hier');
  
  // Update charts with mock data
  updateWaitTimeChart();
  updateServiceDistributionChart();
  updateTopServicesTable();
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

// Export report function (for action buttons)
function exportReport() {
  exportReportsData();
}

// Schedule report function
function scheduleReport() {
  APIUtils.showNotification('Fonctionnalité de programmation de rapports à venir', 'info');
}

// Share report function
function shareReport() {
  APIUtils.showNotification('Fonctionnalité de partage à venir', 'info');
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
`;
document.head.appendChild(style); 