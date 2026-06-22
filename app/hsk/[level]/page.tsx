import HskClient from './HskClient';

const LABEL: Record<string, string> = {
  '1': 'HSK 1', '2': 'HSK 2', '3': 'HSK 3',
  '4': 'HSK 4', '5': 'HSK 5', '6': 'HSK 6', '7': 'HSK 7–9',
};

export async function generateMetadata({ params }: { params: Promise<{ level: string }> }) {
  const { level } = await params;
  const label = LABEL[level] ?? `HSK ${level}`;
  return { title: `${label} Vocabulary — HanziDict` };
}

export default function HskPage() {
  return <HskClient />;
}
