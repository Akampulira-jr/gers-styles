"use strict";

const menuToggle = document.querySelector("[data-menu-toggle]");
const primaryNav = document.querySelector("[data-primary-nav]");
const header = document.querySelector("[data-header]");
const mobileNavigationQuery = window.matchMedia("(max-width: 768px)");

function closeMenu() {
  if (!menuToggle || !primaryNav || !header) return;

  menuToggle.setAttribute("aria-expanded", "false");
  primaryNav.classList.remove("is-open");
  header.classList.remove("menu-is-open");
  document.body.classList.remove("menu-open");
}

if (menuToggle && primaryNav && header) {
  menuToggle.addEventListener("click", () => {
    const isOpen = menuToggle.getAttribute("aria-expanded") === "true";

    menuToggle.setAttribute("aria-expanded", String(!isOpen));
    primaryNav.classList.toggle("is-open", !isOpen);
    header.classList.toggle("menu-is-open", !isOpen);
    document.body.classList.toggle("menu-open", !isOpen);
  });

  primaryNav.addEventListener("click", (event) => {
    if (event.target.closest("a")) closeMenu();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeMenu();
      menuToggle.focus();
    }
  });

  window.addEventListener("resize", () => {
    if (!mobileNavigationQuery.matches) closeMenu();
  });
}

document.querySelectorAll("[data-current-year]").forEach((year) => {
  year.textContent = String(new Date().getFullYear());
});

const contactForm = document.querySelector("[data-contact-form]");
const contactFormStatus = document.querySelector("[data-contact-form-status]");
const contactFormSuccess = document.querySelector("[data-contact-form-success]");
const contactFormError = document.querySelector("[data-contact-form-error]");

if (contactForm) {
  const validationMessages = {
    "full-name": "Please enter your name.",
    phone: "Please enter your phone number.",
    interest: "Please select what you're interested in.",
    message: "Please tell us what you need.",
    email: "Please enter a valid email address.",
  };

  contactForm.querySelectorAll("input, select, textarea").forEach((field) => {
    field.addEventListener("invalid", () => {
      field.setCustomValidity(field.validity.valueMissing || field.validity.typeMismatch ? validationMessages[field.id] || "Please complete this field." : "");
    });

    field.addEventListener("input", () => field.setCustomValidity(""));
    field.addEventListener("change", () => field.setCustomValidity(""));
  });

  contactForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!contactForm.checkValidity()) {
      contactForm.reportValidity();
      return;
    }

    if (contactForm.elements.website.value) return;

    if (contactFormStatus) {
      contactFormStatus.textContent = "Inquiry submission will be available once the form service or backend is connected.";
    }

    contactFormSuccess?.setAttribute("hidden", "");
    contactFormError?.setAttribute("hidden", "");
  });
}
