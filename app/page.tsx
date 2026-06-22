import { getRepresentativeEntries, getWordOfDay } from '../lib/db';
import { convertPinyin } from '../lib/pinyin';
import HomeClient from './components/HomeClient';

export default async function Home() {
  let chips: [string, string][] = [];
  let wordOfDay: any = null;

  try {
    const all = await getRepresentativeEntries(1);
    chips = all
      .slice(0, 5)
      .filter((e: any) => e.simplified && e.pinyin)
      .map((e: any) => [e.simplified, convertPinyin(e.pinyin)] as [string, string]);
  } catch (err) {
    console.error('[Home] failed to load chips:', err);
  }

  try {
    wordOfDay = await getWordOfDay();
  } catch (err) {
    console.error('[Home] failed to load word of day:', err);
  }

  return <HomeClient initialChips={chips} wordOfDay={wordOfDay} />;
}
