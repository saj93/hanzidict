import { getRepresentativeEntries } from '../lib/db';
import { convertPinyin } from '../lib/pinyin';
import HomeClient from './components/HomeClient';

export default async function Home() {
  let chips: [string, string, string][] = [];
  try {
    // getRepresentativeEntries deduplicates by simplified character so that
    // duoyinzi (多音字) always show their most common reading here.
    const all = await getRepresentativeEntries(1);
    chips = all
      .slice(0, 5)
      .filter((e: any) => e.simplified && e.pinyin)
      .map((e: any) => [e.simplified, e.traditional || e.simplified, convertPinyin(e.pinyin)] as [string, string, string]);
  } catch {
    // chips stays empty — HomeClient handles this gracefully
  }

  return <HomeClient initialChips={chips} />;
}
