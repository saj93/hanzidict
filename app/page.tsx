import { getHomepageSamples, getWordOfDay } from '../lib/db';
import { convertPinyin } from '../lib/pinyin';
import HomeClient from './components/HomeClient';

export const revalidate = 300; // re-render homepage at most every 5 minutes

export default async function Home() {
  let chips: [string, string][] = [];
  let wordOfDay: any = null;

  const [samples, dailyWord] = await Promise.allSettled([
    getHomepageSamples(),
    getWordOfDay(),
  ]);

  if (samples.status === 'fulfilled') {
    chips = samples.value
      .filter((e: any) => e.simplified && e.pinyin)
      .map((e: any) => [e.simplified, convertPinyin(e.pinyin)] as [string, string]);
  } else {
    console.error('[Home] failed to load chips:', samples.reason);
  }

  if (dailyWord.status === 'fulfilled') {
    wordOfDay = dailyWord.value;
  } else {
    console.error('[Home] failed to load word of day:', dailyWord.reason);
  }

  return <HomeClient initialChips={chips} wordOfDay={wordOfDay} />;
}
