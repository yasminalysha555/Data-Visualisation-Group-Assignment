document.addEventListener("DOMContentLoaded", () => {
  const menuIcon = document.querySelector(".menu-icon");
  const sideMenu = document.querySelector(".side-menu");
  const overlay = document.querySelector(".overlay");
  const startBtn = document.getElementById("startBtn");
  // Dashboard dropdown
const dashToggle = document.getElementById("dashToggle");
const dropdown = document.querySelector(".dropdown");

if (dashToggle) {
  dashToggle.addEventListener("click", (e) => {
    e.preventDefault();
    dropdown.classList.toggle("open");
  });
}


  // Burger menu toggle
  if (menuIcon) {
    menuIcon.addEventListener("click", () => {
      menuIcon.classList.toggle("active");
      sideMenu.classList.toggle("open");
      overlay.classList.toggle("show");
    });
  }

  if (overlay) {
    overlay.addEventListener("click", () => {
      menuIcon.classList.remove("active");
      sideMenu.classList.remove("open");
      overlay.classList.remove("show");
    });
  }

  // Start Exploring -> animate then go to dashboard
  if (startBtn) {
    startBtn.addEventListener("click", (e) => {
      e.preventDefault(); // stop instant navigation

      // add animation class to body
      document.body.classList.add("transition-out");

      // wait for animation, then change page
      setTimeout(() => {
        window.location.href = "q1.html";
      }, 600); // match 0.6s in CSS
    });
  }
});
// chart code moved to js/dashboard.js
