import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'HanziDict',
    short_name: 'HanziDict',
    description: 'Free Chinese dictionary with 124,000 entries, stroke order animations, and example sentences.',
    start_url: '/',
    display: 'standalone',
    background_color: '#171614',
    theme_color: '#1D9E75',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
