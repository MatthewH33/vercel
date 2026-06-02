import {
  api,
  loadSchools,
  populateSchoolSelect,
  showFormError,
  initHeader,
} from "./auth.js";

const form = document.getElementById("register-form");
const errorEl = document.getElementById("form-error");
const schoolSelect = document.getElementById("school-select");

async function init() {
  const user = await initHeader();
  if (user) {
    window.location.href = "/leaderboard.html";
    return;
  }
  const schools = await loadSchools();
  populateSchoolSelect(schoolSelect, schools);
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  showFormError(errorEl, "");

  const fd = new FormData(form);
  const username = String(fd.get("username") || "").trim();
  const password = String(fd.get("password") || "");
  const schoolId = String(fd.get("schoolId") || "");

  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = true;

  try {
    await api("/api/register", {
      method: "POST",
      body: JSON.stringify({ username, password, schoolId }),
    });
    window.location.href = "/leaderboard.html";
  } catch (err) {
    showFormError(errorEl, err.message);
    btn.disabled = false;
  }
});

init();
