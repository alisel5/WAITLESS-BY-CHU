// Variables globales
let currentTicket = null;
let ticketsHistory = [];

// Initialisation de la page
document.addEventListener('DOMContentLoaded', function() {
  initializePage();
  setupEventListeners();
  loadTicketsHistory();
  setDefaultDates();
});

// Initialiser la page
function initializePage() {
  console.log('Page de génération de tickets initialisée');
  
  // Animation d'entrée
  animatePageLoad();
  
  // Charger les données de test
  loadSampleData();
}

// Configurer les écouteurs d'événements
function setupEventListeners() {
  // Formulaire de génération
  const ticketForm = document.getElementById('ticketForm');
  if (ticketForm) {
    ticketForm.addEventListener('submit', handleTicketGeneration);
  }
  
  // Recherche et filtres
  const searchInput = document.getElementById('searchTickets');
  if (searchInput) {
    searchInput.addEventListener('input', filterTickets);
  }
  
  const filterService = document.getElementById('filterService');
  if (filterService) {
    filterService.addEventListener('change', filterTickets);
  }
  
  // Mise à jour en temps réel de l'aperçu
  const formInputs = document.querySelectorAll('#ticketForm input, #ticketForm select, #ticketForm textarea');
  formInputs.forEach(input => {
    input.addEventListener('input', updatePreview);
    input.addEventListener('change', updatePreview);
  });
}

// Animation de chargement de la page
function animatePageLoad() {
  const elements = document.querySelectorAll('.tickets-header, .tickets-content, .tickets-history');
  elements.forEach((element, index) => {
    element.style.opacity = '0';
    element.style.transform = 'translateY(30px)';
    
    setTimeout(() => {
      element.style.transition = 'all 0.8s ease-out';
      element.style.opacity = '1';
      element.style.transform = 'translateY(0)';
    }, index * 200);
  });
}

// Initialiser les valeurs par défaut
function setDefaultDates() {
  // Pas besoin de dates par défaut pour les tickets QR
  console.log('Valeurs par défaut initialisées');
}

// Charger les données de test
function loadSampleData() {
  ticketsHistory = [
    {
      id: 1,
      number: 'T-2025-001',
      service: 'Cardiologie',
      ticketType: 'Standard',
      generatedDate: '15/01/2025',
      generatedTime: '09:30',
      status: 'active',
      priority: 'Normale'
    },
    {
      id: 2,
      number: 'T-2025-002',
      service: 'Dermatologie',
      ticketType: 'Prioritaire',
      generatedDate: '15/01/2025',
      generatedTime: '10:15',
      status: 'completed',
      priority: 'Urgente'
    },
    {
      id: 3,
      number: 'T-2025-003',
      service: 'Neurologie',
      ticketType: 'Standard',
      generatedDate: '15/01/2025',
      generatedTime: '11:00',
      status: 'active',
      priority: 'Normale'
    }
  ];
  
  renderTicketsTable();
}

// Gérer la génération de ticket
function handleTicketGeneration(event) {
  event.preventDefault();
  
  // Récupérer les données du formulaire
  const formData = {
    service: document.getElementById('serviceSelect').value,
    priority: document.getElementById('prioritySelect').value,
    quantity: parseInt(document.getElementById('quantityTickets').value),
    ticketType: document.getElementById('ticketType').value,
    notes: document.getElementById('notes').value
  };
  
  // Validation
  if (!validateForm(formData)) {
    return;
  }
  
  // Générer les tickets
  const tickets = generateTickets(formData);
  currentTicket = tickets[0]; // Pour l'aperçu
  
  // Afficher la confirmation
  showConfirmationModal(tickets);
  
  // Ajouter à l'historique
  tickets.forEach(ticket => addTicketToHistory(ticket));
  
  // Réinitialiser le formulaire
  resetForm();
}

