const fs = require('fs');
let src = fs.readFileSync('c:/Remembory/remembory/src/index.js', 'utf8');

const termsPage = `
function termsPage() {
  return \`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Terms of Service - Remembory</title>
<link href="https://fonts.googleapis.com/css2?family=Crimson+Text:ital,wght@0,400;0,600;1,400&family=Playfair+Display:ital,wght@0,700;1,400&display=swap" rel="stylesheet">
<style>
  body { font-family: 'Crimson Text', Georgia, serif; background: #f5f0e8; color: #2c2416; max-width: 720px; margin: 0 auto; padding: 40px 20px 80px; line-height: 1.8; }
  h1 { font-family: 'Playfair Display', serif; font-size: 2rem; font-style: italic; margin: 0 0 6px; }
  h2 { font-family: 'Playfair Display', serif; font-size: 1.3rem; margin: 32px 0 8px; color: #1a1208; }
  p, li { font-size: 1.05rem; color: #3a2a18; margin: 0 0 12px; }
  ul { padding-left: 24px; }
  .updated { font-size: 0.88rem; color: #8a7460; font-style: italic; margin-bottom: 28px; }
  a { color: #a8885a; }
  .nav { margin-bottom: 28px; font-size: 0.9rem; }
  .nav a { color: #8a7460; text-decoration: none; border-bottom: 1px solid rgba(138,116,96,0.3); }
</style>
</head>
<body>
<div class="nav"><a href="https://remembory.net">&larr; remembory.net</a> &middot; <a href="/privacy">Privacy Policy</a></div>
<h1>Terms of Service</h1>
<p class="updated">Last updated: 17 April 2026</p>

<p>These terms govern your use of Chronicle by Remembory ("the Service"), operated by Remembory ("we", "us"). By using the Service, you agree to these terms.</p>

<h2>1. What the Service Is</h2>
<p>Remembory provides Chronicle, a personal memory journal application. Your memories, photos, and personal data are encrypted on your device before being stored. We operate a zero-knowledge architecture: we cannot read, access, or recover your content.</p>

<h2>2. Accounts and Licence Keys</h2>
<ul>
<li>Access to subscriber features requires a valid licence key, obtained through a paid subscription via Stripe or PayPal.</li>
<li>Licence keys are tied to your email address. You are responsible for keeping your key and any encryption passwords secure.</li>
<li>If you lose your encryption password, we cannot recover your data. This is by design, to protect your privacy.</li>
</ul>

<h2>3. Your Data</h2>
<ul>
<li><strong>Ownership:</strong> You own all content you create in Chronicle. We claim no rights to your memories, photos, or personal data.</li>
<li><strong>Encryption:</strong> When you set a password, your data is encrypted client-side using AES-256-GCM. We store only the encrypted blob and cannot decrypt it.</li>
<li><strong>Storage:</strong> Data is stored locally on your device (browser storage) and, if you use cloud sync, as encrypted blobs on Cloudflare infrastructure.</li>
<li><strong>Portability:</strong> You can export a full backup of your data at any time from the Backup &amp; Restore screen.</li>
<li><strong>Deletion:</strong> You can delete your data from your device at any time. Cloud sync data expires automatically after 90 days of inactivity.</li>
</ul>

<h2>4. Sharing</h2>
<ul>
<li>When you share memories with others, the shared content (including photos) is transmitted to and stored on our servers so the recipient can access it.</li>
<li>Shared content is stored unencrypted on the server for up to 30 days, or until the recipient accepts or declines it.</li>
<li>You are responsible for ensuring you have the right to share any content, including photos of other people.</li>
</ul>

<h2>5. Subscriptions and Payment</h2>
<ul>
<li>Subscriptions are billed monthly or annually through Stripe or PayPal.</li>
<li>You may cancel at any time. Access continues until the end of your current billing period.</li>
<li>Refunds are available within 30 days of purchase if you have not used subscriber features. Contact us at <a href="mailto:admin@remembory.net">admin@remembory.net</a>.</li>
<li>Under Australian Consumer Law, you have additional rights that cannot be excluded by these terms.</li>
</ul>

<h2>6. Acceptable Use</h2>
<p>You agree not to:</p>
<ul>
<li>Use the Service to store or share illegal content</li>
<li>Abuse the sharing or sync features (e.g. using them as general file storage)</li>
<li>Attempt to access other users' data or interfere with the Service</li>
<li>Circumvent rate limits or security measures</li>
</ul>

<h2>7. Availability and Liability</h2>
<ul>
<li>We aim to keep the Service available but do not guarantee uninterrupted access. Scheduled maintenance and unforeseen outages may occur.</li>
<li>The Service is provided "as is". To the maximum extent permitted by law, we disclaim liability for data loss, service interruptions, or indirect damages.</li>
<li>We strongly recommend regular backups. The Backup &amp; Restore feature exists for this purpose.</li>
</ul>

<h2>8. Changes to These Terms</h2>
<p>We may update these terms from time to time. Material changes will be communicated through the app or by email. Continued use after changes constitutes acceptance.</p>

<h2>9. Contact</h2>
<p>Questions about these terms? Contact us at <a href="mailto:admin@remembory.net">admin@remembory.net</a>.</p>

</body>
</html>\`;
}
`;

