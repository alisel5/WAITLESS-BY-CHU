// Variables globales
let html5QrcodeScanner = null;
let html5QrCode = null;
let currentOption = null;
let isScanning = false;

// Initialisation de la page
document.addEventListener('DOMContentLoaded', function() {
  initializePage();
});

// Initialisation de la page
function initializePage() {
  // Afficher les options par défaut
  showOptions();
  
  // Initialiser les événements
  setupEventListeners();
  
  // Animation d'entrée
  animatePageLoad();
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
  
  // Définir l'heure d'arrivée par défaut (dans 30 minutes)
  const now = new Date();
  now.setMinutes(now.getMinutes() + 30);
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
  
  // Afficher le cadre de scan temporairement
  const scanFrame = document.querySelector('.qr-scan-frame');
  if (scanFrame) {
    scanFrame.style.display = 'block';
    // Masquer le cadre après 3 secondes
    setTimeout(() => {
      scanFrame.style.display = 'none';
    }, 3000);
  }
  
  // Initialiser le scanner après un délai
  setTimeout(() => {
    checkCameraAvailability();
    setTimeout(() => {
      initializeQRScanner();
    }, 1000);
  }, 800);
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
  
  // Vérifier si Html5QrcodeScanner est disponible
  if (typeof Html5QrcodeScanner !== 'undefined') {
    try {
      // Configuration optimisée pour la compatibilité
      const config = {
        fps: 10,
        qrbox: { width: 200, height: 200 },
        aspectRatio: 1.0,
        disableFlip: false,
        verbose: false,
        showTorchButtonIfSupported: true,
        showZoomSliderIfSupported: true,
        rememberLastUsedCamera: true,
        supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA]
      };
      
      html5QrcodeScanner = new Html5QrcodeScanner(
        "reader",
        config,
        false
      );
      
      html5QrcodeScanner.render(onScanSuccess, onScanFailure);
      console.log('Scanner QR initialisé avec succès');
      
      // Masquer le cadre de scan après l'initialisation
      setTimeout(() => {
        const scanFrame = document.querySelector('.qr-scan-frame');
        if (scanFrame) {
          scanFrame.style.display = 'none';
        }
      }, 1000);
      
    } catch (error) {
      console.error('Erreur lors de l\'initialisation du scanner:', error);
      showScannerError();
    }
  } else {
    console.error('Html5QrcodeScanner non disponible');
    showScannerError();
  }
}

// Afficher une erreur de scanner
function showScannerError() {
  const reader = document.getElementById('reader');
  if (reader) {
    reader.innerHTML = `
      <div class="scanner-error">
        <i class="fas fa-exclamation-triangle"></i>
        <h3>Scanner non disponible</h3>
        <p>Votre navigateur ne supporte pas le scanner de caméra.</p>
        <p>Veuillez utiliser la saisie manuelle ci-dessous.</p>
        <button class="retry-btn" onclick="retryScanner()">
          <i class="fas fa-redo"></i>
          Réessayer
        </button>
      </div>
    `;
  }
}

// Réessayer le scanner
function retryScanner() {
  console.log('Tentative de réinitialisation du scanner...');
  
  // Essayer avec une configuration plus simple
  const reader = document.getElementById('reader');
  if (reader) {
    reader.innerHTML = '';
    
    if (typeof Html5QrcodeScanner !== 'undefined') {
      try {
        const simpleConfig = {
          fps: 10,
          qrbox: { width: 150, height: 150 },
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
      } catch (error) {
        console.error('Erreur lors de la réinitialisation:', error);
        showScannerError();
      }
    } else {
      showScannerError();
    }
  }
}

// Vérifier la disponibilité de la caméra
function checkCameraAvailability() {
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
      })
      .catch(function(err) {
        console.error('Caméra non disponible:', err);
        // Ne pas afficher d'erreur immédiatement, laisser le scanner essayer
        console.log('Tentative de scanner sans vérification préalable...');
      });
  } else {
    console.error('getUserMedia non supporté');
    // Ne pas afficher d'erreur immédiatement
  }
}

// Succès du scan QR
function onScanSuccess(decodedText, decodedResult) {
  console.log('QR Code détecté:', decodedText);
  
  // Arrêter le scanner
  stopQRScanner();
  
  // Traiter le code scanné
  processScannedCode(decodedText);
}

// Échec du scan QR
function onScanFailure(error) {
  // Ne pas afficher d'erreur pour les échecs normaux de scan
  // console.log('Scan en cours...', error);
}

// Traiter le code scanné
function processScannedCode(code) {
  // Simuler le traitement du code
  console.log('Code scanné:', code);
  
  // Générer un ticket basé sur le code
  const ticketData = generateTicketFromCode(code);
  
  // Afficher la confirmation
  showConfirmationModal(ticketData);
}

// Générer un ticket à partir du code
function generateTicketFromCode(code) {
  const services = {
    'CARD': 'Cardiologie',
    'DERM': 'Dermatologie',
    'NEUR': 'Neurologie',
    'PED': 'Pédiatrie',
    'ORTH': 'Orthopédie',
    'RAD': 'Radiologie',
    'URG': 'Urgences'
  };
  
  // Extraire les informations du code (simulation)
  const serviceCode = code.substring(0, 4);
  const service = services[serviceCode] || 'Service Général';
  const position = Math.floor(Math.random() * 20) + 1;
  const waitTime = Math.floor(Math.random() * 30) + 10;
  
  return {
    ticketNumber: `T-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`,
    position: position,
    estimatedTime: waitTime,
    service: service,
    method: 'QR Code'
  };
}

