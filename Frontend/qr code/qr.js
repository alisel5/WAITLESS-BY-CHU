// Variables globales
let html5QrcodeScanner = null;
let html5QrCode = null;
let currentOption = null;
let isScanning = false;
let availableServices = [];
let scannerInitializationAttempts = 0;
let maxScannerAttempts = 3;

// Check if user is authenticated and show appropriate UI
function checkAuthStatus() {
  const logoutLink = document.getElementById('logoutLink');
  if (apiClient.isAuthenticated()) {
    const user = apiClient.getCurrentUser();
    if (user) {
      logoutLink.style.display = 'block';
      console.log('User authenticated:', user.full_name);
    }
  } else {
    logoutLink.style.display = 'none';
  }
}

// Auto-fill user information in the form
function autoFillUserInfo() {
  if (apiClient.isAuthenticated()) {
    const user = apiClient.getCurrentUser();
    if (user) {
      // Auto-fill the form fields
      const patientNameEl = document.getElementById('patientName');
      const patientPhoneEl = document.getElementById('patientPhone');
      const patientEmailEl = document.getElementById('patientEmail');
      
      if (patientNameEl && user.full_name) {
        patientNameEl.value = user.full_name;
        patientNameEl.readOnly = true;
        patientNameEl.style.backgroundColor = '#f8f9fa';
      }
      
      if (patientPhoneEl && user.phone) {
        patientPhoneEl.value = user.phone;
        patientPhoneEl.readOnly = true;
        patientPhoneEl.style.backgroundColor = '#f8f9fa';
      }
      
      if (patientEmailEl && user.email) {
        patientEmailEl.value = user.email;
        patientEmailEl.readOnly = true;
        patientEmailEl.style.backgroundColor = '#f8f9fa';
      }
      
      // Show user info notice
      showUserInfoNotice();
    }
  }
}

// Show notice that user info is pre-filled
function showUserInfoNotice() {
  const onlineForm = document.querySelector('.online-form');
  if (onlineForm && !document.getElementById('userInfoNotice')) {
    const notice = document.createElement('div');
    notice.id = 'userInfoNotice';
    notice.className = 'user-info-notice';
    notice.innerHTML = `
      <i class="fas fa-user-check"></i>
      <span>Vos informations sont pré-remplies depuis votre compte</span>
    `;
    
    // Insert at the beginning of the form
    onlineForm.insertBefore(notice, onlineForm.firstChild);
  }
}

// Load available services from backend
async function loadAvailableServices() {
  try {
    const servicesData = await apiClient.getActiveServicesWithQR();
    if (servicesData && servicesData.services) {
      availableServices = servicesData.services;
      populateServiceDropdown();
    }
  } catch (error) {
    console.error('Error loading services:', error);
    APIUtils.showNotification('Erreur lors du chargement des services', 'error');
  }
}

// Populate the service dropdown with real services
function populateServiceDropdown() {
  const serviceSelect = document.getElementById('serviceSelect');
  if (serviceSelect && availableServices.length > 0) {
    serviceSelect.innerHTML = '<option value="">Sélectionner un service</option>';
    availableServices.forEach(service => {
      serviceSelect.innerHTML += `<option value="${service.id}">${service.name}</option>`;
    });
  } else if (serviceSelect) {
    serviceSelect.innerHTML = '<option value="">Aucun service disponible</option>';
  }
}

// Initialisation de la page
document.addEventListener('DOMContentLoaded', async function() {
  await initializePage();
});

// Initialisation de la page
async function initializePage() {
  // Vérifier que la bibliothèque HTML5-QRCode est chargée
  if (typeof Html5QrcodeScanner === 'undefined') {
    console.error('❌ Bibliothèque HTML5-QRCode non chargée');
    // Attendre un peu et réessayer
    setTimeout(async () => {
      if (typeof Html5QrcodeScanner === 'undefined') {
        console.error('❌ Bibliothèque HTML5-QRCode toujours non chargée après délai');
        // Afficher un message d'erreur sur la page
        const qrSection = document.getElementById('qrSection');
        if (qrSection) {
          qrSection.innerHTML = `
            <div class="scanner-error">
              <i class="fas fa-exclamation-triangle"></i>
              <h3>Erreur de chargement</h3>
              <p>La bibliothèque de scan QR n'a pas pu être chargée.</p>
              <button class="retry-btn" onclick="location.reload()">
                <i class="fas fa-sync"></i>
                Recharger la page
              </button>
            </div>
          `;
        }
        return;
      } else {
        console.log('✅ Bibliothèque HTML5-QRCode chargée avec succès');
      }
    }, 2000);
  } else {
    console.log('✅ Bibliothèque HTML5-QRCode disponible');
  }
  
  // Check authentication status
  checkAuthStatus();
  
  // Add staff quick access for staff members
  if (apiClient.isAuthenticated()) {
    const user = apiClient.getCurrentUser();
    if (user && apiClient.isStaff()) {
      addStaffQuickAccess();
    }
  }
  
  // Load available services
  await loadAvailableServices();
  
  // Afficher les options par défaut
  showOptions();
  
  // Initialiser les événements
  setupEventListeners();
  
  // Animation d'entrée
  animatePageLoad();
}

