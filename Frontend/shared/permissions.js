/**
 * WaitLess CHU - Role-Based Access Control
 * Defines permissions for different user roles
 */

const PERMISSIONS = {
  // Patient permissions
  patient: {
    allowedPages: [
      'acceuil.html',
      'qr.html',
      'ticket.html',
      'chatbot.html'
    ],
    allowedPaths: [
      '/Acceuil/',
      '/qr code/',
      '/qr%20code/',
      '/tickets/',
      '/chatbot/'
    ],
    redirectTo: '/Frontend/Acceuil/acceuil.html'
  },
  
  // Administrator permissions
  admin: {
    allowedPages: [
      'acceuil.html',
      'dashboard.html',
      'staff.html',
      'services.html',
      'patients.html',
      'qr-display.html',
      'qr.html',
      'reports.html',
      'admin-chatbot.html'
    ],
    allowedPaths: [
      '/Acceuil/',
      '/dashboard/',
      '/staff/',
      '/services/',
      '/patients/',
      '/qr-display/',
      '/qr code/',
      '/qr%20code/',
      '/reports/',
      '/chatbot/'
    ],
    redirectTo: '/Frontend/dashboard/dashboard.html'
  },
  
  // Secretary permissions
  staff: {
    allowedPages: [
      'acceuil.html',
      'secretary.html',
      'qr.html'
    ],
    allowedPaths: [
      '/Acceuil/',
      '/secretary/',
      '/qr code/',
      '/qr%20code/'
    ],
    redirectTo: '/Frontend/secretary/secretary.html'
  },
  
  // Doctor permissions (same as secretary for now)
  doctor: {
    allowedPages: [
      'acceuil.html',
      'secretary.html',
      'qr.html'
    ],
    allowedPaths: [
      '/Acceuil/',
      '/secretary/',
      '/qr code/',
      '/qr%20code/'
    ],
    redirectTo: '/Frontend/secretary/secretary.html'
  }
};

/**
 * Check if user has permission to access current page
 * @param {string} userRole - User's role
 * @param {string} currentPath - Current page path
 * @returns {boolean} - Whether user has permission
 */
function hasPermission(userRole, currentPath) {
  const permissions = PERMISSIONS[userRole];
  
  if (!permissions) {
    console.warn(`No permissions defined for role: ${userRole}`);
    return false;
  }
  
  // Check if current path is in allowed paths (both encoded and decoded)
  const decodedPath = decodeURIComponent(currentPath);
  const isAllowed = permissions.allowedPaths.some(allowedPath => 
    currentPath.includes(allowedPath) || decodedPath.includes(allowedPath)
  );
  
  return isAllowed;
}

/**
 * Get redirect URL for user role
 * @param {string} userRole - User's role
 * @returns {string} - Redirect URL
 */
function getRedirectUrl(userRole) {
  const permissions = PERMISSIONS[userRole];
  return permissions ? permissions.redirectTo : '/Frontend/Acceuil/acceuil.html';
}

/**
 * Get allowed pages for user role
 * @param {string} userRole - User's role
 * @returns {Array} - Array of allowed page names
 */
function getAllowedPages(userRole) {
  const permissions = PERMISSIONS[userRole];
  return permissions ? permissions.allowedPages : [];
}

/**
 * Get allowed paths for user role
 * @param {string} userRole - User's role
 * @returns {Array} - Array of allowed paths
 */
function getAllowedPaths(userRole) {
  const permissions = PERMISSIONS[userRole];
  return permissions ? permissions.allowedPaths : [];
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    PERMISSIONS,
    hasPermission,
    getRedirectUrl,
    getAllowedPages,
    getAllowedPaths
  };
} 