// Rejoindre la queue en ligne
function joinQueueOnline() {
  // Récupérer les données du formulaire
  const formData = {
    name: document.getElementById('patientName').value,
    phone: document.getElementById('patientPhone').value,
    service: document.getElementById('serviceSelect').value,
    priority: document.getElementById('prioritySelect').value,
    estimatedArrival: document.getElementById('estimatedArrival').value,
    notes: document.getElementById('notes').value
  };
  
  // Validation basique
  if (!formData.name || !formData.phone || !formData.service || !formData.priority || !formData.estimatedArrival) {
    showNotification('Veuillez remplir tous les champs obligatoires', 'error');
    return;
  }
  
  // Simuler l'envoi des données
  console.log('Données du formulaire:', formData);
  
  // Générer un ticket
  const ticketData = generateTicketFromOnlineForm(formData);
  
  // Afficher la confirmation
  showConfirmationModal(ticketData);
}

// Générer un ticket à partir du formulaire en ligne
function generateTicketFromOnlineForm(formData) {
  const serviceNames = {
    'cardiology': 'Cardiologie',
    'dermatology': 'Dermatologie',
    'neurology': 'Neurologie',
    'pediatrics': 'Pédiatrie',
    'orthopedics': 'Orthopédie',
    'radiology': 'Radiologie',
    'emergency': 'Urgences'
  };
  
  const position = Math.floor(Math.random() * 15) + 1;
  const waitTime = Math.floor(Math.random() * 25) + 15;
  
  return {
    ticketNumber: `T-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`,
    position: position,
    estimatedTime: waitTime,
    service: serviceNames[formData.service] || formData.service,
    method: 'En ligne',
    patientName: formData.name,
    phone: formData.phone
  };
}

// Soumettre le code manuel
function submitCode() {
  const code = document.getElementById('manualCode').value.trim();
  
  if (!code) {
    showNotification('Veuillez entrer un code', 'error');
    return;
  }
  
  // Traiter le code manuel
  processScannedCode(code);
}

// Afficher la modal de confirmation
function showConfirmationModal(ticketData) {
  // Mettre à jour les informations du ticket
  document.getElementById('ticketNumber').textContent = ticketData.ticketNumber;
  document.getElementById('position').textContent = ticketData.position;
  document.getElementById('estimatedTime').textContent = ticketData.estimatedTime + ' minutes';
  document.getElementById('serviceName').textContent = ticketData.service;
  
  // Afficher la modal
  const modal = document.getElementById('confirmationModal');
  modal.style.display = 'flex';
  
  // Animation d'entrée
  modal.style.opacity = '0';
  setTimeout(() => {
    modal.style.opacity = '1';
  }, 100);
  
  // Sauvegarder les données du ticket
  saveTicketData(ticketData);
}

// Fermer la modal
function closeModal() {
  const modal = document.getElementById('confirmationModal');
  modal.style.opacity = '0';
  
  setTimeout(() => {
    modal.style.display = 'none';
  }, 300);
}

// Aller à la page du ticket
function goToTicket() {
  // Sauvegarder l'ID du ticket dans localStorage
  const ticketNumber = document.getElementById('ticketNumber').textContent;
  localStorage.setItem('currentTicket', ticketNumber);
  
  // Rediriger vers la page du ticket
  window.location.href = '../tickets/ticket.html';
}

// Sauvegarder les données du ticket
function saveTicketData(ticketData) {
  // Sauvegarder dans localStorage pour la persistance
  const tickets = JSON.parse(localStorage.getItem('tickets') || '[]');
  tickets.push({
    ...ticketData,
    createdAt: new Date().toISOString(),
    status: 'waiting'
  });
  localStorage.setItem('tickets', JSON.stringify(tickets));
  
  // Sauvegarder le ticket actuel
  localStorage.setItem('currentTicket', ticketData.ticketNumber);
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

// Validation du formulaire
function validateForm() {
  const requiredFields = [
    'patientName',
    'patientPhone',
    'serviceSelect',
    'prioritySelect',
    'estimatedArrival'
  ];
  
  let isValid = true;
  
  requiredFields.forEach(fieldId => {
    const field = document.getElementById(fieldId);
    if (!field.value.trim()) {
      field.style.borderColor = '#dc3545';
      isValid = false;
    } else {
      field.style.borderColor = '#e1e5e9';
    }
  });
  
  return isValid;
}

// Validation du numéro de téléphone
function validatePhone(phone) {
  const phoneRegex = /^(06|07|05)\d{8}$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
}

// Formatage automatique du numéro de téléphone
function formatPhoneNumber(input) {
  let value = input.value.replace(/\D/g, '');
  
  if (value.length >= 2) {
    value = value.substring(0, 2) + ' ' + value.substring(2);
  }
  
  if (value.length >= 6) {
    value = value.substring(0, 6) + ' ' + value.substring(6);
  }
  
  if (value.length >= 9) {
    value = value.substring(0, 9) + ' ' + value.substring(9);
  }
  
  input.value = value.substring(0, 14);
}

// Configuration du formatage automatique
document.addEventListener('DOMContentLoaded', function() {
  const phoneInput = document.getElementById('patientPhone');
  if (phoneInput) {
    phoneInput.addEventListener('input', function() {
      formatPhoneNumber(this);
    });
  }
});

// Gestion des erreurs
window.addEventListener('error', function(e) {
  console.error('Erreur JavaScript:', e.error);
  showNotification('Une erreur est survenue. Veuillez réessayer.', 'error');
});

// Nettoyage lors de la fermeture de la page
window.addEventListener('beforeunload', function() {
  stopQRScanner();
});

// Gestion de la visibilité de la page
document.addEventListener('visibilitychange', function() {
  if (document.hidden) {
    stopQRScanner();
  } else if (currentOption === 'qr') {
    setTimeout(() => {
      initializeQRScanner();
    }, 1000);
  }
});
