/* ToolFlight Invoice & Business Manager -- EmailJS config.
   ====================================================================
   STATUS: Placeholder. No real EmailJS account has been connected --
   the values below must be replaced before invitation emails will
   actually send. Team invites will still be created correctly in
   Firestore either way (that's the core, functioning feature); this
   only controls whether the invited person also receives an email
   telling them about it.

   WHY EmailJS SPECIFICALLY: sending real email requires either a
   backend (Cloud Functions + an email provider, e.g. the Firebase
   "Trigger Email" extension with SendGrid) or a client-side email API
   designed for static sites with no backend. This project is
   deliberately a static site deployed on Netlify with no Cloud
   Functions anywhere in it (see INVOICE_ARCHITECTURE.md) -- adding
   Cloud Functions now would be a real architecture change, not a small
   fix, and would require upgrading the Firebase project to the Blaze
   (pay-as-you-go) plan. EmailJS is a legitimate, production-grade
   service built specifically for this "static site, no backend" case:
   it accepts an email-send request directly from browser JS, using a
   public key (safe to expose, same category as a Firebase Web API key)
   and a template you configure in their dashboard -- not a workaround.

   ---- Setup required before this works ----
   1. Create a free account at https://www.emailjs.com
   2. Add an Email Service (e.g. connect a Gmail/Outlook account, or use
      their default test service) -- this gives you a Service ID.
   3. Create an Email Template with these variables (all four are sent
      by js/invoice-team.js on every invite):
        {{to_email}}        -- the invited person's email
        {{business_name}}   -- the inviting business's name
        {{inviter_email}}   -- the email of whoever sent the invite
        {{role}}            -- the role/permission label they're invited as
        {{invoice_maker_url}} -- link back to invoice-maker.html to accept
      This gives you a Template ID.
   4. Account > General > find your Public Key.
   5. Replace the three REPLACE_WITH_REAL_* values below.

   Note on secrecy: EmailJS's Public Key is meant to be used exactly
   this way -- directly in frontend code, the same category of "not a
   server secret" as a Firebase Web API key. No EmailJS private/secret
   key belongs anywhere in this file or this frontend. */

export const emailjsConfig = {
  serviceId: "REPLACE_WITH_REAL_EMAILJS_SERVICE_ID",
  templateId: "REPLACE_WITH_REAL_EMAILJS_TEMPLATE_ID",
  publicKey: "REPLACE_WITH_REAL_EMAILJS_PUBLIC_KEY",
};

export function isEmailjsConfigured() {
  return Object.values(emailjsConfig).every(v => typeof v === "string" && !v.startsWith("REPLACE_WITH_REAL_"));
}
