/* ToolFlight Invoice & Business Manager -- Firebase Authentication (Phase 2)
   ==========================================================================
   Isolated on purpose, same as js/invoice.js: this file owns nothing
   outside invoice-maker.html. It does not touch app.js, style.css, or
   any DOM id used by any other ToolFlight tool.

   Loaded as a module script (`<script type="module">`) because Firebase's
   Web SDK is distributed as ES modules.

   IMPORTANT: the Firebase SDK is loaded via dynamic import() inside a
   try/catch, not a static top-level `import`. A static import failing
   (CDN blocked, offline, ad-blocker, outage -- a real possibility on any
   production site, not just this sandbox) would silently abort this
   entire module, breaking even the modal-open button and panel
   switching -- UI that has nothing to do with Firebase itself. Dynamic
   import lets the UI wiring always succeed independently of whether
   Firebase loaded.

   HONESTY NOTE: js/firebase-config.js currently contains placeholder
   values (no real Firebase project exists in this repository yet).
   isFirebaseConfigured() below detects that and every auth action shows
   a clear, honest message instead of a cryptic SDK error or a silent
   no-op. This has been tested for what it actually is -- the UI/validation/
   error-handling layer -- not against a real Firebase backend, since
   none exists, AND not against a real Firebase SDK load, since this
   sandbox blocks the CDN it's served from. See the Phase 2 report for
   exactly what could and could not be verified. */

import { firebaseConfig } from "./firebase-config.js";

function isFirebaseConfigured() {
  return Object.values(firebaseConfig).every(v => typeof v === "string" && !v.startsWith("REPLACE_WITH_REAL_"));
}

const FIREBASE_READY = isFirebaseConfigured();
let auth = null;
let firebaseAuthFns = null; // set after a successful dynamic import
let db = null; // set after a successful dynamic import, shared with invoice-business.js so it doesn't need its own Firebase app instance

// Minimal, additive listener registry -- lets js/invoice-business.js react
// to auth state without duplicating the Firebase app initialization above
// or invoice-auth.js needing to know anything about business/customer/
// product logic. Existing onAuthStateChanged behavior below is unchanged;
// this just also notifies anyone who called onAuthChange().
const authChangeListeners = [];
export function onAuthChange(callback) {
  authChangeListeners.push(callback);
  if (auth) callback(auth.currentUser); // fire immediately if we already know the state
}
export function getAuthInstance() { return auth; }
export function getDb() { return db; }

async function loadFirebase() {
  if (!FIREBASE_READY) return;
  try {
    const [{ initializeApp }, authModule, firestoreModule] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js"),
      import("https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js"),
    ]);
    firebaseAuthFns = authModule;
    const app = initializeApp(firebaseConfig);
    auth = authModule.getAuth(app);
    db = firestoreModule.getFirestore(app);
    firebaseAuthFns.onAuthStateChanged(auth, (user) => {
      if (user) renderSignedIn(user); else renderSignedOut();
      authChangeListeners.forEach(cb => cb(user));
    });
  } catch (err) {
    // Real network/CDN failure loading the SDK itself -- not the same
    // as "not configured yet". Logged for diagnosis; the UI still
    // degrades to the same honest "not available" messaging either way.
    console.error("[invoice-auth] Firebase SDK failed to load:", err);
    auth = null;
  }
}

const NOT_CONFIGURED_MESSAGE = "Account features aren't fully set up yet. Quick Invoice (no account) works normally.";

/* ---------- Validation (client-side, runs before any Firebase call) ---------- */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
function isValidPassword(password) {
  return typeof password === "string" && password.length >= 8;
}

/* ---------- User-friendly error mapping ---------- */
function friendlyAuthError(err) {
  const code = err && err.code;
  const map = {
    "auth/email-already-in-use": "An account with this email already exists. Try signing in instead.",
    "auth/invalid-email": "That email address doesn't look right.",
    "auth/weak-password": "Password should be at least 8 characters.",
    "auth/user-not-found": "We couldn't find an account with that email.",
    "auth/wrong-password": "That password doesn't match this email.",
    "auth/invalid-credential": "Email or password is incorrect.",
    "auth/too-many-requests": "Too many attempts. Please wait a moment and try again.",
    "auth/network-request-failed": "Network error. Check your connection and try again.",
  };
  return map[code] || "Something went wrong. Please try again.";
}

