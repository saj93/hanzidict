import { unstable_cache } from 'next/cache';
import { getExamples, getRelated, getWordCharacters } from './db.js';

// Only public dictionary data: no cookies, bearer tokens or account state.
// Cache arguments include the word. Admin edits expire the matching data tags.
export const cachedExamples = unstable_cache(
  async word => getExamples(word), ['word-examples-v1'],
  { revalidate: 300, tags: ['word-examples'] },
);
export const cachedRelated = unstable_cache(
  async word => getRelated(word), ['word-related-v1'],
  { revalidate: 300, tags: ['word-dictionary'] },
);
export const cachedCharacters = unstable_cache(
  async word => getWordCharacters(word), ['word-characters-v1'],
  { revalidate: 300, tags: ['word-dictionary'] },
);
