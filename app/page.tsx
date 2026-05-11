import { getFlashcards } from '../lib/db';
import { convertPinyin } from '../lib/pinyin';
import HomeClient from './components/HomeClient';

export default async function Home() {
  let chips: [string, string][] = [];
  try {
    const all = await getFlashcards(1);
    chips = all
      .slice(0, 5)
      .filter((e: any) => e.simplified && e.pinyin)
      .map((e: any) => [e.simplified, convertPinyin(e.pinyin)] as [string, string]);
  } catch {
    // chips stays empty — HomeClient handles this gracefully
  }

  return <HomeClient initialChips={chips} />;
}