// Add staff quick access buttons
function addStaffQuickAccess() {
  const header = document.querySelector('.qr-header');
  if (header && !document.getElementById('staffQuickAccess')) {
    const user = apiClient.getCurrentUser();
    const roleInfo = {
      'admin': { icon: 'fa-user-shield', label: 'Mode Administrateur', color: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
      'staff': { icon: 'fa-user-cog', label: 'Mode Personnel', color: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
      'doctor': { icon: 'fa-user-md', label: 'Mode Médical', color: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' }
    };
    
    const currentRole = roleInfo[user.role] || roleInfo['staff'];
    
    const staffSection = document.createElement('div');
    staffSection.id = 'staffQuickAccess';
    staffSection.className = 'admin-quick-access';
    staffSection.style.background = currentRole.color;
    
    let buttons = '';
    
    // Dashboard access for all staff
    buttons += `
      <a href="../dashboard/dashboard.html" class="admin-btn">
        <i class="fas fa-tachometer-alt"></i> Dashboard
      </a>
    `;
    
    // Role-specific buttons
    if (user.role === 'admin') {
      buttons += `
        <a href="../qr-display/qr-display.html" class="admin-btn">
          <i class="fas fa-qrcode"></i> QR Codes
        </a>
        <a href="../services/services.html" class="admin-btn">
          <i class="fas fa-cogs"></i> Services
        </a>
        <a href="../patients/patients.html" class="admin-btn">
          <i class="fas fa-users"></i> Patients
        </a>
      `;
    } else if (user.role === 'staff') {
      buttons += `
        <a href="../patients/patients.html" class="admin-btn">
          <i class="fas fa-users"></i> Ma File
        </a>
        <a href="../qr-display/qr-display.html" class="admin-btn">
          <i class="fas fa-qrcode"></i> QR Code
        </a>
      `;
    } else if (user.role === 'doctor') {
      buttons += `
        <a href="../patients/patients.html" class="admin-btn">
          <i class="fas fa-users"></i> Mes Patients
        </a>
      `;
    }
    
    staffSection.innerHTML = `
      <div class="admin-notice">
        <i class="fas ${currentRole.icon}"></i>
        <span>${currentRole.label} Activé</span>
      </div>
      <div class="admin-actions">
        ${buttons}
      </div>
    `;
    header.appendChild(staffSection);
  }
}

// Configuration des écouteurs d'événements
function setupEventListeners() {
  // Validation du formulaire en ligne
  const onlineForm = document.querySelector('.online-form');
  if (onlineForm) {
    onlineForm.addEventListener('submit', function(e) {
      e.preventDefault();
      joinQueueOnline();
    });
  }
  
  // Validation du code manuel
  const manualCodeInput = document.getElementById('manualCode');
  if (manualCodeInput) {
    manualCodeInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        submitCode();
      }
    });
  }
}

// Animation de chargement de la page
function animatePageLoad() {
  const elements = document.querySelectorAll('.option-card, .qr-header');
  elements.forEach((element, index) => {
    element.style.opacity = '0';
    element.style.transform = 'translateY(30px)';
    
    setTimeout(() => {
      element.style.transition = 'all 0.6s ease-out';
      element.style.opacity = '1';
      element.style.transform = 'translateY(0)';
    }, index * 200);
  });
}

// Sélection d'une option
function selectOption(option) {
  currentOption = option;
  
  if (option === 'online') {
    showOnlineSection();
  } else if (option === 'qr') {
    showQRSection();
  }
}

// Afficher les options de choix
function showOptions() {
  currentOption = null;
  
  // Masquer toutes les sections
  document.getElementById('onlineSection').style.display = 'none';
  document.getElementById('qrSection').style.display = 'none';
  
  // Afficher la section des options
  const optionsSection = document.querySelector('.options-section');
  if (optionsSection) {
    optionsSection.style.display = 'grid';
  }
  
  // Arrêter le scanner QR s'il est actif
  stopQRScanner();
}

// Afficher la section en ligne
function showOnlineSection() {
  // Masquer les options et la section QR
  document.querySelector('.options-section').style.display = 'none';
  document.getElementById('qrSection').style.display = 'none';
  
  // Afficher la section en ligne
  const onlineSection = document.getElementById('onlineSection');
  onlineSection.style.display = 'block';
  
  // Animation d'entrée
  onlineSection.style.opacity = '0';
  onlineSection.style.transform = 'translateX(50px)';
  
  setTimeout(() => {
    onlineSection.style.transition = 'all 0.5s ease-out';
    onlineSection.style.opacity = '1';
    onlineSection.style.transform = 'translateX(0)';
  }, 100);
  
  // Auto-fill user information if authenticated
  autoFillUserInfo();
  
  // Définir l'heure d'arrivée par défaut (maintenant)
  const now = new Date();
  const timeString = now.toTimeString().slice(0, 5);
  document.getElementById('estimatedArrival').value = timeString;
}

