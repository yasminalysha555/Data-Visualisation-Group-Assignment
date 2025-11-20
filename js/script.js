const menuIcon = document.querySelector('.menu-icon');
const sideMenu = document.querySelector('.side-menu');
const overlay = document.querySelector('.overlay');

function toggleMenu() {
  const open = sideMenu.classList.toggle('open');
  menuIcon.classList.toggle('active');
  overlay.classList.toggle('show', open);
}

menuIcon.addEventListener('click', toggleMenu);
overlay.addEventListener('click', toggleMenu);

document.getElementById("startBtn").addEventListener("click", () => {
  window.location.href = "dashboard.html";
});
// chart code moved to js/dashboard.js
