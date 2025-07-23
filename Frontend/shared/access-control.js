/**
 * WaitLess CHU - Access Control System
 * Handles role-based access control for all pages
 */

// Wait for DOM to be loaded
document.addEventListener('DOMContentLoaded', function() {
  checkPageAccess();
});

/**
 * Check if current user has access to the current page
 */
function checkPageAccess() {
  // Check if user is authenticated
  if (!apiClient || !apiClient.isAuthenticated()) {
    console.log('User not authenticated, allowing access to public pages');
    return; // Allow access to public pages (like login, signup)
  }
  
  const user = apiClient.getCurrentUser();
  if (!user) {
    console.log('No user data found');
    return;
  }
  
  const userRole = user.role;
  const currentPath = window.location.pathname;
  const decodedPath = decodeURIComponent(currentPath);
  
  console.log(`Checking access for user: ${user.full_name} (${userRole})`);
  console.log(`Current path: ${currentPath}`);
  console.log(`Decoded path: ${decodedPath}`);
  
  // Check if user has permission to access current page
  if (!hasPermission(userRole, currentPath) && !hasPermission(userRole, decodedPath)) {
    console.warn(`Access denied: User ${userRole} cannot access ${currentPath}`);
    
    // Show access denied message
    showAccessDeniedMessage(userRole);
    
    // Redirect to appropriate page after delay
    setTimeout(() => {
      const redirectUrl = getRedirectUrl(userRole);
      console.log(`Redirecting to: ${redirectUrl}`);
      window.location.href = redirectUrl;
    }, 3000);
  } else {
    console.log(`Access granted for ${userRole} to ${currentPath}`);
  }
}

/**
 * Show access denied message
 * @param {string} userRole - User's role
 */
function showAccessDeniedMessage(userRole) {
  // Create access denied overlay
  const overlay = document.createElement('div');
  overlay.className = 'access-denied-overlay';
  overlay.innerHTML = `
    <div class="access-denied-modal">
      <div class="access-denied-icon">
        <i class="fas fa-ban"></i>
      </div>
      <h2>Accès Refusé</h2>
      <p>Vous n'avez pas les permissions nécessaires pour accéder à cette page.</p>
      <p><strong>Rôle:</strong> ${getRoleDisplayName(userRole)}</p>
      <p>Redirection en cours...</p>
      <div class="loading-spinner">
        <i class="fas fa-spinner fa-spin"></i>
      </div>
    </div>
  `;
  
  // Add styles
  const style = document.createElement('style');
  style.textContent = `
    .access-denied-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
    }
    
    .access-denied-modal {
      background: white;
      padding: 2rem;
      border-radius: 12px;
      text-align: center;
      max-width: 400px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
    }
    
    .access-denied-icon {
      font-size: 3rem;
      color: #dc3545;
      margin-bottom: 1rem;
    }
    
    .access-denied-modal h2 {
      color: #dc3545;
      margin-bottom: 1rem;
    }
    
    .access-denied-modal p {
      margin-bottom: 0.5rem;
      color: #666;
    }
    
    .loading-spinner {
      margin-top: 1rem;
      font-size: 1.5rem;
      color: #4A90E2;
    }
  `;
  
  document.head.appendChild(style);
  document.body.appendChild(overlay);
}

/**
 * Get display name for user role
 * @param {string} role - User role
 * @returns {string} - Display name
 */
function getRoleDisplayName(role) {
  const roleNames = {
    'admin': 'Administrateur',
    'staff': 'Secrétaire',
    'doctor': 'Médecin',
    'patient': 'Patient'
  };
  return roleNames[role] || role;
}

/**
 * Update navigation menu based on user permissions
 * This function can be called to update navigation menus
 */
function updateNavigationMenu() {
  if (!apiClient || !apiClient.isAuthenticated()) {
    return;
  }
  
  const user = apiClient.getCurrentUser();
  if (!user) {
    return;
  }
  
  const userRole = user.role;
  const allowedPaths = getAllowedPaths(userRole);
  
  // Hide/show navigation items based on permissions
  const navItems = document.querySelectorAll('nav a, .nav-link');
  
  navItems.forEach(item => {
    const href = item.getAttribute('href');
    if (href) {
      const hasAccess = allowedPaths.some(path => href.includes(path));
      if (!hasAccess) {
        item.style.display = 'none';
      }
    }
  });
}

/**
 * Check if user can access a specific page
 * @param {string} pagePath - Path to check
 * @returns {boolean} - Whether user can access the page
 */
function canAccessPage(pagePath) {
  if (!apiClient || !apiClient.isAuthenticated()) {
    return false;
  }
  
  const user = apiClient.getCurrentUser();
  if (!user) {
    return false;
  }
  
  return hasPermission(user.role, pagePath);
}

/**
 * Get navigation links for current user
 * @returns {Array} - Array of navigation objects
 */
function getNavigationLinks() {
  if (!apiClient || !apiClient.isAuthenticated()) {
    return [];
  }
  
  const user = apiClient.getCurrentUser();
  if (!user) {
    return [];
  }
  
  const userRole = user.role;
  const allowedPages = getAllowedPages(userRole);
  
  const navigationMap = {
    'acceuil.html': { name: 'Accueil', path: '/Acceuil/acceuil.html', icon: 'fas fa-home' },
    'dashboard.html': { name: 'Tableau de Bord', path: '/dashboard/dashboard.html', icon: 'fas fa-chart-line' },
    'staff.html': { name: 'Gestion Personnel', path: '/staff/staff.html', icon: 'fas fa-users-cog' },
    'services.html': { name: 'Gestion Services', path: '/services/services.html', icon: 'fas fa-hospital' },
    'patients.html': { name: 'Gestion Patients', path: '/patients/patients.html', icon: 'fas fa-user-injured' },
    'qr-display.html': { name: 'Affichage QR', path: '/qr-display/qr-display.html', icon: 'fas fa-qrcode' },
    'reports.html': { name: 'Rapports', path: '/reports/reports.html', icon: 'fas fa-chart-bar' },
    'secretary.html': { name: 'Gestion File', path: '/secretary/secretary.html', icon: 'fas fa-clipboard-list' },
    'qr.html': { name: 'Scanner QR', path: '/qr code/qr.html', icon: 'fas fa-qrcode' },
    'ticket.html': { name: 'Mes Tickets', path: '/tickets/ticket.html', icon: 'fas fa-ticket-alt' },
    'chatbot.html': { name: 'Assistant', path: '/chatbot/chatbot.html', icon: 'fas fa-comments' }
  };
  
  return allowedPages
    .map(page => navigationMap[page])
    .filter(item => item !== undefined);
} 