// Valider le formulaire
function validateForm(formData) {
  if (!formData.service) {
    showNotification('Veuillez sélectionner un service', 'error');
    return false;
  }
  
  if (formData.quantity < 1 || formData.quantity > 50) {
    showNotification('Le nombre de tickets doit être entre 1 et 50', 'error');
    return false;
  }
  
  return true;
}

// Valider le téléphone
function validatePhone(phone) {
  const phoneRegex = /^(06|07|05)\d{8}$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
}

// Générer des tickets
function generateTickets(formData) {
  const tickets = [];
  const serviceNames = {
    'cardiology': 'Cardiologie',
    'dermatology': 'Dermatologie',
    'neurology': 'Neurologie',
    'pediatrics': 'Pédiatrie',
    'orthopedics': 'Orthopédie',
    'radiology': 'Radiologie',
    'emergency': 'Urgences',
    'ophthalmology': 'Ophtalmologie',
    'dental': 'Dentisterie'
  };
  
  const ticketTypeNames = {
    'standard': 'Standard',
    'priority': 'Prioritaire',
    'emergency': 'Urgence'
  };
  
  for (let i = 0; i < formData.quantity; i++) {
    const ticketNumber = generateTicketNumber();
    const now = new Date();
    
    tickets.push({
      id: Date.now() + i,
      number: ticketNumber,
      service: serviceNames[formData.service] || formData.service,
      serviceCode: formData.service,
      ticketType: ticketTypeNames[formData.ticketType] || formData.ticketType,
      priority: formData.priority,
      notes: formData.notes,
      status: 'active',
      createdAt: now.toISOString(),
      generatedDate: now.toLocaleDateString('fr-FR'),
      generatedTime: now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      qrCode: generateQRCodeData(ticketNumber, formData.service)
    });
  }
  
  return tickets;
}

// Générer un numéro de ticket
function generateTicketNumber() {
  const year = new Date().getFullYear();
  const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `T-${year}-${randomNum}`;
}

// Générer les données du QR code
function generateQRCodeData(ticketNumber, serviceCode) {
  // Format: TICKET_NUMBER|SERVICE_CODE|TIMESTAMP
  const timestamp = Date.now();
  return `${ticketNumber}|${serviceCode}|${timestamp}`;
}

// Afficher l'aperçu du ticket
function previewTicket() {
  const formData = {
    service: document.getElementById('serviceSelect').value || 'Service médical',
    priority: document.getElementById('prioritySelect').value || 'Normale',
    ticketType: document.getElementById('ticketType').value || 'Standard'
  };
  
  updatePreviewDisplay(formData);
}

// Mettre à jour l'aperçu
function updatePreview() {
  previewTicket();
}

