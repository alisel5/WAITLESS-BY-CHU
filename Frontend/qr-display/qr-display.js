// QR codes data
let qrServices = [];

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

// Load QR codes for all services
async function loadQRCodes() {
  try {
    showLoading(true);
    
    // Get services with QR codes
    const services = await apiClient.getServicesWithQR();
    if (services) {
      qrServices = services;
      displayQRCodes();
    }
  } catch (error) {
    console.error('Error loading QR codes:', error);
    APIUtils.showError(document.getElementById('qrGrid'), 'Erreur lors du chargement des QR codes');
    APIUtils.showNotification('Erreur de connexion au serveur', 'error');
  } finally {
    showLoading(false);
  }
}

// Display QR codes grid
function displayQRCodes() {
  const qrGrid = document.getElementById('qrGrid');
  
  if (!qrServices || qrServices.length === 0) {
    qrGrid.innerHTML = `
      <div class="no-qr-message">
        <i class="fas fa-qrcode"></i>
        <h3>Aucun QR code disponible</h3>
        <p>Aucun service actif trouvé. Activez des services depuis la page Services.</p>
        <a href="../services/services.html" class="btn">Gérer les Services</a>
      </div>
    `;
    return;
  }
  
  qrGrid.innerHTML = qrServices.map(service => `
    <div class="qr-card" data-service-id="${service.id}">
      <div class="qr-card-header">
        <h3>${service.name}</h3>
        <span class="status-badge ${service.status}">${getStatusText(service.status)}</span>
      </div>
      
      <div class="qr-card-content">
        <div class="qr-image-container" id="qr-${service.id}">
          <div class="loading-qr">Chargement QR...</div>
        </div>
        
        <div class="service-info">
          <p><i class="fas fa-map-marker-alt"></i> ${service.location}</p>
          <p><i class="fas fa-users"></i> ${service.current_waiting} en attente</p>
          <p><i class="fas fa-clock"></i> ${APIUtils.formatWaitTime(service.avg_wait_time)}</p>
        </div>
      </div>
      
      <div class="qr-card-actions">
        <button class="print-btn" onclick="printSingleQR(${service.id}, '${service.name}')">
          <i class="fas fa-print"></i> Imprimer
        </button>
        <button class="download-btn" onclick="downloadSingleQR(${service.id}, '${service.name}')">
          <i class="fas fa-download"></i> Télécharger
        </button>
        <button class="preview-btn" onclick="previewQR(${service.id}, '${service.name}')">
          <i class="fas fa-eye"></i> Aperçu
        </button>
      </div>
    </div>
  `).join('');
  
  // Load QR codes for each service
  qrServices.forEach(service => {
    loadServiceQR(service.id, service.name);
  });
}

// Load individual service QR code
async function loadServiceQR(serviceId, serviceName) {
  try {
    const qrCodeUrl = await apiClient.getServiceQRCode(serviceId);
    if (qrCodeUrl) {
      const qrContainer = document.getElementById(`qr-${serviceId}`);
      qrContainer.innerHTML = `
        <img src="${qrCodeUrl}" alt="QR Code ${serviceName}" class="qr-image">
      `;
    }
  } catch (error) {
    console.error(`Error loading QR for service ${serviceId}:`, error);
    const qrContainer = document.getElementById(`qr-${serviceId}`);
    qrContainer.innerHTML = `
      <div class="qr-error">
        <i class="fas fa-exclamation-triangle"></i>
        <p>Erreur QR</p>
      </div>
    `;
  }
}

// Print single QR code
async function printSingleQR(serviceId, serviceName) {
  try {
    const qrCodeUrl = await apiClient.getServiceQRCode(serviceId);
    if (qrCodeUrl) {
      const service = qrServices.find(s => s.id === serviceId);
      printQRCode(qrCodeUrl, serviceName, service);
    }
  } catch (error) {
    console.error('Error printing QR:', error);
    APIUtils.showNotification('Erreur lors de l\'impression', 'error');
  }
}

