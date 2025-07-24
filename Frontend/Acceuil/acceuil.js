function openUserLogin() {
  document.getElementById("loginModal").style.display = "flex";
}

function closeModal() {
  document.getElementById("loginModal").style.display = "none";
  // Clear error message
  const errorDiv = document.getElementById('loginError');
  if (errorDiv) {
    errorDiv.style.display = 'none';
  }
}

function showLoginError(message) {
  const errorDiv = document.getElementById('loginError');
  if (errorDiv) {
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
  }
}

async function handleLogin(event) {
  event.preventDefault();
  
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  const submitButton = event.target.querySelector('button[type="submit"]');
  
  // Disable submit button and show loading
  submitButton.disabled = true;
  submitButton.textContent = 'Connexion...';
  
  try {
    const response = await apiClient.login(email, password);
    
    if (response) {
      APIUtils.showNotification('Connexion réussie!', 'success');
      closeModal();
      
      // Show account button immediately
      const user = apiClient.getCurrentUser();
      if (user) {
        showAccountButton(user);
      }
      
      // Redirect based on user role using permissions system
      if (user) {
        const roleMessages = {
          'admin': 'Accès administrateur activé',
          'staff': 'Accès secrétariat activé',
          'doctor': 'Accès médical activé',
          'patient': 'Accès patient activé'
        };
        
        const message = roleMessages[user.role] || 'Connexion réussie';
        APIUtils.showNotification(`Bienvenue ${user.full_name}! ${message}.`, 'success');
        
        setTimeout(() => {
          // Use the permissions system to get the correct redirect URL
          const redirectUrl = getRedirectUrl(user.role);
          window.location.href = redirectUrl;
        }, 1500);
      }
    }
  } catch (error) {
    console.error('Login error:', error);
    showLoginError(error.message || 'Erreur de connexion. Vérifiez vos identifiants.');
  } finally {
    // Re-enable submit button
    submitButton.disabled = false;
    submitButton.textContent = 'Se connecter';
  }
}

// Check if user is already logged in
function checkAuthStatus() {
  if (apiClient.isAuthenticated()) {
    const user = apiClient.getCurrentUser();
    if (user) {
      // Show account button and user info
      showAccountButton(user);
      console.log('User already logged in:', user.full_name);
    }
  }
}

// Show account button with user info
function showAccountButton(user) {
  const accountSection = document.getElementById('accountSection');
  const accountName = document.getElementById('accountName');
  const dropdownUserName = document.getElementById('dropdownUserName');
  const dropdownUserRole = document.getElementById('dropdownUserRole');
  
  if (accountSection && user) {
    // Show account section
    accountSection.style.display = 'flex';
    
    // Set user name (truncate if too long)
    const displayName = user.full_name.length > 15 ? user.full_name.substring(0, 15) + '...' : user.full_name;
    accountName.textContent = displayName;
    dropdownUserName.textContent = user.full_name;
    
    // Set user role
    const roleText = {
      'admin': 'Administrateur',
      'staff': 'Personnel',
      'doctor': 'Médecin',
      'patient': 'Patient'
    };
    dropdownUserRole.textContent = roleText[user.role] || 'Utilisateur';
    
    // Show appropriate menu based on user role
    showRoleSpecificMenu(user.role);
  }
}

// Show role-specific menu items
function showRoleSpecificMenu(userRole) {
  // Hide all menu sections first
  const menuSections = ['patientMenu', 'adminMenu', 'secretaryMenu', 'doctorMenu'];
  menuSections.forEach(menuId => {
    const menu = document.getElementById(menuId);
    if (menu) {
      menu.style.display = 'none';
    }
  });
  
  // Show the appropriate menu based on role
  let targetMenu = 'patientMenu'; // Default to patient menu
  
  switch (userRole) {
    case 'admin':
      targetMenu = 'adminMenu';
      break;
    case 'staff':
      targetMenu = 'secretaryMenu';
      break;
    case 'doctor':
      targetMenu = 'doctorMenu';
      break;
    case 'patient':
    default:
      targetMenu = 'patientMenu';
      break;
  }
  
  // Show the target menu
  const targetMenuElement = document.getElementById(targetMenu);
  if (targetMenuElement) {
    targetMenuElement.style.display = 'block';
  }
}

// Toggle account dropdown menu
function toggleAccountMenu() {
  const dropdown = document.getElementById('accountDropdown');
  const accountBtn = document.querySelector('.account-btn');
  
  if (dropdown && accountBtn) {
    const isOpen = dropdown.classList.contains('show');
    
    if (isOpen) {
      dropdown.classList.remove('show');
      accountBtn.classList.remove('active');
    } else {
      dropdown.classList.add('show');
      accountBtn.classList.add('active');
    }
  }
}

// Close dropdown when clicking outside
function closeAccountDropdown() {
  const dropdown = document.getElementById('accountDropdown');
  const accountBtn = document.querySelector('.account-btn');
  
  if (dropdown && accountBtn) {
    dropdown.classList.remove('show');
    accountBtn.classList.remove('active');
  }
}

// Handle logout
async function handleLogout() {
  if (confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) {
    try {
      await apiClient.logout();
      APIUtils.showNotification('Déconnexion réussie', 'success');
      
      // Hide account button
      const accountSection = document.getElementById('accountSection');
      if (accountSection) {
        accountSection.style.display = 'none';
      }
      
      // Close dropdown
      closeAccountDropdown();
      
      // Redirect to home page
      setTimeout(() => {
        window.location.href = 'acceuil.html';
      }, 1000);
    } catch (error) {
      console.error('Logout error:', error);
      APIUtils.showNotification('Erreur lors de la déconnexion', 'error');
    }
  }
}

window.onclick = function (event) {
  const login = document.getElementById("loginModal");
  const accountSection = document.getElementById("accountSection");
  
  if (event.target === login) {
    closeModal();
  }
  
  // Close account dropdown when clicking outside
  if (accountSection && !accountSection.contains(event.target)) {
    closeAccountDropdown();
  }
};

window.addEventListener("DOMContentLoaded", () => {
  // Check authentication status
  checkAuthStatus();
  
  // Setup login form
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }
  
  // Check for login parameter
  const params = new URLSearchParams(window.location.search);
  if (params.get("login") === "true") {
    openUserLogin();
  }
});
      