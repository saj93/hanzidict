'use client';

import { useRouter } from 'next/navigation';
import Nav from '../components/Nav';
import Footer from '../components/Footer';

const RESOURCES = [
  {
    title: 'Phrasebook',
    description: 'Situational phrases for real conversations — greetings, travel, shopping, and more.',
    href: '/phrasebook',
    icon: '💬',
  },
  {
    title: 'Common Verbs',
    description: 'The 100 most common Chinese verbs with pinyin, meaning, and audio.',
    href: '/verbs',
    icon: '⚡',
  },
  {
    title: 'Chengyu',
    description: 'Chinese four-character idioms with explanations and example usage.',
    href: '/chengyu',
    icon: '📖',
  },
  {
    title: 'Radicals',
    description: 'Browse characters by radical — understand how Chinese characters are built.',
    href: '/radicals',
    icon: '⊞',
  },
];

export default function ResourcesPage() {
  const router = useRouter();

  return (
    <main>
      <Nav />
      <div className="resources-wrap">
        <div className="resources-hero">
          <h1 className="resources-title">Resources</h1>
          <p className="resources-sub">Tools and references to support your Chinese learning.</p>
        </div>
        <div className="resources-grid">
          {RESOURCES.map(r => (
            <button
              key={r.href}
              className="resources-card"
              onClick={() => router.push(r.href)}
            >
              <div className="resources-card-icon">{r.icon}</div>
              <div className="resources-card-title">{r.title}</div>
              <div className="resources-card-desc">{r.description}</div>
              <div className="resources-card-link">Explore →</div>
            </button>
          ))}
        </div>
      </div>
      <Footer />
    </main>
  );
}