// Afficher la section QR
function showQRSection() {
  // Masquer les options et la section en ligne
  document.querySelector('.options-section').style.display = 'none';
  document.getElementById('onlineSection').style.display = 'none';
  
  // Afficher la section QR
  const qrSection = document.getElementById('qrSection');
  qrSection.style.display = 'block';
  
  // Animation d'entrée
  qrSection.style.opacity = '0';
  qrSection.style.transform = 'translateX(-50px)';
  
  setTimeout(() => {
    qrSection.style.transition = 'all 0.5s ease-out';
    qrSection.style.opacity = '1';
    qrSection.style.transform = 'translateX(0)';
  }, 100);
  
  // Réinitialiser les tentatives
  scannerInitializationAttempts = 0;
  
  // Nettoyer d'abord le scanner existant (solution découverte par l'utilisateur)
  stopQRScanner();
  
  // Diagnostic et initialisation du scanner avec délai plus long
  setTimeout(() => {
    diagnoseCameraIssues();
    // Attendre un peu plus pour s'assurer que le nettoyage est terminé
    setTimeout(() => {
      // Utiliser l'approche directe qui laisse la bibliothèque gérer les permissions
      initializeQRScannerDirect();
    }, 300);
  }, 800);
}

// Diagnostic des problèmes de caméra
function diagnoseCameraIssues() {
  console.log('=== DIAGNOSTIC CAMÉRA ===');
  console.log('Navigateur:', navigator.userAgent);
  console.log('HTTPS:', window.location.protocol === 'https:');
  console.log('getUserMedia supporté:', !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia));
  console.log('Html5QrcodeScanner disponible:', typeof Html5QrcodeScanner !== 'undefined');
  console.log('Élément reader:', !!document.getElementById('reader'));
  
  // Tester l'accès à la caméra
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices.getUserMedia({ video: true })
      .then(stream => {
        console.log('✅ Caméra accessible');
        stream.getTracks().forEach(track => track.stop());
      })
      .catch(err => {
        console.error('❌ Erreur caméra:', err.name, err.message);
        if (err.name === 'NotAllowedError') {
          console.log('Permission refusée - l\'utilisateur doit autoriser la caméra');
        }
      });
  }
}

// Arrêter le scanner QR
function stopQRScanner() {
  if (html5QrcodeScanner) {
    try {
      html5QrcodeScanner.clear();
    } catch (e) {
      console.log('Erreur lors de l\'arrêt du scanner:', e);
    }
    html5QrcodeScanner = null;
  }
  
  if (html5QrCode && isScanning) {
    try {
      html5QrCode.stop();
    } catch (e) {
      console.log('Erreur lors de l\'arrêt du scanner:', e);
    }
    isScanning = false;
  }
  
  html5QrCode = null;
}

// Initialiser le scanner QR avec vérification des permissions
async function initializeQRScannerWithPermissionCheck() {
  const reader = document.getElementById('reader');
  
  if (!reader) {
    console.error('Élément reader non trouvé');
    return;
  }
  
  // Nettoyer le contenu précédent
  reader.innerHTML = '';
  
  // Afficher un message de chargement
  reader.innerHTML = `
    <div class="scanner-loading">
      <i class="fas fa-spinner fa-spin"></i>
      <p>Initialisation de la caméra...</p>
      <p class="loading-subtitle">Veuillez autoriser l'accès à la caméra si demandé</p>
    </div>
  `;
  
  // Vérifier si la bibliothèque est chargée
  if (typeof Html5QrcodeScanner === 'undefined') {
    console.error('Bibliothèque Html5QrcodeScanner non chargée');
    showScannerError('La bibliothèque de scan QR n\'est pas chargée. Veuillez recharger la page.');
    return;
  }
  
  // Vérifier si getUserMedia est supporté
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    console.error('getUserMedia non supporté');
    showScannerError('Votre navigateur ne supporte pas l\'accès à la caméra. Veuillez utiliser un navigateur moderne.');
    return;
  }
  
  try {
    // Vérifier les permissions de la caméra d'abord
    if (navigator.permissions && navigator.permissions.query) {
      try {
        const permissionStatus = await navigator.permissions.query({ name: 'camera' });
        console.log('Statut permission caméra:', permissionStatus.state);
        
        if (permissionStatus.state === 'denied') {
          showScannerError('L\'accès à la caméra a été refusé. Veuillez autoriser l\'accès dans les paramètres de votre navigateur.');
          return;
        }
      } catch (permError) {
        console.log('Impossible de vérifier les permissions, continuation...');
      }
    }
    
    // Mettre à jour le message pour indiquer qu'on attend l'autorisation
    reader.innerHTML = `
      <div class="scanner-loading">
        <i class="fas fa-camera"></i>
        <p>Demande d'accès à la caméra...</p>
        <p class="loading-subtitle">Veuillez autoriser l'accès à la caméra dans la popup de votre navigateur</p>
      </div>
    `;
    
    // Essayer d'accéder à la caméra pour déclencher la demande de permission
    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: { 
        facingMode: 'environment',
        width: { ideal: 1280 },
        height: { ideal: 720 }
      } 
    });
    
    // Arrêter le stream de test
    stream.getTracks().forEach(track => track.stop());
    
    console.log('✅ Permission caméra accordée, initialisation du scanner...');
    
    // Mettre à jour le message pour indiquer l'initialisation
    reader.innerHTML = `
      <div class="scanner-loading">
        <i class="fas fa-spinner fa-spin"></i>
        <p>Initialisation du scanner...</p>
        <p class="loading-subtitle">Caméra autorisée, configuration en cours</p>
      </div>
    `;
    
    // Attendre un peu avant d'initialiser le scanner pour s'assurer que tout est prêt
    setTimeout(() => {
      initializeQRScanner();
    }, 1000);
    
  } catch (error) {
    console.error('Erreur lors de la vérification des permissions:', error);
    
    if (error.name === 'NotAllowedError') {
      showScannerError('L\'accès à la caméra a été refusé. Veuillez autoriser l\'accès et réessayer.');
    } else if (error.name === 'NotFoundError') {
      showScannerError('Aucune caméra trouvée sur votre appareil.');
    } else if (error.name === 'NotReadableError') {
      showScannerError('La caméra est utilisée par une autre application. Veuillez fermer les autres applications utilisant la caméra.');
    } else {
      showScannerError('Erreur lors de l\'accès à la caméra: ' + error.message);
    }
  }
}

