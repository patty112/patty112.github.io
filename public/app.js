// ─── API helpers ───────────────────────────────────────
const API = "/api";

function getToken()  { return sessionStorage.getItem("hm_token"); }
function getUser()   { try { return JSON.parse(sessionStorage.getItem("hm_user")); } catch { return null; } }
function setSession(token, user) {
  sessionStorage.setItem("hm_token", token);
  sessionStorage.setItem("hm_user", JSON.stringify(user));
}
function clearSession() {
  sessionStorage.removeItem("hm_token");
  sessionStorage.removeItem("hm_user");
}

async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

// ─── Auth ───────────────────────────────────────────────
async function login() {
  const username = document.getElementById("usernameInput").value.trim();
  const password = document.getElementById("passwordInput").value;
  const status   = document.getElementById("loginStatus");

  if (!username || !password) {
    status.textContent = "Enter your username and password.";
    status.className = "login-error";
    return;
  }

  status.textContent = "Logging in…";
  status.className = "";

  try {
    const { token, user } = await apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password })
    });
    setSession(token, user);
    onLoginSuccess(user);
  } catch (err) {
    status.textContent = err.message;
    status.className = "login-error";
    document.getElementById("passwordInput").value = "";
  }
}

function logout() {
  clearSession();
  document.getElementById("loginPanel").style.display    = "block";
  document.getElementById("userBanner").style.display    = "none";
  document.getElementById("addReviewSection").style.display    = "none";
  document.getElementById("changePasswordSection").style.display = "none";
  document.getElementById("logoutBtn").style.display            = "none";
  document.getElementById("usernameInput").value  = "";
  document.getElementById("passwordInput").value  = "";
  document.getElementById("loginStatus").textContent = "";
  fetchAndRender(); // re-render to hide delete buttons
}

function onLoginSuccess(user) {
  document.getElementById("loginPanel").style.display    = "none";
  document.getElementById("userBanner").style.display    = "flex";
  document.getElementById("addReviewSection").style.display = "block";
  document.getElementById("logoutBtn").style.display         = "inline-block";
  document.getElementById("changePasswordSection").style.display = "block";
  document.getElementById("userGreeting").textContent           = `LOGGED IN AS ${user.displayName.toUpperCase()}`;
  fetchAndRender(); // re-render to show delete buttons
}

// ─── Restore session ────────────────────────────────────
async function restoreSession() {
  const token = getToken();
  const user  = getUser();
  if (!token || !user) return;
  try {
    await apiFetch("/auth/me");
    onLoginSuccess(user);
  } catch {
    clearSession();
  }
}

// ─── Reviews ───────────────────────────────────────────
let debounceTimer;
function fetchAndRender() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(_fetchAndRender, 200);
}

async function _fetchAndRender() {
  const container = document.getElementById("moviesContainer");
  const search    = document.getElementById("searchBar").value.trim();
  const reviewer  = document.getElementById("reviewerFilter").value;
  const sort      = document.getElementById("sortFilter").value;
  const params    = new URLSearchParams({ search, reviewer, sort });

  try {
    container.innerHTML = `<div class="loading-state"><div class="spinner"></div></div>`;
    const reviews = await apiFetch(`/reviews?${params}`);
    renderCards(reviews);
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><p>${escHtml(err.message)}</p></div>`;
  }
}

function renderCards(reviews) {
  const container   = document.getElementById("moviesContainer");
  const currentUser = getUser();

  if (reviews.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📼</div>
        <p>NO REVIEWS FOUND. TRY A DIFFERENT FILTER.</p>
      </div>`;
    return;
  }

  container.innerHTML = reviews.map((r, i) => buildCard(r, i, currentUser)).join("");
}

function buildCard(r, index, currentUser) {
  const isOwner  = currentUser && currentUser.username === r.reviewer;
  const pct        = (r.score / 10) * 100;
  const scoreLabel = Number.isInteger(r.score) ? r.score : r.score.toFixed(1);
  const dateStr  = r.created_at
    ? new Date(r.created_at).toLocaleDateString("en-US", { year:"numeric", month:"short", day:"numeric" })
    : "";

  const posterContent = r.poster
    ? `<img class="movie-poster" src="${escHtml(r.poster)}" alt="${escHtml(r.movie)}" loading="lazy">
       <div class="score-badge">${scoreLabel}</div>`
    : `<div class="poster-placeholder">📼</div>
       <div class="score-badge">${scoreLabel}</div>`;

  const deleteBtn = isOwner
    ? `<button class="delete-btn" onclick="deleteReview(${r.id})" title="Delete">✕</button>`
    : "";

  return `
    <div class="movie-card" style="animation-delay:${index * 0.035}s" id="card-${r.id}">
      <div class="poster-wrap">${posterContent}</div>
      <div class="movie-body">
        <div class="movie-title">${escHtml(r.movie)}</div>
        <div class="score-bar"><div class="score-fill" style="width:${pct}%"></div></div>
        <div class="card-meta-row">
          <span class="reviewer-tag">${escHtml(r.reviewer.toUpperCase())}</span>
          ${deleteBtn}
        </div>
        <p class="movie-text">${escHtml(r.review)}</p>
        ${dateStr ? `<div class="movie-date">${dateStr}</div>` : ""}
      </div>
    </div>`;
}

