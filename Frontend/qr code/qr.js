// Variables globales
let html5QrcodeScanner = null;
let html5QrCode = null;
let currentOption = null;
let isScanning = false;
let availableServices = [];

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
  
  // Diagnostic et initialisation du scanner
  setTimeout(() => {
    diagnoseCameraIssues();
    initializeQRScanner();
  }, 600);
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
  
  // Essayer plusieurs configurations
  tryScannerWithConfig({
    fps: 10,
    qrbox: { width: 200, height: 200 },
    aspectRatio: 1.0,
    disableFlip: false,
    verbose: false
  });
}

// Essayer le scanner avec une configuration spécifique
function tryScannerWithConfig(config, attempt = 1) {
  const reader = document.getElementById('reader');
  
  if (!reader) return;
  
  console.log(`Tentative ${attempt} avec config:`, config);
  
  try {
    html5QrcodeScanner = new Html5QrcodeScanner(
      "reader",
      config,
      false
    );
    
    setTimeout(() => {
      try {
        html5QrcodeScanner.render(onScanSuccess, onScanFailure);
        console.log('Scanner QR initialisé avec succès');
        isScanning = true;
        
        // Masquer l'overlay une fois le scanner initialisé
        const overlay = document.querySelector('.qr-overlay');
        if (overlay) {
          overlay.style.display = 'none';
        }
        
      } catch (renderError) {
        console.error('Erreur lors du rendu du scanner:', renderError);
        
        // Essayer une configuration plus simple si c'est la première tentative
        if (attempt === 1) {
          console.log('Tentative avec configuration simplifiée...');
          tryScannerWithConfig({
            fps: 5,
            qrbox: { width: 150, height: 150 },
            aspectRatio: 1.0,
            disableFlip: false,
            verbose: false
          }, 2);
        } else {
          showScannerError('Impossible d\'initialiser la caméra. Veuillez vérifier les permissions et réessayer.');
        }
      }
    }, 200);
    
  } catch (error) {
    console.error('Erreur lors de l\'initialisation du scanner:', error);
    
    if (attempt === 1) {
      // Essayer une configuration encore plus simple
      tryScannerWithConfig({
        fps: 1,
        qrbox: { width: 100, height: 100 },
        aspectRatio: 1.0,
        disableFlip: false,
        verbose: false
      }, 2);
    } else {
      showScannerError('Impossible d\'initialiser le scanner QR. Veuillez vérifier les permissions de caméra.');
    }
  }
}

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
            <li>Autorisez l'accès à la caméra dans votre navigateur</li>
            <li>Utilisez HTTPS (requis pour la caméra)</li>
            <li>Vérifiez que votre caméra fonctionne</li>
            <li>Essayez un autre navigateur (Chrome recommandé)</li>
            <li>Rechargez la page (F5)</li>
          </ul>
        </div>
        <p>En attendant, utilisez la saisie manuelle ci-dessous.</p>
        <button class="retry-btn" onclick="retryScanner()">
          <i class="fas fa-redo"></i>
          Réessayer
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
  
  // Arrêter le scanner actuel s'il existe
  stopQRScanner();
  
  const reader = document.getElementById('reader');
  if (reader) {
    reader.innerHTML = '';
    
    // Afficher un message de chargement
    reader.innerHTML = `
      <div class="scanner-loading">
        <i class="fas fa-spinner fa-spin"></i>
        <p>Initialisation de la caméra...</p>
      </div>
    `;
    
    // Attendre un peu avant de réinitialiser
    setTimeout(() => {
      if (typeof Html5QrcodeScanner !== 'undefined') {
        try {
          const simpleConfig = {
            fps: 10,
            qrbox: { width: 200, height: 200 },
            aspectRatio: 1.0,
            disableFlip: false,
            verbose: false
          };
          
          html5QrcodeScanner = new Html5QrcodeScanner(
            "reader",
            simpleConfig,
            false
          );
          
          html5QrcodeScanner.render(onScanSuccess, onScanFailure);
          console.log('Scanner QR réinitialisé avec configuration simple');
          isScanning = true;
          
          // Masquer l'overlay une fois le scanner initialisé
          const overlay = document.querySelector('.qr-overlay');
          if (overlay) {
            overlay.style.display = 'none';
          }
          
        } catch (error) {
          console.error('Erreur lors de la réinitialisation:', error);
          showScannerError('Erreur lors de la réinitialisation du scanner. Veuillez recharger la page.');
        }
      } else {
        showScannerError('Bibliothèque de scan non disponible. Veuillez recharger la page.');
      }
    }, 1000);
  }
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
      // C'est un QR code de service - demander les informations du patient
      showPatientInfoModal(qrData, scanResponse);
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

// Afficher le modal pour les informations du patient
function showPatientInfoModal(qrData, scanResponse) {
  // Créer et afficher un modal pour collecter les informations du patient
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal">
      <h2>Rejoindre la file d'attente</h2>
      <p><strong>Service:</strong> ${scanResponse.service_name}</p>
      <p><strong>Localisation:</strong> ${scanResponse.location}</p>
      <form id="patientInfoForm">
        <input type="text" id="patientName" placeholder="Nom complet" required>
        <input type="tel" id="patientPhone" placeholder="Téléphone" required>
        <input type="email" id="patientEmail" placeholder="Email" required>
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
    
    // Appeler l'API scan-to-join
    const joinResponse = await apiClient.scanToJoin(qrData, patientData);
    
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
    
    console.log('Sending data:', formData);
    
    // Appeler l'API pour rejoindre la file en ligne
    const response = await apiClient.joinQueueOnline(formData);
    
    if (response) {
      // Afficher la confirmation
      showConfirmationModal(response);
      
      // Clear form
      patientNameEl.value = '';
      patientPhoneEl.value = '';
      patientEmailEl.value = '';
      serviceSelectEl.value = '';
      if (prioritySelectEl) prioritySelectEl.value = '';
      if (estimatedArrivalEl) estimatedArrivalEl.value = '';
      if (notesEl) notesEl.value = '';
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
