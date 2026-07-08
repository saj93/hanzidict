'use client';

import NewsletterForm from './NewsletterForm';

export default function Footer({ compactNewsletter = false }) {
  return (
    <footer className="site-footer">
      {compactNewsletter && <NewsletterForm compact />}
      <div className="footer-bottom">
        <span>HanziDict · Data from CC-CEDICT (CC BY-SA 4.0)</span>
        <span>Open source · GitHub</span>
      </div>
    </footer>
  );
}
