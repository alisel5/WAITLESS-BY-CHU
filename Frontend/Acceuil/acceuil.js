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
      
      // Redirect based on user role
      const user = apiClient.getCurrentUser();
      if (user && ['admin', 'staff', 'doctor'].includes(user.role)) {
        // Redirect to staff/admin dashboard with role-specific message
        const roleMessages = {
          'admin': 'Accès administrateur activé',
          'staff': 'Accès personnel activé',
          'doctor': 'Accès médical activé'
        };
        APIUtils.showNotification(`Bienvenue ${user.full_name}! ${roleMessages[user.role]}.`, 'success');
        setTimeout(() => {
          window.location.href = '../dashboard/dashboard.html';
        }, 1500);
      } else {
        // Redirect to patient QR page with instructions
        APIUtils.showNotification(`Bienvenue ${user.full_name}! Vous pouvez maintenant scanner des QR codes.`, 'success');
        setTimeout(() => {
          window.location.href = '../qr code/qr.html';
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
      // Show user info or redirect
      console.log('User already logged in:', user.full_name);
    }
  }
}

window.onclick = function (event) {
  const login = document.getElementById("loginModal");
  if (event.target === login) {
    closeModal();
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
      