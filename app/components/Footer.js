'use client';

import { useRouter } from 'next/navigation';
import NewsletterForm from './NewsletterForm';

const HSK_LINKS = [
  { level: 1, label: 'HSK 1' },
  { level: 2, label: 'HSK 2' },
  { level: 3, label: 'HSK 3' },
  { level: 4, label: 'HSK 4' },
  { level: 5, label: 'HSK 5' },
  { level: 6, label: 'HSK 6' },
  { level: 7, label: 'HSK 7–9' },
];

export default function Footer({ compactNewsletter = false }) {
  const router = useRouter();
  return (
    <footer className="site-footer">
      {compactNewsletter && <NewsletterForm compact />}
      <div className="footer-hsk-links">
        {HSK_LINKS.map((h, i) => (
          <span key={h.level}>
            {i > 0 && <span className="footer-dot">·</span>}
            <button className="footer-hsk-btn" onClick={() => router.push(`/hsk/${h.level}`)}>
              {h.label}
            </button>
          </span>
        ))}
      </div>
      <div className="footer-secondary-links">
        <button className="footer-sec-btn" onClick={() => router.push('/phrasebook')}>Phrasebook</button>
        <span className="footer-dot">·</span>
        <button className="footer-sec-btn" onClick={() => router.push('/learn')}>Learn</button>
        <span className="footer-dot">·</span>
        <button className="footer-sec-btn" onClick={() => router.push('/about')}>About</button>
      </div>
      <div className="footer-bottom">
        <span>HanziDict · Data from CC-CEDICT (CC BY-SA 4.0)</span>
        <span>Open source · GitHub</span>
      </div>
    </footer>
  );
}