// Mettre à jour l'affichage de l'aperçu
function updatePreviewDisplay(formData) {
  const serviceNames = {
    'cardiology': 'Cardiologie',
    'dermatology': 'Dermatologie',
    'neurology': 'Neurologie',
    'pediatrics': 'Pédiatrie',
    'orthopedics': 'Orthopédie',
    'radiology': 'Radiologie',
    'emergency': 'Urgences',
    'ophthalmology': 'Ophtalmologie',
    'dental': 'Dentisterie'
  };
  
  const ticketTypeNames = {
    'standard': 'Standard',
    'priority': 'Prioritaire',
    'emergency': 'Urgence'
  };
  
  const now = new Date();
  
  // Mettre à jour les valeurs dans l'aperçu
  document.getElementById('previewNumber').textContent = generateTicketNumber();
  document.getElementById('previewService').textContent = serviceNames[formData.service] || formData.service;
  document.getElementById('previewType').textContent = ticketTypeNames[formData.ticketType] || formData.ticketType;
  document.getElementById('previewPriority').textContent = formData.priority;
  document.getElementById('previewDate').textContent = now.toLocaleDateString('fr-FR');
  document.getElementById('previewTime').textContent = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

// Afficher la modal de confirmation
function showConfirmationModal(tickets) {
  const ticket = tickets[0]; // Premier ticket pour l'affichage
  document.getElementById('modalTicketNumber').textContent = tickets.length > 1 ? `${tickets.length} tickets générés` : ticket.number;
  document.getElementById('modalPatientName').textContent = tickets.length > 1 ? `Du ${tickets[0].number} au ${tickets[tickets.length-1].number}` : 'Ticket unique';
  document.getElementById('modalService').textContent = ticket.service;
  
  const modal = document.getElementById('confirmationModal');
  modal.style.display = 'flex';
  
  // Animation d'entrée
  setTimeout(() => {
    modal.style.opacity = '1';
  }, 10);
}

// Fermer la modal
function closeModal() {
  const modal = document.getElementById('confirmationModal');
  modal.style.opacity = '0';
  
  setTimeout(() => {
    modal.style.display = 'none';
  }, 300);
}

// Imprimer le ticket
function printTicket() {
  if (!currentTicket) {
    showNotification('Aucun ticket à imprimer', 'error');
    return;
  }
  
  // Essayer d'utiliser jsPDF si disponible
  if (typeof window.jsPDF !== 'undefined') {
    generatePDFWithJsPDF();
  } else {
    // Fallback vers l'impression classique
    printWithWindow();
  }
}

// Générer PDF avec jsPDF
function generatePDFWithJsPDF() {
  try {
    const { jsPDF } = window.jsPDF;
    const doc = new jsPDF();
    
    // Titre
    doc.setFontSize(20);
    doc.setTextColor(74, 144, 226);
    doc.text('WaitLess CHU', 105, 20, { align: 'center' });
    
    doc.setFontSize(14);
    doc.setTextColor(100, 100, 100);
    doc.text('Ticket de Consultation', 105, 30, { align: 'center' });
    
    // Informations du ticket
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    
    const startY = 50;
    const lineHeight = 8;
    let currentY = startY;
    
    // Numéro de ticket
    doc.setFontSize(14);
    doc.setTextColor(74, 144, 226);
    doc.text(`Numéro: ${currentTicket.number}`, 20, currentY);
    currentY += lineHeight + 5;
    
    // Informations patient
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(`Patient: ${currentTicket.patientName}`, 20, currentY);
    currentY += lineHeight;
    
    if (currentTicket.patientPhone) {
      doc.text(`Téléphone: ${currentTicket.patientPhone}`, 20, currentY);
      currentY += lineHeight;
    }
    
    doc.text(`Service: ${currentTicket.service}`, 20, currentY);
    currentY += lineHeight;
    
    doc.text(`Priorité: ${currentTicket.priority}`, 20, currentY);
    currentY += lineHeight;
    
    if (currentTicket.appointmentDate) {
      const formattedDate = new Date(currentTicket.appointmentDate).toLocaleDateString('fr-FR');
      doc.text(`Date: ${formattedDate}`, 20, currentY);
      currentY += lineHeight;
    }
    
    if (currentTicket.appointmentTime) {
      doc.text(`Heure: ${currentTicket.appointmentTime}`, 20, currentY);
      currentY += lineHeight;
    }
    
    // QR Code placeholder
    currentY += 10;
    doc.rect(120, startY, 60, 60);
    doc.setTextColor(74, 144, 226);
    doc.setFontSize(8);
    doc.text('QR Code', 150, startY + 30, { align: 'center' });
    doc.text(currentTicket.qrCode, 150, startY + 40, { align: 'center' });
    
    // Instructions
    currentY += 20;
    doc.setFontSize(10);
    doc.setTextColor(74, 144, 226);
    doc.text('Instructions:', 20, currentY);
    currentY += lineHeight;
    
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.text('• Présentez ce ticket à l\'accueil', 20, currentY);
    currentY += lineHeight;
    doc.text('• Scannez le QR code pour suivre votre position', 20, currentY);
    currentY += lineHeight;
    doc.text('• Vous recevrez une notification 3 places avant votre tour', 20, currentY);
    
    // Sauvegarder le PDF
    doc.save(`ticket_${currentTicket.number}.pdf`);
    
    showNotification('PDF généré avec succès', 'success');
    
  } catch (error) {
    console.error('Erreur lors de la génération PDF:', error);
    // Fallback vers l'impression classique
    printWithWindow();
  }
}

// Impression classique avec fenêtre
function printWithWindow() {
  try {
    // Créer le contenu du ticket pour l'impression
    const ticketContent = createTicketForPrint(currentTicket);
    
    // Créer une nouvelle fenêtre pour l'impression
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    
    if (!printWindow) {
      showNotification('Veuillez autoriser les popups pour imprimer', 'error');
      return;
    }
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Ticket ${currentTicket.number}</title>
        <meta charset="UTF-8">
        <style>
          @page {
            size: A4;
            margin: 10mm;
          }
          body {
            font-family: 'Arial', sans-serif;
            margin: 0;
            padding: 20px;
            background: white;
            font-size: 12px;
          }
          .ticket-print {
            max-width: 400px;
            margin: 0 auto;
            border: 2px solid #4A90E2;
            border-radius: 15px;
            padding: 20px;
            position: relative;
            background: white;
          }
          .ticket-print::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 4px;
            background: #4A90E2;
          }
          .ticket-header {
            display: flex;
            align-items: center;
            gap: 15px;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 2px dashed #ccc;
          }
          .ticket-logo {
            width: 50px;
            height: 50px;
            object-fit: contain;
          }
          .ticket-title h3 {
            color: #4A90E2;
            margin: 0 0 5px 0;
            font-size: 18px;
          }
          .ticket-title p {
            margin: 0;
            color: #666;
            font-size: 14px;
          }
          .ticket-content {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 20px;
          }
          .ticket-info {
            display: flex;
            flex-direction: column;
            gap: 10px;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            padding: 5px 0;
            border-bottom: 1px solid #f0f0f0;
          }
          .info-row:last-child {
            border-bottom: none;
          }
          .label {
            font-weight: bold;
            color: #4A90E2;
            font-size: 12px;
          }
          .value {
            font-weight: 500;
            font-size: 12px;
          }
          .qr-section {
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .qr-code {
            width: 100px;
            height: 100px;
            border: 2px solid #4A90E2;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #f8f9fa;
            font-size: 10px;
            text-align: center;
            color: #4A90E2;
            word-break: break-all;
          }
          .ticket-footer {
            padding-top: 15px;
            border-top: 2px dashed #ccc;
          }
          .ticket-footer p {
            font-weight: bold;
            color: #4A90E2;
            margin-bottom: 10px;
            font-size: 12px;
          }
          .ticket-footer ul {
            margin: 0;
            padding-left: 20px;
          }
          .ticket-footer li {
            font-size: 10px;
            color: #666;
            margin-bottom: 5px;
          }
          @media print {
            body {
              margin: 0;
              padding: 10px;
            }
            .ticket-print {
              box-shadow: none;
              border: 2px solid #000;
              page-break-inside: avoid;
            }
            .no-print {
              display: none !important;
            }
          }
          .print-button {
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4A90E2;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
          }
          .print-button:hover {
            background: #357ABD;
          }
        </style>
      </head>
      <body>
        <button class="print-button no-print" onclick="window.print()">
          🖨️ Imprimer le Ticket
        </button>
        ${ticketContent}
        <script>
          // Auto-print après chargement
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 500);
          };
        </script>
      </body>
      </html>
    `);
    
    printWindow.document.close();
    
    closeModal();
    showNotification('Fenêtre d\'impression ouverte', 'success');
    
  } catch (error) {
    console.error('Erreur lors de l\'impression:', error);
    showNotification('Erreur lors de l\'impression', 'error');
  }
}

// Créer le contenu du ticket pour l'impression
function createTicketForPrint(ticket) {
  const serviceNames = {
    'cardiology': 'Cardiologie',
    'dermatology': 'Dermatologie',
    'neurology': 'Neurologie',
    'pediatrics': 'Pédiatrie',
    'orthopedics': 'Orthopédie',
    'radiology': 'Radiologie',
    'emergency': 'Urgences',
    'ophthalmology': 'Ophtalmologie',
    'dental': 'Dentisterie'
  };
  
  const formattedDate = ticket.appointmentDate ? new Date(ticket.appointmentDate).toLocaleDateString('fr-FR') : '--/--/----';
  
  return `
    <div class="ticket-print">
      <div class="ticket-header">
        <img src="../Acceuil/public/logofinal.png" alt="WaitLess Logo" class="ticket-logo">
        <div class="ticket-title">
          <h3>WaitLess CHU</h3>
          <p>Ticket de Consultation</p>
        </div>
      </div>
      
      <div class="ticket-content">
        <div class="ticket-info">
          <div class="info-row">
            <span class="label">Numéro:</span>
            <span class="value">${ticket.number}</span>
          </div>
          <div class="info-row">
            <span class="label">Patient:</span>
            <span class="value">${ticket.patientName}</span>
          </div>
          <div class="info-row">
            <span class="label">Service:</span>
            <span class="value">${serviceNames[ticket.serviceCode] || ticket.service}</span>
          </div>
          <div class="info-row">
            <span class="label">Priorité:</span>
            <span class="value">${ticket.priority}</span>
          </div>
          <div class="info-row">
            <span class="label">Date:</span>
            <span class="value">${formattedDate}</span>
          </div>
          <div class="info-row">
            <span class="label">Heure:</span>
            <span class="value">${ticket.appointmentTime || '--:--'}</span>
          </div>
        </div>
        
        <div class="qr-section">
          <div class="qr-code">
            QR Code<br>
            ${ticket.qrCode}
          </div>
        </div>
      </div>
      
      <div class="ticket-footer">
        <p>Instructions:</p>
        <ul>
          <li>Présentez ce ticket à l'accueil</li>
          <li>Scannez le QR code pour suivre votre position</li>
          <li>Vous recevrez une notification 3 places avant votre tour</li>
        </ul>
      </div>
    </div>
  `;
}

// Ajouter le ticket à l'historique
function addTicketToHistory(ticket) {
  ticketsHistory.unshift(ticket);
  renderTicketsTable();
  saveTicketsToStorage();
}

// Charger l'historique des tickets
function loadTicketsHistory() {
  const saved = localStorage.getItem('ticketsHistory');
  if (saved) {
    try {
      ticketsHistory = JSON.parse(saved);
      renderTicketsTable();
    } catch (error) {
      console.error('Erreur lors du chargement de l\'historique:', error);
    }
  }
}

// Sauvegarder les tickets
function saveTicketsToStorage() {
  try {
    localStorage.setItem('ticketsHistory', JSON.stringify(ticketsHistory));
  } catch (error) {
    console.error('Erreur lors de la sauvegarde:', error);
  }
}

// Rendre le tableau des tickets
function renderTicketsTable() {
  const tbody = document.getElementById('ticketsTableBody');
  if (!tbody) return;
  
  tbody.innerHTML = '';
  
  ticketsHistory.forEach(ticket => {
    const row = document.createElement('tr');
    
    const statusClass = ticket.status === 'active' ? 'status-active' : 
                       ticket.status === 'completed' ? 'status-completed' : 'status-cancelled';
    
    const statusText = ticket.status === 'active' ? 'Actif' : 
                      ticket.status === 'completed' ? 'Terminé' : 'Annulé';
    
    row.innerHTML = `
      <td><strong>${ticket.number}</strong></td>
      <td>${ticket.patientName}</td>
      <td>${ticket.service}</td>
      <td>${ticket.appointmentDate ? new Date(ticket.appointmentDate).toLocaleDateString('fr-FR') : '--'}</td>
      <td><span class="status-badge ${statusClass}">${statusText}</span></td>
      <td>
        <div class="action-buttons">
          <button class="action-btn action-btn-view" onclick="viewTicket(${ticket.id})">
            <i class="fas fa-eye"></i>
          </button>
          <button class="action-btn action-btn-print" onclick="reprintTicket(${ticket.id})">
            <i class="fas fa-print"></i>
          </button>
        </div>
      </td>
    `;
    
    tbody.appendChild(row);
  });
}

// Voir un ticket
function viewTicket(ticketId) {
  const ticket = ticketsHistory.find(t => t.id === ticketId);
  if (ticket) {
    currentTicket = ticket;
    showConfirmationModal(ticket);
  }
}

// Réimprimer un ticket
function reprintTicket(ticketId) {
  const ticket = ticketsHistory.find(t => t.id === ticketId);
  if (ticket) {
    currentTicket = ticket;
    printTicket();
  }
}

// Télécharger le ticket en PDF (alternative)
function downloadTicketPDF() {
  if (!currentTicket) {
    showNotification('Aucun ticket à télécharger', 'error');
    return;
  }
  
  try {
    // Créer le contenu du ticket
    const ticketContent = createTicketForPrint(currentTicket);
    
    // Créer un blob avec le contenu HTML
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Ticket ${currentTicket.number}</title>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: 'Arial', sans-serif;
            margin: 0;
            padding: 20px;
            background: white;
            font-size: 12px;
          }
          .ticket-print {
            max-width: 400px;
            margin: 0 auto;
            border: 2px solid #4A90E2;
            border-radius: 15px;
            padding: 20px;
            position: relative;
            background: white;
          }
          .ticket-print::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 4px;
            background: #4A90E2;
          }
          .ticket-header {
            display: flex;
            align-items: center;
            gap: 15px;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 2px dashed #ccc;
          }
          .ticket-logo {
            width: 50px;
            height: 50px;
            object-fit: contain;
          }
          .ticket-title h3 {
            color: #4A90E2;
            margin: 0 0 5px 0;
            font-size: 18px;
          }
          .ticket-title p {
            margin: 0;
            color: #666;
            font-size: 14px;
          }
          .ticket-content {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 20px;
          }
          .ticket-info {
            display: flex;
            flex-direction: column;
            gap: 10px;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            padding: 5px 0;
            border-bottom: 1px solid #f0f0f0;
          }
          .info-row:last-child {
            border-bottom: none;
          }
          .label {
            font-weight: bold;
            color: #4A90E2;
            font-size: 12px;
          }
          .value {
            font-weight: 500;
            font-size: 12px;
          }
          .qr-section {
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .qr-code {
            width: 100px;
            height: 100px;
            border: 2px solid #4A90E2;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #f8f9fa;
            font-size: 10px;
            text-align: center;
            color: #4A90E2;
            word-break: break-all;
          }
          .ticket-footer {
            padding-top: 15px;
            border-top: 2px dashed #ccc;
          }
          .ticket-footer p {
            font-weight: bold;
            color: #4A90E2;
            margin-bottom: 10px;
            font-size: 12px;
          }
          .ticket-footer ul {
            margin: 0;
            padding-left: 20px;
          }
          .ticket-footer li {
            font-size: 10px;
            color: #666;
            margin-bottom: 5px;
          }
        </style>
      </head>
      <body>
        ${ticketContent}
      </body>
      </html>
    `;
    
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    
    // Créer un lien de téléchargement
    const link = document.createElement('a');
    link.href = url;
    link.download = `ticket_${currentTicket.number}.html`;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Nettoyer l'URL
    URL.revokeObjectURL(url);
    
    showNotification('Ticket téléchargé en HTML', 'success');
    
  } catch (error) {
    console.error('Erreur lors du téléchargement:', error);
    showNotification('Erreur lors du téléchargement', 'error');
  }
}

