import WordClient from './WordClient';

export async function generateMetadata({ params }: { params: Promise<{ hanzi: string }> }) {
  const { hanzi } = await params;
  return { title: `${decodeURIComponent(hanzi)} — HanziDict` };
}

export default function WordPage() {
  return <WordClient />;
}
