/* ToolFlight Invoice & Business Manager -- Firebase config TEMPLATE.
   ====================================================================
   STATUS: Not active. Not loaded by invoice-maker.html or any other
   page in Phase 1. No Firebase project exists in this repository yet.

   When Phase 2 creates a real Firebase project:
   1. Copy this file to js/firebase-config.js (gitignored if this repo
      adds a .gitignore -- currently none exists, so add one alongside
      the real config, not before).
   2. Replace every placeholder value below with the real project's
      config, from Firebase Console > Project Settings > General.
   3. Add the Firebase Web SDK script tags to invoice-maker.html's
      <head>, matching the CDN-script-tag pattern already used for
      pdf-lib/jszip/qrcode-generator elsewhere on this site (this repo
      has no bundler, so this stays consistent):

        <script type="module">
          import { initializeApp } from "https://www.gstatic.com/firebasejs/10.x.x/firebase-app.js";
          import { getAuth } from "https://www.gstatic.com/firebasejs/10.x.x/firebase-auth.js";
          import { getFirestore } from "https://www.gstatic.com/firebasejs/10.x.x/firebase-firestore.js";
          import { firebaseConfig } from "./firebase-config.js";
          const app = initializeApp(firebaseConfig);
          window.toolflightAuth = getAuth(app);
          window.toolflightDb = getFirestore(app);
        </script>

   4. Deploy firestore.rules (in the repo root) to the real project
      BEFORE writing any client code that reads/writes Firestore --
      verify it in the Rules Simulator first. Never deploy with the
      default "allow read, write: if true" rules, even temporarily.

   Note on secrecy: these config values (apiKey, etc.) are NOT secret
   in the way an API key normally is -- they're visible in any
   browser's dev tools regardless of how carefully this file is
   handled, by design of how Firebase Web SDK works. The actual
   security boundary is firestore.rules, not this file. Keeping this
   as a separate file is about clean configuration management, not
   secrecy. */

export const firebaseConfig = {
  apiKey: "REPLACE_WITH_REAL_API_KEY",
  authDomain: "REPLACE_WITH_REAL_PROJECT.firebaseapp.com",
  projectId: "REPLACE_WITH_REAL_PROJECT_ID",
  storageBucket: "REPLACE_WITH_REAL_PROJECT.appspot.com",
  messagingSenderId: "REPLACE_WITH_REAL_SENDER_ID",
  appId: "REPLACE_WITH_REAL_APP_ID"
};