// Filtrer les tickets
function filterTickets() {
  const searchTerm = document.getElementById('searchTickets').value.toLowerCase();
  const serviceFilter = document.getElementById('filterService').value;
  
  const filteredTickets = ticketsHistory.filter(ticket => {
    const matchesSearch = ticket.patientName.toLowerCase().includes(searchTerm) ||
                         ticket.number.toLowerCase().includes(searchTerm);
    const matchesService = !serviceFilter || ticket.serviceCode === serviceFilter;
    
    return matchesSearch && matchesService;
  });
  
  renderFilteredTickets(filteredTickets);
}

// Rendre les tickets filtrés
function renderFilteredTickets(filteredTickets) {
  const tbody = document.getElementById('ticketsTableBody');
  if (!tbody) return;
  
  tbody.innerHTML = '';
  
  filteredTickets.forEach(ticket => {
    const row = document.createElement('tr');
    
    const statusClass = ticket.status === 'active' ? 'status-active' : 
                       ticket.status === 'completed' ? 'status-completed' : 'status-cancelled';
    
    const statusText = ticket.status === 'active' ? 'Actif' : 
                      ticket.status === 'completed' ? 'Terminé' : 'Annulé';
    
    row.innerHTML = `
      <td><strong>${ticket.number}</strong></td>
      <td>${ticket.patientName}</td>
      <td>${ticket.service}</td>
      <td>${ticket.appointmentDate ? new Date(ticket.appointmentDate).toLocaleDateString('fr-FR') : '--'}</td>
      <td><span class="status-badge ${statusClass}">${statusText}</span></td>
      <td>
        <div class="action-buttons">
          <button class="action-btn action-btn-view" onclick="viewTicket(${ticket.id})">
            <i class="fas fa-eye"></i>
          </button>
          <button class="action-btn action-btn-print" onclick="reprintTicket(${ticket.id})">
            <i class="fas fa-print"></i>
          </button>
        </div>
      </td>
    `;
    
    tbody.appendChild(row);
  });
}