// Initialiser le scanner QR directement (approche alternative)
function initializeQRScannerDirect() {
  const reader = document.getElementById('reader');
  
  if (!reader) {
    console.error('Élément reader non trouvé');
    return;
  }
  
  // Nettoyer le contenu précédent
  reader.innerHTML = '';
  
  // Afficher un message de chargement
  reader.innerHTML = `
    <div class="scanner-loading">
      <i class="fas fa-spinner fa-spin"></i>
      <p>Initialisation du scanner...</p>
      <p class="loading-subtitle">La bibliothèque va demander l'accès à la caméra</p>
    </div>
  `;
  
  // Vérifier si la bibliothèque est chargée
  if (typeof Html5QrcodeScanner === 'undefined') {
    console.error('Bibliothèque Html5QrcodeScanner non chargée');
    showScannerError('La bibliothèque de scan QR n\'est pas chargée. Veuillez recharger la page.');
    return;
  }
  
  // Configuration simple et robuste
  const config = {
    fps: 10,
    qrbox: { width: 250, height: 250 },
    aspectRatio: 1.0,
    disableFlip: false,
    verbose: false
  };
  
  try {
    // Arrêter le scanner précédent s'il existe
    if (html5QrcodeScanner) {
      try {
        html5QrcodeScanner.clear();
      } catch (e) {
        console.log('Erreur lors du nettoyage du scanner précédent:', e);
      }
      html5QrcodeScanner = null;
    }
    
    console.log('Création du scanner avec config:', config);
    
    html5QrcodeScanner = new Html5QrcodeScanner(
      "reader",
      config,
      false
    );
    
    console.log('Scanner créé, rendu en cours...');
    
    // Rendre le scanner immédiatement - la bibliothèque gérera les permissions
    html5QrcodeScanner.render(onScanSuccess, onScanFailure);
    console.log('✅ Scanner QR initialisé avec succès');
    isScanning = true;
    scannerInitializationAttempts = 0; // Réinitialiser le compteur
    
    // Masquer l'overlay une fois le scanner initialisé
    const overlay = document.querySelector('.qr-overlay');
    if (overlay) {
      overlay.style.display = 'none';
    }
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation du scanner:', error);
    showScannerError('Impossible d\'initialiser le scanner QR: ' + error.message);
  }
}

// Initialiser le scanner QR
function initializeQRScanner() {
  const reader = document.getElementById('reader');
  
  if (!reader) {
    console.error('Élément reader non trouvé');
    return;
  }
  
  // Nettoyer le contenu précédent
  reader.innerHTML = '';
  
  // Vérifier si la bibliothèque est chargée
  if (typeof Html5QrcodeScanner === 'undefined') {
    console.error('Bibliothèque Html5QrcodeScanner non chargée');
    showScannerError('La bibliothèque de scan QR n\'est pas chargée. Veuillez recharger la page.');
    return;
  }
  
  // Vérifier si getUserMedia est supporté
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    console.error('getUserMedia non supporté');
    showScannerError('Votre navigateur ne supporte pas l\'accès à la caméra. Veuillez utiliser un navigateur moderne.');
    return;
  }
  
  // Configuration simple et robuste
  const config = {
    fps: 10,
    qrbox: { width: 250, height: 250 },
    aspectRatio: 1.0,
    disableFlip: false,
    verbose: false
  };
  
  try {
    // Arrêter le scanner précédent s'il existe
    if (html5QrcodeScanner) {
      try {
        html5QrcodeScanner.clear();
      } catch (e) {
        console.log('Erreur lors du nettoyage du scanner précédent:', e);
      }
      html5QrcodeScanner = null;
    }
    
    console.log('Création du scanner avec config:', config);
    
    html5QrcodeScanner = new Html5QrcodeScanner(
      "reader",
      config,
      false
    );
    
    console.log('Scanner créé, rendu en cours...');
    
    // Rendre le scanner immédiatement
    html5QrcodeScanner.render(onScanSuccess, onScanFailure);
    console.log('✅ Scanner QR initialisé avec succès');
    isScanning = true;
    scannerInitializationAttempts = 0; // Réinitialiser le compteur
    
    // Masquer l'overlay une fois le scanner initialisé
    const overlay = document.querySelector('.qr-overlay');
    if (overlay) {
      overlay.style.display = 'none';
    }
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation du scanner:', error);
    showScannerError('Impossible d\'initialiser le scanner QR: ' + error.message);
  }
}

