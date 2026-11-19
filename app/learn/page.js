import Link from 'next/link';
import Nav from '../components/Nav';
import Footer from '../components/Footer';

export const metadata = { title: 'Learn — HanziDict' };

const EXPLORE_RESOURCES = [
  { title: 'Tone practice', desc: 'Train your ear to recognise the four Mandarin tones', href: '/learn/tones' },
  { title: 'Words by Topic', desc: 'Essential vocabulary grouped by theme', href: '/learn/words' },
  { title: 'Phrasebook', desc: 'Phrases for real conversations', href: '/phrasebook' },
  { title: 'Common Verbs', desc: 'The 100 most common Chinese verbs', href: '/verbs' },
  { title: 'Chengyu', desc: 'Four-character idioms with explanations', href: '/chengyu' },
  { title: 'Radicals', desc: 'Browse characters by their building blocks', href: '/radicals' },
];

export default function LearnPage() {
  return (
    <main>
      <Nav hideScript />
      <div className="learn-hub">
        <header className="learn-hub-header">
          <h1>Learn</h1>
          <p>Choose a path, or follow your curiosity.</p>
        </header>
        <section className="learn-hub-path" aria-labelledby="learning-path-title">
          <div>
            <h2 id="learning-path-title">Learning path <span>11 units</span></h2>
            <p>A guided route through everyday Mandarin, one topic at a time.</p>
          </div>
          <Link href="/learn/path" className="learn-hub-cta">View 11 units <span aria-hidden="true">→</span></Link>
        </section>
        <section aria-labelledby="explore-freely-title">
          <div className="learn-explore-heading">
            <h2 id="explore-freely-title" className="learn-explore-title">Explore freely</h2>
            <p className="learn-explore-sub">No order needed — jump into any topic.</p>
          </div>
          <div className="learn-resource-grid">
            {EXPLORE_RESOURCES.map(r => (
              <Link key={r.href} className="learn-resource-tile" href={r.href}>
                <div className="learn-resource-tile-top">
                  <span className="learn-resource-tile-name">{r.title}</span>
                  <span className="learn-resource-tile-arrow" aria-hidden="true">→</span>
                </div>
                <div className="learn-resource-tile-desc">{r.desc}</div>
              </Link>
            ))}
          </div>
        </section>
      </div>
      <Footer />
    </main>
  );
}
