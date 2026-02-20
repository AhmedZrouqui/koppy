export default function PrivacyPolicy() {
  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "40px 20px", fontFamily: "sans-serif", lineHeight: "1.6" }}>
      <h1>Privacy Policy — Koppy</h1>
      <p><em>Last updated: February 19, 2026</em></p>

      <h2>1. Data We Collect</h2>
      <p>Koppy collects the following data when you install and use our app:</p>
      <ul>
        <li>Your Shopify store domain and access token (required for authentication)</li>
        <li>Product data you choose to import</li>
        <li>Billing and subscription status</li>
      </ul>

      <h2>2. How We Use Your Data</h2>
      <p>We use your data solely to provide the import service. We do not sell, share, or use your data for advertising purposes.</p>

      <h2>3. Data Storage</h2>
      <p>Your data is stored securely on Railway (cloud infrastructure) and is never shared with third parties except Shopify for authentication purposes.</p>

      <h2>4. Third Party Services</h2>
      <ul>
        <li><strong>Shopify</strong> — authentication and product management</li>
        <li><strong>OpenAI</strong> — optional AI description rewriting (no data retained)</li>
        <li><strong>Railway</strong> — hosting and database</li>
        <li><strong>Upstash</strong> — job queue processing</li>
      </ul>

      <h2>5. Data Deletion</h2>
      <p>When you uninstall Koppy, your session data is deleted automatically. To request full data deletion, email us at the address below.</p>

      <h2>6. Contact</h2>
      <p>For any privacy concerns: <a href="mailto:zrouqui.ahmed.az@gmail.com">zrouqui.ahmed.az@gmail.com</a></p>
    </div>
  );
}