// Fonction supprimée - remplacée par une approche plus simple

// Afficher une erreur de scanner
function showScannerError(customMessage = null) {
  const reader = document.getElementById('reader');
  if (reader) {
    const message = customMessage || 'Votre navigateur ne supporte pas le scanner de caméra ou la caméra n\'est pas accessible.';
    
    reader.innerHTML = `
      <div class="scanner-error">
        <i class="fas fa-exclamation-triangle"></i>
        <h3>Scanner non disponible</h3>
        <p>${message}</p>
        <div class="scanner-tips">
          <p><strong>Solutions possibles :</strong></p>
          <ul>
            <li>Cliquez sur "Réessayer" ci-dessous (solution recommandée)</li>
            <li>Si ça ne marche pas, essayez "Initialisation directe"</li>
            <li>Autorisez l'accès à la caméra dans votre navigateur</li>
            <li>Utilisez HTTPS (requis pour la caméra)</li>
            <li>Vérifiez que votre caméra fonctionne</li>
            <li>Essayez un autre navigateur (Chrome recommandé)</li>
            <li>Rechargez la page (F5)</li>
          </ul>
        </div>
        <p>En attendant, utilisez la saisie manuelle ci-dessous.</p>
        <button class="retry-btn" onclick="retryScanner()" style="background: #28a745; font-weight: bold;">
          <i class="fas fa-redo"></i>
          Réessayer (Solution recommandée)
        </button>
        <button class="retry-btn" onclick="retryScannerDirect()" style="background: #17a2b8; margin-left: 10px;">
          <i class="fas fa-bolt"></i>
          Initialisation directe
        </button>
        <button class="retry-btn" onclick="location.reload()" style="margin-left: 10px; background: #6c757d;">
          <i class="fas fa-sync"></i>
          Recharger
        </button>
      </div>
    `;
  }
}

// Réessayer le scanner
function retryScanner() {
  console.log('Tentative de réinitialisation du scanner...');
  
  // Réinitialiser le compteur de tentatives
  scannerInitializationAttempts = 0;
  
  // Arrêter le scanner actuel s'il existe (solution découverte par l'utilisateur)
  stopQRScanner();
  
  // Attendre que le nettoyage soit terminé avant de réinitialiser
  setTimeout(() => {
    // Utiliser l'approche directe qui laisse la bibliothèque gérer les permissions
    initializeQRScannerDirect();
  }, 300);
}

// Réessayer le scanner avec initialisation directe
function retryScannerDirect() {
  console.log('Tentative de réinitialisation directe du scanner...');
  
  // Réinitialiser le compteur de tentatives
  scannerInitializationAttempts = 0;
  
  // Arrêter le scanner actuel s'il existe
  stopQRScanner();
  
  // Initialisation directe immédiate
  setTimeout(() => {
    initializeQRScannerDirect();
  }, 100);
}

// Vérifier la disponibilité de la caméra
function checkCameraAvailability() {
  return new Promise((resolve, reject) => {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      })
        .then(function(stream) {
          console.log('Caméra disponible');
          stream.getTracks().forEach(track => track.stop());
          resolve(true);
        })
        .catch(function(err) {
          console.error('Caméra non disponible:', err);
          console.log('Tentative de scanner sans vérification préalable...');
          resolve(false);
        });
    } else {
      console.error('getUserMedia non supporté');
      resolve(false);
    }
  });
}

// Succès du scan QR
function onScanSuccess(decodedText, decodedResult) {
  console.log('QR Code détecté:', decodedText);
  
  // Arrêter le scanner
  stopQRScanner();
  
  // Traiter le code scanné avec l'API backend
  processScannedCode(decodedText);
}

// Échec du scan QR
function onScanFailure(error) {
  // Ne pas afficher d'erreur pour les échecs normaux de scan
}

