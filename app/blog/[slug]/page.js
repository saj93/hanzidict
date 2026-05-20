import { getPost, getAllPosts } from '@/lib/blog';
import { MDXRemote } from 'next-mdx-remote/rsc';
import BlogPostClient from '../../components/BlogPostClient';

export async function generateStaticParams() {
  return getAllPosts().map(p => ({ slug: p.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const { frontmatter } = getPost(slug);
  return { title: `${frontmatter.title} — HanziDict` };
}

export default async function BlogPostPage({ params }) {
  const { slug } = await params;
  const { frontmatter, content } = getPost(slug);
  const mdx = await MDXRemote({ source: content });
  return <BlogPostClient frontmatter={frontmatter}>{mdx}</BlogPostClient>;
}
