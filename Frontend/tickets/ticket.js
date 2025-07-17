// Simule des données (mock)
function getMockTicketInfo(code) {
  return {
    code,
    peopleAhead: Math.floor(Math.random() * 10) + 1,
    estimatedTime: Math.floor(Math.random() * 25) + 5 + " minutes"
  };
}

// Affiche les données
function displayTicketInfo() {
  const params = new URLSearchParams(window.location.search);
  const ticketCode = params.get("code");

  if (!ticketCode) {
    alert("Aucun ticket fourni.");
    return;
  }

  const data = getMockTicketInfo(ticketCode);

  document.getElementById("ticketCode").textContent = data.code;
  document.getElementById("peopleAhead").textContent = data.peopleAhead;
  document.getElementById("estimatedTime").textContent = data.estimatedTime;
}

function refreshTicket() {
  displayTicketInfo(); // pour simuler un changement dynamique
}

window.addEventListener("DOMContentLoaded", displayTicketInfo);