// Traiter le code scanné avec l'API backend
async function processScannedCode(qrData) {
  try {
    console.log('Code scanné:', qrData);
    
    // Valider que qrData n'est pas vide
    if (!qrData || qrData.trim() === '') {
      APIUtils.showNotification('QR code vide ou invalide', 'error');
      return;
    }
    
    // Première étape: vérifier le type de QR code
    const scanResponse = await apiClient.scanQR(qrData.trim());
    
    if (scanResponse && scanResponse.type === 'service_join') {
      // C'est un QR code de service - auto-join immédiatement
      await autoJoinQueueViaScan(qrData, scanResponse);
    } else if (scanResponse && scanResponse.type === 'ticket_status') {
      // C'est un QR code de ticket - afficher le statut
      showTicketStatus(scanResponse);
    } else {
      APIUtils.showNotification('QR code non reconnu ou service inactif', 'error');
    }
    
  } catch (error) {
    console.error('Erreur lors du traitement du QR code:', error);
    
    // Provide more specific error messages
    if (error.message.includes('404')) {
      APIUtils.showNotification('QR code invalide ou service introuvable', 'error');
    } else if (error.message.includes('network') || error.message.includes('fetch')) {
      APIUtils.showNotification('Erreur de connexion. Vérifiez votre internet.', 'error');
    } else {
      APIUtils.showNotification('Erreur lors du scan du QR code', 'error');
    }
  }
}

// Auto-join queue via QR scan without manual intervention
async function autoJoinQueueViaScan(qrData, scanResponse) {
  try {
    let joinResponse;
    
    // Check if user is authenticated
    if (apiClient.isAuthenticated()) {
      // For authenticated users, get service ID and use create ticket endpoint
      const serviceId = scanResponse.service_id;
      if (!serviceId) {
        APIUtils.showNotification('Impossible de déterminer le service', 'error');
        return;
      }
      
      const formData = {
        service_id: serviceId,
        priority: 'low', // Auto-select "Priorité basse" as specified
        notes: 'Rejoint via scan QR automatique'
      };
      
      console.log('Creating ticket for authenticated user via QR scan:', formData);
      APIUtils.showNotification(`Joining ${scanResponse.service_name}...`, 'info');
      joinResponse = await apiClient.createTicket(formData);
    } else {
      // For anonymous users, create a minimal ticket with default info
      // Generate a temporary anonymous patient ID
      const timestamp = Date.now();
      const anonymousId = `anonymous_${timestamp}`;
      
      const anonymousPatientData = {
        name: `Patient Anonyme ${timestamp.toString().slice(-4)}`,
        phone: `0600000${timestamp.toString().slice(-3)}`,
        email: `anonymous.${timestamp}@temp.waitless.chu`,
        priority: 'low' // Auto-select "Priorité basse" as specified
      };
      
      console.log('Creating ticket for anonymous user via QR scan:', anonymousPatientData);
      APIUtils.showNotification(`Joining ${scanResponse.service_name} as anonymous user...`, 'info');
      joinResponse = await apiClient.scanToJoin(qrData, anonymousPatientData);
    }
    
    if (joinResponse) {
      // Show quick success notification
      APIUtils.showNotification(`Ticket créé: ${joinResponse.ticket_number}`, 'success');
      
      // Store ticket number for ticket.html
      sessionStorage.setItem('currentTicketNumber', joinResponse.ticket_number);
      
      // Auto-redirect immediately to ticket.html
      setTimeout(() => {
        window.location.href = '../tickets/ticket.html';
      }, 1000);
    }
    
  } catch (error) {
    console.error('Erreur lors de l\'auto-join à la file:', error);
    
    // Handle specific error cases
    if (error.message && error.message.includes('already have an active ticket')) {
      APIUtils.showNotification('Vous avez déjà un ticket actif', 'warning');
      // Redirect to ticket page to show existing ticket
      setTimeout(() => {
        window.location.href = '../tickets/ticket.html';
      }, 2000);
    } else {
      APIUtils.showNotification('Erreur lors de l\'ajout automatique à la file d\'attente', 'error');
    }
  }
}

