function openUserLogin() {
  document.getElementById("loginModal").style.display = "flex";
}

function closeModal() {
  document.getElementById("loginModal").style.display = "none";
}

window.onclick = function (event) {
  const login = document.getElementById("loginModal");
  if (event.target === login) login.style.display = "none";
};

window.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  if (params.get("login") === "true") {
    openUserLogin();
  }
});
      