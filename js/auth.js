const STARTING_CREDITS = 1000;

function formatCredits(n) {
  return Number(n).toLocaleString("en-AU");
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || "Request failed");
    err.status = res.status;
    throw err;
  }
  return data;
}

async function fetchCurrentUser() {
  try {
    const { user } = await api("/api/me");
    return user;
  } catch {
    return null;
  }
}

async function loadSchools() {
  const { schools } = await api("/api/schools");
  return schools;
}

function populateSchoolSelect(select, schools, selectedId) {
  select.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Select your school";
  placeholder.disabled = true;
  placeholder.selected = !selectedId;
  select.appendChild(placeholder);

  for (const school of schools) {
    const opt = document.createElement("option");
    opt.value = school.id;
    opt.textContent = school.name;
    if (school.id === selectedId) opt.selected = true;
    select.appendChild(opt);
  }
}

function showFormError(el, message) {
  if (!el) return;
  el.textContent = message || "";
  el.hidden = !message;
}

function updateSiteNav(user) {
  const adminLink = document.getElementById("nav-admin");
  if (adminLink) adminLink.hidden = !user?.isAdmin;
}

function setElVisible(el, visible) {
  if (!el) return;
  if (visible) el.removeAttribute("hidden");
  else el.setAttribute("hidden", "");
}

function updateMobileDrawerAuth(user) {
  const footer = document.getElementById("nav-drawer-footer");
  if (!footer) return;

  if (user) {
    footer.innerHTML = `
      <p class="nav-drawer-user">@${escapeHtml(user.username)}</p>
      <p class="nav-drawer-school">${escapeHtml(user.school)}</p>
      <p class="nav-drawer-credits">${formatCredits(user.credits)} credits</p>
      <a href="/profile.html" class="btn btn-ghost btn-full">Your profile</a>
      <a href="#" class="btn btn-ghost btn-full nav-drawer-logout" role="button">Sign out</a>`;
    footer.querySelector(".nav-drawer-logout")?.addEventListener("click", (e) => {
      handleLogout(e);
      document.body.classList.remove("nav-open");
    });
  } else {
    footer.innerHTML = `
      <a href="/signin.html" class="btn btn-primary btn-full">Sign in</a>
      <a href="/register.html" class="btn btn-ghost btn-full">Create account</a>`;
  }
}

function updateHeaderAuth(user) {
  updateSiteNav(user);
  updateMobileDrawerAuth(user);
  document.body.classList.toggle("is-authed", Boolean(user));
  document.body.classList.toggle("is-guest", !user);

  const creditsDisplay = document.getElementById("credits-display");
  const creditsPill = document.getElementById("credits-pill") || document.querySelector(".credits-pill");
  const userPill = document.getElementById("user-pill");
  const authActions = document.getElementById("auth-actions");
  const logoutBtn = document.getElementById("logout-btn");

  if (user) {
    if (creditsDisplay) creditsDisplay.textContent = formatCredits(user.credits);
    setElVisible(creditsPill, true);
    if (userPill) {
      setElVisible(userPill, true);
      userPill.innerHTML = `<span class="user-name">@${escapeHtml(user.username)}</span><span class="user-school">${escapeHtml(user.school)}</span>`;
    }
    setElVisible(authActions, false);
    setElVisible(logoutBtn, true);
  } else {
    if (creditsDisplay) creditsDisplay.textContent = formatCredits(STARTING_CREDITS);
    setElVisible(creditsPill, false);
    setElVisible(userPill, false);
    setElVisible(authActions, true);
    setElVisible(logoutBtn, false);
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function initMobileNav() {
  const header = document.querySelector(".site-header");
  const nav = header?.querySelector(".site-nav");
  if (!header || !nav || header.querySelector(".nav-toggle")) return;

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "nav-toggle";
  toggle.setAttribute("aria-label", "Open menu");
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-controls", "site-nav");
  toggle.innerHTML = '<span class="nav-toggle-icon" aria-hidden="true"></span>';

  const backdrop = document.createElement("div");
  backdrop.className = "nav-backdrop";
  backdrop.hidden = true;

  nav.id = "site-nav";

  if (!document.getElementById("nav-drawer-footer")) {
    const footer = document.createElement("div");
    footer.id = "nav-drawer-footer";
    footer.className = "nav-drawer-footer";
    nav.appendChild(footer);
  }

  const closeNav = () => {
    document.body.classList.remove("nav-open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Open menu");
    backdrop.hidden = true;
  };

  const openNav = () => {
    document.body.classList.add("nav-open");
    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-label", "Close menu");
    backdrop.hidden = false;
  };

  toggle.addEventListener("click", () => {
    if (document.body.classList.contains("nav-open")) closeNav();
    else openNav();
  });

  backdrop.addEventListener("click", closeNav);
  nav.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeNav));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeNav();
  });

  header.appendChild(toggle);
  document.body.appendChild(backdrop);
}

async function initHeader() {
  initMobileNav();
  const user = await fetchCurrentUser();
  updateHeaderAuth(user);
  return user;
}

async function handleLogout(e) {
  e.preventDefault();
  try {
    await api("/api/logout", { method: "POST" });
  } catch {
    /* ignore */
  }
  window.location.href = "/";
}

if (typeof document !== "undefined") {
  document.getElementById("logout-btn")?.addEventListener("click", handleLogout);
}

export {
  api,
  fetchCurrentUser,
  loadSchools,
  populateSchoolSelect,
  showFormError,
  updateHeaderAuth,
  initHeader,
  formatCredits,
  escapeHtml,
  STARTING_CREDITS,
};