// Download single QR code
async function downloadSingleQR(serviceId, serviceName) {
  try {
    const qrCodeUrl = await apiClient.getServiceQRCode(serviceId);
    if (qrCodeUrl) {
      const link = document.createElement('a');
      link.download = `qr-code-${serviceName.toLowerCase().replace(/\s/g, '-')}.png`;
      link.href = qrCodeUrl;
      link.click();
    }
  } catch (error) {
    console.error('Error downloading QR:', error);
    APIUtils.showNotification('Erreur lors du téléchargement', 'error');
  }
}

// Preview QR code in modal
async function previewQR(serviceId, serviceName) {
  try {
    const qrCodeUrl = await apiClient.getServiceQRCode(serviceId);
    if (qrCodeUrl) {
      const service = qrServices.find(s => s.id === serviceId);
      
      // Create preview modal
      const modal = document.createElement('div');
      modal.className = 'modal-overlay';
      modal.innerHTML = `
        <div class="modal qr-preview-modal">
          <span class="close-btn" onclick="this.parentElement.parentElement.remove()">&times;</span>
          <h2>🔳 Aperçu QR Code - ${serviceName}</h2>
          <div class="qr-preview-content">
            <img src="${qrCodeUrl}" alt="QR Code ${serviceName}" class="qr-preview-image">
            <div class="service-details">
              <h3>${serviceName}</h3>
              <p><strong>Localisation:</strong> ${service.location}</p>
              <p><strong>En attente:</strong> ${service.current_waiting} patients</p>
              <p><strong>Temps moyen:</strong> ${APIUtils.formatWaitTime(service.avg_wait_time)}</p>
              <p><strong>Statut:</strong> ${getStatusText(service.status)}</p>
            </div>
            <div class="preview-actions">
              <button onclick="printSingleQR(${serviceId}, '${serviceName}')" class="print-btn">
                🖨️ Imprimer
              </button>
              <button onclick="downloadSingleQR(${serviceId}, '${serviceName}')" class="download-btn">
                💾 Télécharger
              </button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    }
  } catch (error) {
    console.error('Error previewing QR:', error);
    APIUtils.showNotification('Erreur lors de l\'aperçu', 'error');
  }
}

// Print all QR codes
async function printAllQRCodes() {
  if (!qrServices || qrServices.length === 0) {
    APIUtils.showNotification('Aucun QR code à imprimer', 'error');
    return;
  }
  
  try {
    showLoading(true);
    
    // Create print page with all QR codes
    const printWindow = window.open('', '_blank');
    let printContent = `
      <html>
        <head>
          <title>QR Codes - Tous les Services</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              padding: 20px; 
              background: white;
            }
            .page-header {
              text-align: center;
              margin-bottom: 30px;
              border-bottom: 2px solid #333;
              padding-bottom: 20px;
            }
            .qr-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 30px;
              page-break-inside: avoid;
            }
            .qr-item {
              text-align: center;
              border: 1px solid #ddd;
              padding: 20px;
              border-radius: 10px;
              page-break-inside: avoid;
            }
            .qr-item h3 {
              color: #2c3e50;
              margin-bottom: 10px;
            }
            .qr-item img {
              width: 200px;
              height: 200px;
              margin: 10px 0;
            }
            .qr-item .location {
              color: #666;
              font-size: 14px;
              margin-bottom: 15px;
            }
            .instructions {
              margin-top: 15px;
              text-align: left;
              font-size: 12px;
              color: #555;
            }
            @media print {
              .qr-grid { grid-template-columns: repeat(2, 1fr); }
            }
          </style>
        </head>
        <body>
          <div class="page-header">
            <h1>🏥 QR Codes - Services CHU</h1>
            <p>Codes QR pour rejoindre les files d'attente</p>
            <p><small>Généré le ${new Date().toLocaleDateString('fr-FR')}</small></p>
          </div>
          <div class="qr-grid">
    `;
    
    // Add each QR code
    for (const service of qrServices) {
      try {
        const qrCodeUrl = await apiClient.getServiceQRCode(service.id);
        printContent += `
          <div class="qr-item">
            <h3>${service.name}</h3>
            <div class="location">📍 ${service.location}</div>
            <img src="${qrCodeUrl}" alt="QR Code ${service.name}">
            <div class="instructions">
              <strong>Instructions:</strong><br>
              1. Scannez avec votre téléphone<br>
              2. Entrez vos informations<br>
              3. Recevez votre ticket<br>
              4. Suivez votre position
            </div>
          </div>
        `;
      } catch (error) {
        console.error(`Error loading QR for ${service.name}:`, error);
      }
    }
    
    printContent += `
          </div>
        </body>
      </html>
    `;
    
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
    
  } catch (error) {
    console.error('Error printing all QR codes:', error);
    APIUtils.showNotification('Erreur lors de l\'impression', 'error');
  } finally {
    showLoading(false);
  }
}

// Print single QR code with details
function printQRCode(qrCodeUrl, serviceName, service) {
  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <html>
      <head>
        <title>QR Code - ${serviceName}</title>
        <style>
          body { 
            text-align: center; 
            padding: 30px; 
            font-family: Arial, sans-serif; 
            background: white;
          }
          .qr-print { 
            max-width: 500px; 
            margin: 0 auto; 
            border: 2px solid #2c3e50;
            border-radius: 15px;
            padding: 30px;
          }
          img { 
            width: 250px; 
            height: 250px; 
            border: 1px solid #ddd;
            border-radius: 10px;
          }
          h1 { 
            color: #2c3e50; 
            margin-bottom: 10px; 
          }
          .service-info {
            margin: 20px 0;
            color: #555;
          }
          .instructions { 
            text-align: left; 
            margin-top: 30px; 
            background: #f8f9fa;
            padding: 20px;
            border-radius: 10px;
          }
          .instructions h3 {
            color: #2c3e50;
          }
        </style>
      </head>
      <body>
        <div class="qr-print">
          <h1>🏥 ${serviceName}</h1>
          <div class="service-info">
            <p><strong>📍 Localisation:</strong> ${service.location}</p>
            <p><strong>📊 Temps d'attente moyen:</strong> ${APIUtils.formatWaitTime(service.avg_wait_time)}</p>
          </div>
          <p><strong>Scannez pour rejoindre la file d'attente</strong></p>
          <img src="${qrCodeUrl}" alt="QR Code ${serviceName}">
          <div class="instructions">
            <h3>📱 Instructions pour les patients:</h3>
            <ol>
              <li>Scannez ce QR code avec votre téléphone</li>
              <li>Entrez vos informations (nom, téléphone, email)</li>
              <li>Recevez votre numéro de ticket automatiquement</li>
              <li>Suivez votre position en temps réel</li>
              <li>Recevez une notification quand c'est votre tour</li>
            </ol>
            <p><small>⚠️ Aucune application à installer, fonctionne avec tous les téléphones</small></p>
          </div>
        </div>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.print();
}

// Helper functions
function getStatusText(status) {
  switch (status) {
    case 'active': return 'Actif';
    case 'inactive': return 'Inactif';
    case 'emergency': return 'Urgence';
    default: return status;
  }
}

function showLoading(show) {
  const spinner = document.getElementById('loadingSpinner');
  if (spinner) {
    spinner.style.display = show ? 'flex' : 'none';
  }
}

// Logout handler
async function handleLogout() {
  try {
    await apiClient.logout();
    APIUtils.showNotification('Déconnexion réussie', 'success');
    
    setTimeout(() => {
      window.location.href = '../Acceuil/acceuil.html';
    }, 1000);
  } catch (error) {
    console.error('Logout error:', error);
    // Force logout even if backend call fails
    apiClient.removeToken();
    window.location.href = '../Acceuil/acceuil.html';
  }
}

// Initialize page
document.addEventListener('DOMContentLoaded', async () => {
  // Check authentication and authorization
  if (!checkAdminAuth()) {
    return;
  }
  
  // Load QR codes data
  await loadQRCodes();
  
  console.log('QR Display page initialized for admin user');
});

// Export functions globally
window.loadQRCodes = loadQRCodes;
window.printSingleQR = printSingleQR;
window.downloadSingleQR = downloadSingleQR;
window.previewQR = previewQR;
window.printAllQRCodes = printAllQRCodes;
window.handleLogout = handleLogout; 