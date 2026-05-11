import type { MetadataRoute } from 'next';

const BASE = 'https://hanzidict.vercel.app';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: BASE, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${BASE}/about`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/flashcards`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    ...[1, 2, 3, 4, 5, 6, 7].map(level => ({
      url: `${BASE}/hsk/${level}`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
  ];
}
