import RadicalClient from './RadicalClient';

export async function generateMetadata({ params }: { params: Promise<{ radical: string }> }) {
  const { radical } = await params;
  return { title: `${decodeURIComponent(radical)} — Radical — HanziDict` };
}

export default function RadicalPage() {
  return <RadicalClient />;
}