const privacyPage = `
function privacyPage() {
  return \`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Privacy Policy - Remembory</title>
<link href="https://fonts.googleapis.com/css2?family=Crimson+Text:ital,wght@0,400;0,600;1,400&family=Playfair+Display:ital,wght@0,700;1,400&display=swap" rel="stylesheet">
<style>
  body { font-family: 'Crimson Text', Georgia, serif; background: #f5f0e8; color: #2c2416; max-width: 720px; margin: 0 auto; padding: 40px 20px 80px; line-height: 1.8; }
  h1 { font-family: 'Playfair Display', serif; font-size: 2rem; font-style: italic; margin: 0 0 6px; }
  h2 { font-family: 'Playfair Display', serif; font-size: 1.3rem; margin: 32px 0 8px; color: #1a1208; }
  h3 { font-family: 'Playfair Display', serif; font-size: 1.1rem; margin: 20px 0 6px; color: #3a2a18; }
  p, li { font-size: 1.05rem; color: #3a2a18; margin: 0 0 12px; }
  ul { padding-left: 24px; }
  .updated { font-size: 0.88rem; color: #8a7460; font-style: italic; margin-bottom: 28px; }
  a { color: #a8885a; }
  .nav { margin-bottom: 28px; font-size: 0.9rem; }
  .nav a { color: #8a7460; text-decoration: none; border-bottom: 1px solid rgba(138,116,96,0.3); }
  .highlight { background: rgba(74,122,90,0.08); border: 1px solid rgba(74,122,90,0.2); border-radius: 4px; padding: 14px 18px; margin: 16px 0; }
  .highlight p { margin: 0; color: #3a6b4a; }
</style>
</head>
<body>
<div class="nav"><a href="https://remembory.net">&larr; remembory.net</a> &middot; <a href="/terms">Terms of Service</a></div>
<h1>Privacy Policy</h1>
<p class="updated">Last updated: 17 April 2026</p>

<div class="highlight">
<p><strong>The short version:</strong> Remembory is designed so that we cannot read your memories, even if we wanted to. Your data is encrypted on your device before it ever reaches our servers. We collect the minimum information needed to operate the service.</p>
</div>

<h2>1. Our Privacy Architecture</h2>
<p>Remembory uses a <strong>zero-knowledge</strong> design. When you set a password on your Chronicle:</p>
<ul>
<li>Your memories, photos, and personal data are encrypted using AES-256-GCM with a key derived from your password (PBKDF2, 200,000 iterations)</li>
<li>Encryption and decryption happen entirely in your browser</li>
<li>We store only the encrypted blob &mdash; we do not have your password and cannot decrypt your data</li>
<li>If you use cloud sync, your data is encrypted with your sync passphrase before upload</li>
</ul>

<h2>2. What We Collect</h2>

<h3>Information you provide</h3>
<ul>
<li><strong>Email address:</strong> Used for licence key issuance and share notifications. Stored as a one-way HMAC hash on our servers &mdash; we do not store your email in plain text.</li>
<li><strong>Payment information:</strong> Processed by Stripe or PayPal. We never see or store your card details.</li>
<li><strong>Contact form messages:</strong> If you contact us through the app, we receive your message and any name/email you provide.</li>
</ul>

<h3>Information stored on your device</h3>
<ul>
<li>Your memories, photos, people, locations, and all Chronicle content are stored in your browser's local storage and IndexedDB</li>
<li>This data does not leave your device unless you explicitly share, sync, or publish</li>
</ul>

<h3>Information on our servers</h3>
<ul>
<li><strong>Licence records:</strong> Licence key hash, email hash, subscription status, creation date</li>
<li><strong>Cloud sync:</strong> Your encrypted data blob (we cannot read it) and encrypted photos, stored for up to 90 days</li>
<li><strong>Shares:</strong> When you share memories, the shared content is stored temporarily (up to 30 days) so the recipient can retrieve it</li>
<li><strong>Public profiles:</strong> If you choose to publish a profile, the memories you mark as public are stored on our servers</li>
</ul>

<h3>Information we do NOT collect</h3>
<ul>
<li>No analytics or tracking scripts</li>
<li>No cookies (the app uses only browser local storage)</li>
<li>No advertising or marketing trackers</li>
<li>No third-party analytics (no Google Analytics, no Mixpanel, nothing)</li>
</ul>

<h2>3. How We Use Your Information</h2>
<ul>
<li>Email hash: to deliver shared memories and licence-related notifications</li>
<li>Licence key hash: to validate your subscription status</li>
<li>Contact messages: to respond to your support requests</li>
</ul>
<p>We do not sell, rent, or share your information with third parties for marketing purposes.</p>

<h2>4. Third-Party Services</h2>
<p>We use the following services to operate Remembory:</p>
<ul>
<li><strong>Cloudflare</strong> (Workers, KV, R2): Hosts the application and stores encrypted data. <a href="https://www.cloudflare.com/privacypolicy/">Cloudflare Privacy Policy</a></li>
<li><strong>Stripe:</strong> Payment processing. <a href="https://stripe.com/privacy">Stripe Privacy Policy</a></li>
<li><strong>PayPal:</strong> Payment processing. <a href="https://www.paypal.com/webapps/mpp/ua/privacy-full">PayPal Privacy Policy</a></li>
<li><strong>Resend:</strong> Transactional email delivery (share notifications, contact form). <a href="https://resend.com/legal/privacy-policy">Resend Privacy Policy</a></li>
<li><strong>OpenStreetMap Nominatim:</strong> Geocoding for the map feature. No personal data is sent &mdash; only location names. <a href="https://osmfoundation.org/wiki/Privacy_Policy">OSM Privacy Policy</a></li>
</ul>

<h2>5. Data Retention</h2>
<ul>
<li><strong>Local data:</strong> Stored until you delete it or clear your browser storage</li>
<li><strong>Cloud sync:</strong> Encrypted blobs expire after 90 days of inactivity</li>
<li><strong>Shared content:</strong> Expires after 30 days, or when accepted/declined by the recipient</li>
<li><strong>Licence records:</strong> Retained for the duration of your subscription plus 12 months</li>
<li><strong>Contact messages:</strong> Retained in our email inbox; deleted when no longer needed</li>
</ul>

<h2>6. Your Rights</h2>
<p>You have the right to:</p>
<ul>
<li><strong>Access:</strong> Export all your data at any time via Backup &amp; Restore</li>
<li><strong>Delete:</strong> Remove all data from your device at any time. Request deletion of server-side data by contacting us.</li>
<li><strong>Portability:</strong> Your backup file is a standard JSON format you can use independently of Remembory</li>
<li><strong>Withdraw consent:</strong> Stop using the service at any time. Cancel your subscription through Stripe or PayPal.</li>
</ul>
<p>For data deletion requests or privacy concerns, contact <a href="mailto:admin@remembory.net">admin@remembory.net</a>.</p>

<h2>7. Children</h2>
<p>Remembory is not directed at children under 16. We do not knowingly collect information from children. If you believe a child has provided us with personal information, please contact us.</p>

<h2>8. Changes to This Policy</h2>
<p>We may update this policy from time to time. Material changes will be communicated through the app. The "Last updated" date at the top reflects the most recent revision.</p>

<h2>9. Contact</h2>
<p>For privacy-related questions or requests:<br>
<a href="mailto:admin@remembory.net">admin@remembory.net</a></p>

</body>
</html>\`;
}
`;

// Insert before adminPage()
const insertPoint = src.indexOf('function adminPage()');
if (insertPoint === -1) { console.error('Could not find adminPage'); process.exit(1); }
src = src.slice(0, insertPoint) + termsPage + '\n' + privacyPage + '\n' + src.slice(insertPoint);
fs.writeFileSync('c:/Remembory/remembory/src/index.js', src, 'utf8');
console.log('Legal pages inserted');