/* ---------- Small DOM helpers ---------- */
function $(id) { return document.getElementById(id); }
function show(id) { $(id).classList.remove("hidden"); }
function hide(id) { $(id).classList.add("hidden"); }
function setError(id, message) { $(id).textContent = message || ""; }
function setSuccess(id, message) { $(id).textContent = message || ""; }

function setLoading(btn, loading, loadingText, normalText) {
  btn.disabled = loading;
  btn.textContent = loading ? loadingText : normalText;
}

/* ---------- Panel switching within the auth modal ---------- */
function showAuthPanel(panelId) {
  ["invAuthPanelSignIn", "invAuthPanelCreate", "invAuthPanelForgot", "invAuthPanelVerify"].forEach(id => {
    if (id === panelId) show(id); else hide(id);
  });
  ["invSignInError", "invCreateError", "invForgotError", "invVerifyError"].forEach(id => setError(id, ""));
  ["invForgotSuccess", "invVerifySuccess"].forEach(id => setSuccess(id, ""));
}

function openAuthModal(panelId) {
  showAuthPanel(panelId);
  $("invAuthModal").classList.add("show");
}
function closeAuthModal() {
  $("invAuthModal").classList.remove("show");
}

/* ---------- Account state bar (shown only once Firebase confirms a
   real session -- never assumed on page load) ---------- */
function renderSignedIn(user) {
  hide("invModeSelect");
  show("invAccountBar");
  $("invAccountEmail").textContent = "Signed in as " + user.email;
}
function renderSignedOut() {
  hide("invAccountBar");
  show("invModeSelect");
}

/* ---------- Auth actions ---------- */
async function handleCreateAccount() {
  const email = $("invCreateEmail").value.trim();
  const password = $("invCreatePassword").value;
  const btn = $("invCreateSubmitBtn");

  if (!isValidEmail(email)) { setError("invCreateError", "Enter a valid email address."); return; }
  if (!isValidPassword(password)) { setError("invCreateError", "Password should be at least 8 characters."); return; }
  if (!FIREBASE_READY || !auth) { setError("invCreateError", NOT_CONFIGURED_MESSAGE); return; }

  setError("invCreateError", "");
  setLoading(btn, true, "Creating account…", "Create Free Account");
  try {
    const cred = await firebaseAuthFns.createUserWithEmailAndPassword(auth, email, password);
    await firebaseAuthFns.sendEmailVerification(cred.user);
    $("invVerifyEmailAddress").textContent = email;
    showAuthPanel("invAuthPanelVerify");
  } catch (err) {
    setError("invCreateError", friendlyAuthError(err));
  } finally {
    setLoading(btn, false, "Creating account…", "Create Free Account");
  }
}

async function handleSignIn() {
  const email = $("invSignInEmail").value.trim();
  const password = $("invSignInPassword").value;
  const btn = $("invSignInSubmitBtn");

  if (!isValidEmail(email)) { setError("invSignInError", "Enter a valid email address."); return; }
  if (!password) { setError("invSignInError", "Enter your password."); return; }
  if (!FIREBASE_READY || !auth) { setError("invSignInError", NOT_CONFIGURED_MESSAGE); return; }

  setError("invSignInError", "");
  setLoading(btn, true, "Signing in…", "Sign In");
  try {
    await firebaseAuthFns.signInWithEmailAndPassword(auth, email, password);
    closeAuthModal();
    // renderSignedIn() runs from the onAuthStateChanged observer below,
    // not here -- that's the "observe state, don't assume it" pattern
    // Firebase recommends, applied consistently rather than optimistically
    // updating the UI before Firebase itself confirms the session.
  } catch (err) {
    setError("invSignInError", friendlyAuthError(err));
  } finally {
    setLoading(btn, false, "Signing in…", "Sign In");
  }
}