// Exporter l'historique
function exportHistory() {
  const csvContent = generateCSV();
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `tickets_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

// Générer le CSV
function generateCSV() {
  const headers = ['Numéro', 'Patient', 'Service', 'Date', 'Heure', 'Priorité', 'Statut'];
  const rows = ticketsHistory.map(ticket => [
    ticket.number,
    ticket.patientName,
    ticket.service,
    ticket.appointmentDate ? new Date(ticket.appointmentDate).toLocaleDateString('fr-FR') : '',
    ticket.appointmentTime || '',
    ticket.priority,
    ticket.status
  ]);
  
  return [headers, ...rows].map(row => row.join(',')).join('\n');
}

// Réinitialiser le formulaire
function resetForm() {
  document.getElementById('ticketForm').reset();
  setDefaultDates();
  updatePreview();
}

// Afficher une notification
function showNotification(message, type = 'info') {
  // Créer l'élément de notification
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
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
    border-radius: 10px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
    z-index: 10000;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 500;
    transform: translateX(400px);
    transition: transform 0.3s ease;
  `;
  
  document.body.appendChild(notification);
  
  // Animation d'entrée
  setTimeout(() => {
    notification.style.transform = 'translateX(0)';
  }, 100);
  
  // Supprimer après 3 secondes
  setTimeout(() => {
    notification.style.transform = 'translateX(400px)';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 3000);
}

// Gestionnaire d'erreurs global
window.addEventListener('error', function(event) {
  console.error('Erreur JavaScript:', event.error);
  showNotification('Une erreur est survenue', 'error');
});

// Gestionnaire pour les promesses rejetées
window.addEventListener('unhandledrejection', function(event) {
  console.error('Promesse rejetée:', event.reason);
  showNotification('Une erreur est survenue', 'error');
}); 