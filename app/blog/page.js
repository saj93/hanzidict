import { getAllPosts } from '@/lib/blog';
import BlogIndexClient from '../components/BlogIndexClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Blog — HanziDict' };

export default async function BlogPage() {
  const posts = await getAllPosts();
  return <BlogIndexClient posts={posts} />;
}
