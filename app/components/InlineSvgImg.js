import path from 'path';
import { readFile } from 'fs/promises';

const INLINE_SVGS = new Set(['chinese-language-tree.svg', 'chinese-languages-map.svg']);

export default async function InlineSvgImg({ src, alt, ...rest }) {
  const filename = src?.split('/').pop();

  if (src?.endsWith('.svg') && INLINE_SVGS.has(filename)) {
    const filePath = path.join(process.cwd(), 'public', src);
    try {
      const svg = await readFile(filePath, 'utf-8');
      return (
        <span
          className="blog-inline-svg"
          dangerouslySetInnerHTML={{ __html: svg }}
          aria-label={alt}
          role="img"
        />
      );
    } catch {
      // fall through to regular img
    }
  }

  return <img src={src} alt={alt} {...rest} />;
}
