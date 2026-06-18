import { getPost, getAllPosts } from '@/lib/blog';
import { MDXRemote } from 'next-mdx-remote/rsc';
import remarkGfm from 'remark-gfm';
import BlogPostClient from '../../components/BlogPostClient';
import InlineSvgImg from '../../components/InlineSvgImg';

export async function generateStaticParams() {
  return getAllPosts().map(p => ({ slug: p.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const { frontmatter } = getPost(slug);
  const url = `https://hanzidict.vercel.app/blog/${slug}`;

  return {
    title: `${frontmatter.title} — HanziDict`,
    description: frontmatter.description,
    keywords: `Chinese, Mandarin, ${frontmatter.category ?? ''}, ${frontmatter.level ?? ''}, HanziDict`,
    alternates: { canonical: url },
    openGraph: {
      title: frontmatter.title,
      description: frontmatter.description,
      url,
      siteName: 'HanziDict',
      locale: 'en_US',
      type: 'article',
      publishedTime: frontmatter.date,
      section: frontmatter.category,
    },
    twitter: {
      card: 'summary',
      title: frontmatter.title,
      description: frontmatter.description,
    },
  };
}

export default async function BlogPostPage({ params }) {
  const { slug } = await params;
  const { frontmatter, content } = getPost(slug);
  const url = `https://hanzidict.vercel.app/blog/${slug}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: frontmatter.title,
    description: frontmatter.description,
    datePublished: frontmatter.date,
    url,
    publisher: { '@type': 'Organization', name: 'HanziDict', url: 'https://hanzidict.vercel.app' },
  };

  const mdx = await MDXRemote({ source: content, options: { mdxOptions: { remarkPlugins: [remarkGfm] } }, components: { img: InlineSvgImg } });
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <BlogPostClient frontmatter={frontmatter}>{mdx}</BlogPostClient>
    </>
  );
}
