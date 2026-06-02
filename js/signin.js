import { api, showFormError, initHeader } from "./auth.js";

const form = document.getElementById("signin-form");
const errorEl = document.getElementById("form-error");

async function init() {
  const user = await initHeader();
  if (user) {
    window.location.href = "/leaderboard.html";
    return;
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  showFormError(errorEl, "");

  const fd = new FormData(form);
  const username = String(fd.get("username") || "").trim();
  const password = String(fd.get("password") || "");

  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = true;

  try {
    await api("/api/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    window.location.href = "/leaderboard.html";
  } catch (err) {
    showFormError(errorEl, err.message);
    btn.disabled = false;
  }
});

init();