// Afficher le modal pour les informations du patient
function showPatientInfoModal(qrData, scanResponse) {
  // Créer et afficher un modal pour collecter les informations du patient
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  
  // Check if user is authenticated
  const isAuthenticated = apiClient.isAuthenticated();
  const user = isAuthenticated ? apiClient.getCurrentUser() : null;
  
  let userInfoNotice = '';
  if (isAuthenticated && user) {
    userInfoNotice = `
      <div class="user-info-notice">
        <i class="fas fa-user-check"></i>
        <span>Vos informations sont pré-remplies depuis votre compte</span>
      </div>
    `;
  }
  
  modal.innerHTML = `
    <div class="modal">
      <h2>Rejoindre la file d'attente</h2>
      <p><strong>Service:</strong> ${scanResponse.service_name}</p>
      <p><strong>Localisation:</strong> ${scanResponse.location}</p>
      ${userInfoNotice}
      <form id="patientInfoForm">
        <input type="text" id="patientName" placeholder="Nom complet" required 
               value="${isAuthenticated && user ? user.full_name : ''}"
               ${isAuthenticated ? 'readonly style="background-color: #f8f9fa;"' : ''}>
        <input type="tel" id="patientPhone" placeholder="Téléphone" required
               value="${isAuthenticated && user && user.phone ? user.phone : ''}"
               ${isAuthenticated ? 'readonly style="background-color: #f8f9fa;"' : ''}>
        <input type="email" id="patientEmail" placeholder="Email" required
               value="${isAuthenticated && user ? user.email : ''}"
               ${isAuthenticated ? 'readonly style="background-color: #f8f9fa;"' : ''}>
        <select id="patientPriority">
          <option value="medium">Priorité normale</option>
          <option value="high">Priorité haute</option>
          <option value="low">Priorité basse</option>
        </select>
        <div class="modal-actions">
          <button type="button" onclick="closePatientModal()">Annuler</button>
          <button type="submit">Rejoindre la file</button>
        </div>
      </form>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Gestionnaire du formulaire
  document.getElementById('patientInfoForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    await joinQueueViaScan(qrData);
  });
  
  // Stocker les données pour utilisation ultérieure
  window.currentQRData = qrData;
  window.currentScanResponse = scanResponse;
}

// Fermer le modal des informations patient
function closePatientModal() {
  const modal = document.querySelector('.modal-overlay');
  if (modal) {
    modal.remove();
  }
  // Relancer le scanner
  showQRSection();
}

// Rejoindre la file via scan QR
async function joinQueueViaScan(qrData) {
  try {
    const patientData = {
      name: document.getElementById('patientName').value,
      phone: document.getElementById('patientPhone').value,
      email: document.getElementById('patientEmail').value,
      priority: document.getElementById('patientPriority').value
    };
    
    // Validation
    if (!patientData.name || !patientData.phone || !patientData.email) {
      APIUtils.showNotification('Veuillez remplir tous les champs obligatoires', 'error');
      return;
    }
    
    let joinResponse;
    
    // Check if user is authenticated - use different endpoints
    if (apiClient.isAuthenticated()) {
      // For authenticated users, we need to get the service ID from the QR scan response
      // and use the create ticket endpoint
      const serviceId = window.currentScanResponse.service_id;
      if (!serviceId) {
        APIUtils.showNotification('Impossible de déterminer le service', 'error');
        return;
      }
      
      const formData = {
        service_id: serviceId,
        priority: patientData.priority
      };
      
      console.log('Creating ticket for authenticated user via QR scan:', formData);
      joinResponse = await apiClient.createTicket(formData);
    } else {
      // For anonymous users, use the scan-to-join endpoint
      console.log('Joining queue as anonymous user via QR scan:', patientData);
      joinResponse = await apiClient.scanToJoin(qrData, patientData);
    }
    
    if (joinResponse) {
      // Fermer le modal
      closePatientModal();
      
      // Afficher la confirmation
      showConfirmationModal(joinResponse);
    }
    
  } catch (error) {
    console.error('Erreur lors de l\'ajout à la file:', error);
    APIUtils.showNotification('Erreur lors de l\'ajout à la file d\'attente', 'error');
  }
}

// Afficher le statut d'un ticket
function showTicketStatus(ticketData) {
  showConfirmationModal({
    ticket_number: ticketData.ticket_number,
    position_in_queue: ticketData.position_in_queue,
    estimated_wait_time: ticketData.estimated_wait_time,
    service_name: ticketData.service_name,
    status: ticketData.status
  });
}

// Rejoindre la queue en ligne
async function joinQueueOnline() {
  try {
    // Récupérer les données du formulaire avec validation
    const patientNameEl = document.getElementById('patientName');
    const patientPhoneEl = document.getElementById('patientPhone');
    const patientEmailEl = document.getElementById('patientEmail');
    const serviceSelectEl = document.getElementById('serviceSelect');
    const prioritySelectEl = document.getElementById('prioritySelect');
    const estimatedArrivalEl = document.getElementById('estimatedArrival');
    const notesEl = document.getElementById('notes');
    
    // Vérifier que les éléments requis existent
    if (!patientNameEl || !patientPhoneEl || !patientEmailEl || !serviceSelectEl) {
      APIUtils.showNotification('Formulaire incomplet. Rechargez la page.', 'error');
      return;
    }
    
    const patientName = patientNameEl.value.trim();
    const patientPhone = patientPhoneEl.value.trim();
    const patientEmail = patientEmailEl.value.trim();
    const serviceId = serviceSelectEl.value;
    const priority = prioritySelectEl ? prioritySelectEl.value : 'medium';
    const estimatedArrival = estimatedArrivalEl ? estimatedArrivalEl.value : null;
    const notes = notesEl ? notesEl.value.trim() : null;
    
    // Validation basique
    if (!patientName) {
      APIUtils.showNotification('Veuillez entrer votre nom', 'error');
      return;
    }
    
    if (!patientPhone) {
      APIUtils.showNotification('Veuillez entrer votre téléphone', 'error');
      return;
    }
    
    if (!patientEmail) {
      APIUtils.showNotification('Veuillez entrer votre email', 'error');
      return;
    }
    
    if (!serviceId || serviceId === "") {
      APIUtils.showNotification('Veuillez sélectionner un service', 'error');
      return;
    }
    
    if (!priority || priority === "") {
      APIUtils.showNotification('Veuillez sélectionner une priorité', 'error');
      return;
    }
    
    // Convertir service_id en entier
    const serviceIdInt = parseInt(serviceId);
    if (isNaN(serviceIdInt) || serviceIdInt <= 0) {
      APIUtils.showNotification('Service sélectionné invalide', 'error');
      return;
    }
    
    // Validation email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(patientEmail)) {
      APIUtils.showNotification('Format d\'email invalide', 'error');
      return;
    }
    
    // Convert time to datetime if provided
    let arrivalDateTime = null;
    if (estimatedArrival) {
      const today = new Date();
      const [hours, minutes] = estimatedArrival.split(':');
      arrivalDateTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 
                                parseInt(hours), parseInt(minutes));
      arrivalDateTime = arrivalDateTime.toISOString();
    }
    
    let response;
    
    // Check if user is authenticated - use different endpoints
    if (apiClient.isAuthenticated()) {
      // Use authenticated endpoint - ticket will be linked to user account
      const formData = {
        service_id: serviceIdInt,
        priority: priority,
        notes: notes,
        estimated_arrival: arrivalDateTime
      };
      
      console.log('Creating ticket for authenticated user:', formData);
      response = await apiClient.createTicket(formData);
    } else {
      // Use anonymous endpoint - creates temporary user
      const formData = {
        patient_name: patientName,
        patient_phone: patientPhone,
        patient_email: patientEmail,
        service_id: serviceIdInt,
        priority: priority
      };
      
      // Add optional fields if they exist
      if (arrivalDateTime) {
        formData.estimated_arrival = arrivalDateTime;
      }
      if (notes) {
        formData.notes = notes;
      }
      
      console.log('Joining queue as anonymous user:', formData);
      response = await apiClient.joinQueueOnline(formData);
    }
    
    if (response) {
      // Afficher la confirmation
      showConfirmationModal(response);
      
      // Clear form only if not authenticated (since fields are read-only for authenticated users)
      if (!apiClient.isAuthenticated()) {
        patientNameEl.value = '';
        patientPhoneEl.value = '';
        patientEmailEl.value = '';
        serviceSelectEl.value = '';
        if (prioritySelectEl) prioritySelectEl.value = '';
        if (estimatedArrivalEl) estimatedArrivalEl.value = '';
        if (notesEl) notesEl.value = '';
      } else {
        // Clear only editable fields for authenticated users
        serviceSelectEl.value = '';
        if (prioritySelectEl) prioritySelectEl.value = '';
        if (estimatedArrivalEl) estimatedArrivalEl.value = '';
        if (notesEl) notesEl.value = '';
      }
    }
    
  } catch (error) {
    console.error('Erreur lors de l\'ajout à la file:', error);
    APIUtils.showNotification(error.message || 'Erreur lors de l\'ajout à la file d\'attente', 'error');
  }
}

// Soumettre le code manuel
async function submitCode() {
  const code = document.getElementById('manualCode').value.trim();
  
  if (!code) {
    APIUtils.showNotification('Veuillez entrer un code', 'error');
    return;
  }
  
  // Traiter le code manuel comme un QR code scanné
  await processScannedCode(code);
}

// Afficher la modal de confirmation
function showConfirmationModal(ticketData) {
  // Mettre à jour les informations du ticket
  document.getElementById('ticketNumber').textContent = ticketData.ticket_number;
  document.getElementById('position').textContent = ticketData.position_in_queue;
  document.getElementById('estimatedTime').textContent = APIUtils.formatWaitTime(ticketData.estimated_wait_time);
  document.getElementById('serviceName').textContent = ticketData.service_name;
  
  // Afficher la modal
  const modal = document.getElementById('confirmationModal');
  modal.style.display = 'flex';
  
  // Auto-redirect vers la page de suivi après 5 secondes
  setTimeout(() => {
    window.location.href = '../tickets/ticket.html';
  }, 5000);
}

// Fermer la modal de confirmation
function closeModal() {
  const modal = document.getElementById('confirmationModal');
  if (modal) {
    modal.style.display = 'none';
  }
  
  // Retourner aux options
  showOptions();
}

// Aller à la page de suivi du ticket
function goToTicket() {
  const ticketNumber = document.getElementById('ticketNumber').textContent;
  window.location.href = `../tickets/ticket.html?ticket=${encodeURIComponent(ticketNumber)}`;
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

// Exposer les fonctions globalement
window.selectOption = selectOption;
window.showOptions = showOptions;
window.submitCode = submitCode;
window.closeModal = closeModal;
window.retryScanner = retryScanner;
window.closePatientModal = closePatientModal;
window.handleLogout = handleLogout;