async function handleForgotPassword() {
  const email = $("invForgotEmail").value.trim();
  const btn = $("invForgotSubmitBtn");

  if (!isValidEmail(email)) { setError("invForgotError", "Enter a valid email address."); return; }
  if (!FIREBASE_READY || !auth) { setError("invForgotError", NOT_CONFIGURED_MESSAGE); return; }

  setError("invForgotError", "");
  setLoading(btn, true, "Sending…", "Send Reset Link");
  try {
    await firebaseAuthFns.sendPasswordResetEmail(auth, email);
    setSuccess("invForgotSuccess", "Check your email for a link to reset your password.");
  } catch (err) {
    // Deliberately do NOT reveal whether the email exists (Firebase's
    // own default already avoids this for auth/user-not-found on this
    // call, but keep the friendly message generic either way).
    setError("invForgotError", friendlyAuthError(err));
  } finally {
    setLoading(btn, false, "Sending…", "Send Reset Link");
  }
}

async function handleResendVerification() {
  const btn = $("invResendVerifyBtn");
  if (!auth || !auth.currentUser) { setError("invVerifyError", NOT_CONFIGURED_MESSAGE); return; }
  setError("invVerifyError", "");
  setLoading(btn, true, "Sending…", "Resend Verification Email");
  try {
    await firebaseAuthFns.sendEmailVerification(auth.currentUser);
    setSuccess("invVerifySuccess", "Verification email sent.");
  } catch (err) {
    setError("invVerifyError", friendlyAuthError(err));
  } finally {
    setLoading(btn, false, "Sending…", "Resend Verification Email");
  }
}

async function handleSignOut() {
  if (!auth) { renderSignedOut(); return; }
  try {
    await firebaseAuthFns.signOut(auth);
  } catch (err) {
    console.error("Sign out failed:", err);
  }
  // renderSignedOut() also runs via onAuthStateChanged below; calling it
  // here too keeps the UI responsive even if that listener is briefly slow.
  renderSignedOut();
}

/* ---------- Wiring ---------- */
function initAuthUI() {
  $("invCreateAccountBtn").addEventListener("click", () => openAuthModal("invAuthPanelCreate"));
  $("invSignInLink").addEventListener("click", (e) => { e.preventDefault(); openAuthModal("invAuthPanelSignIn"); });
  $("invAuthModal").addEventListener("click", (e) => { if (e.target.id === "invAuthModal") closeAuthModal(); });

  $("invSwitchToCreateLink").addEventListener("click", (e) => { e.preventDefault(); showAuthPanel("invAuthPanelCreate"); });
  $("invSwitchToSignInLink").addEventListener("click", (e) => { e.preventDefault(); showAuthPanel("invAuthPanelSignIn"); });
  $("invForgotPasswordLink").addEventListener("click", (e) => { e.preventDefault(); showAuthPanel("invAuthPanelForgot"); });
  $("invBackToSignInLink").addEventListener("click", (e) => { e.preventDefault(); showAuthPanel("invAuthPanelSignIn"); });

  $("invCreateSubmitBtn").addEventListener("click", handleCreateAccount);
  $("invSignInSubmitBtn").addEventListener("click", handleSignIn);
  $("invForgotSubmitBtn").addEventListener("click", handleForgotPassword);
  $("invResendVerifyBtn").addEventListener("click", handleResendVerification);
  $("invVerifyContinueBtn").addEventListener("click", closeAuthModal);
  $("invSignOutBtn").addEventListener("click", handleSignOut);

  // Enter key submits the focused panel's form without needing a <form> element.
  ["invSignInEmail", "invSignInPassword"].forEach(id => $(id).addEventListener("keydown", e => { if (e.key === "Enter") handleSignIn(); }));
  ["invCreateEmail", "invCreatePassword"].forEach(id => $(id).addEventListener("keydown", e => { if (e.key === "Enter") handleCreateAccount(); }));
  $("invForgotEmail").addEventListener("keydown", e => { if (e.key === "Enter") handleForgotPassword(); });

  if (!FIREBASE_READY) {
    // Don't disable the buttons outright -- clicking should still explain
    // *why* nothing happens, rather than the button looking broken/dead.
    console.warn("[invoice-auth] Firebase is not configured yet (placeholder values in js/firebase-config.js). Account features will show a friendly message instead of attempting real sign-in.");
  }

  // Show the guest/account choice immediately rather than leaving the
  // page in neither state while the Firebase SDK loads (or fails to) --
  // loadFirebase() will call renderSignedIn() itself if a real session
  // is found once (and if) the SDK successfully loads.
  renderSignedOut();
  loadFirebase();
}

if (document.getElementById("invModeSelect")) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAuthUI);
  } else {
    initAuthUI();
  }
}