// ─── Submit Review ──────────────────────────────────────
async function submitReview() {
  const movie  = document.getElementById("movieName").value.trim();
  const score  = document.getElementById("reviewScore").value;
  const review = document.getElementById("reviewText").value.trim();
  const errEl  = document.getElementById("formError");
  const btn    = document.getElementById("submitBtn");

  errEl.textContent = "";
  if (!movie)  return (errEl.textContent = "Please enter a movie title.");
  if (!score)  return (errEl.textContent = "Please enter a score (1–10).");
  if (!review) return (errEl.textContent = "Please write something about the movie.");

  btn.disabled = true;
  btn.textContent = "POSTING…";

  try {
    let poster = null;
    const omdbKey = window.OMDB_KEY;
    if (omdbKey && omdbKey !== "YOUR_OMDB_KEY") {
      poster = await fetchPoster(movie, omdbKey);
    }
    await apiFetch("/reviews", {
      method: "POST",
      body: JSON.stringify({ movie, score: Math.round(parseFloat(score) * 10) / 10, review, poster })
    });
    document.getElementById("movieName").value   = "";
    document.getElementById("reviewScore").value = "";
    document.getElementById("reviewText").value  = "";
    fetchAndRender();
  } catch (err) {
    errEl.textContent = err.message;
  } finally {
    btn.disabled = false;
    btn.textContent = "▶ POST REVIEW";
  }
}

// ─── Delete Review ──────────────────────────────────────
async function deleteReview(id) {
  if (!confirm("Delete this review?")) return;
  try {
    await apiFetch(`/reviews/${id}`, { method: "DELETE" });
    const card = document.getElementById(`card-${id}`);
    if (card) {
      card.style.transition = "opacity 0.25s";
      card.style.opacity = "0";
      setTimeout(() => fetchAndRender(), 280);
    }
  } catch (err) {
    alert(err.message);
  }
}

// ─── Change Password ────────────────────────────────────
async function changePassword() {
  const current  = document.getElementById("currentPassword").value;
  const newPw    = document.getElementById("newPassword").value;
  const confirm  = document.getElementById("confirmPassword").value;
  const statusEl = document.getElementById("changePwStatus");
  const btn      = document.getElementById("changePwBtn");

  statusEl.textContent = "";
  statusEl.className   = "";

  if (!current || !newPw || !confirm) {
    statusEl.textContent = "Please fill in all three fields.";
    statusEl.className = "pw-error";
    return;
  }
  if (newPw.length < 8) {
    statusEl.textContent = "New password must be at least 8 characters.";
    statusEl.className = "pw-error";
    return;
  }
  if (newPw !== confirm) {
    statusEl.textContent = "New passwords do not match.";
    statusEl.className = "pw-error";
    return;
  }

  btn.disabled = true;
  btn.textContent = "UPDATING…";

  try {
    await apiFetch("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword: current, newPassword: newPw })
    });
    statusEl.textContent = "✓ Password updated successfully.";
    statusEl.className = "pw-success";
    document.getElementById("currentPassword").value = "";
    document.getElementById("newPassword").value     = "";
    document.getElementById("confirmPassword").value = "";
  } catch (err) {
    statusEl.textContent = err.message;
    statusEl.className = "pw-error";
  } finally {
    btn.disabled = false;
    btn.textContent = "▶ UPDATE PASSWORD";
  }
}

// ─── OMDB ───────────────────────────────────────────────
async function fetchPoster(title, key) {
  try {
    const res  = await fetch(`https://www.omdbapi.com/?t=${encodeURIComponent(title)}&apikey=${key}`);
    const data = await res.json();
    if (data.Poster && data.Poster !== "N/A") return data.Poster;
  } catch {}
  return null;
}

// ─── Util ───────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ─── Init ───────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  await restoreSession();
  fetchAndRender();
});
