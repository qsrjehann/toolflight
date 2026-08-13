/* ToolFlight Invoice & Business Manager -- Firebase config.
   ====================================================================
   STATUS: CONNECTED to a real Firebase project (toolflight-invoice),
   as of the config values below. Firestore (default database, nam5)
   and Email/Password Authentication have been enabled in that project's
   Firebase Console by its owner.

   IMPORTANT, stated plainly: the values below being real does not by
   itself mean this code has been tested against that live project.
   This sandbox has no network access to Firebase's servers (verified:
   both firestore.googleapis.com and the Firebase SDK CDN return 403
   here), so no actual Auth/Firestore call from this code has been
   executed anywhere, regardless of these values being genuine. See the
   Phase 12 report for exactly what was and wasn't verified.

   js/invoice-auth.js loads the Firebase Web SDK itself via dynamic
   import() (not a separate <head> script tag) -- no HTML changes are
   needed for this connection to take effect once deployed somewhere
   with real network access.

   Before this is truly live:
   1. Deploy firestore.rules to this project -- verify in the real
      Rules Simulator first. Never deploy with the default
      "allow read, write: if true" rules, even temporarily.
   2. Deploy firestore.indexes.json (or let Firebase's own
      missing-index error auto-link you to create it).

   Note on secrecy: these config values (apiKey, etc.) are NOT secret
   in the way a server API key normally is -- they're visible in any
   browser's dev tools regardless of how carefully this file is
   handled, by design of how Firebase Web SDK works. The actual
   security boundary is firestore.rules, not this file. No Firebase
   Admin SDK credentials, service-account keys, or other genuine
   secrets belong in this file or anywhere else in this frontend --
   none are present here.

   Key rotation note: the apiKey below was rotated after the previous
   key leaked and was subsequently expired/revoked by Google
   (auth/api-key-expired), which was the confirmed root cause of Google
   Sign-In failing across every browser/domain tested. If Google Sign-In
   (or any Firebase call) starts failing again with an
   auth/api-key-expired or similar credential error, check this exact
   file first before re-investigating OAuth client / authorized-domain
   configuration -- those were all individually verified correct during
   that investigation and were not the cause. */

export const firebaseConfig = {
  apiKey: "AIzaSyC2PVmJfYoMofwsbWJcA7xU6qtBVbmWmaw",
  authDomain: "toolflight-invoice.firebaseapp.com",
  projectId: "toolflight-invoice",
  storageBucket: "toolflight-invoice.firebasestorage.app",
  messagingSenderId: "847221888840",
  appId: "1:847221888840:web:49a2818fc9bc29a669c57d",
  measurementId: "G-JMT9ZPNDYX"
};
