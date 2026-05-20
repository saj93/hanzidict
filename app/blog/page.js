import { getAllPosts } from '@/lib/blog';
import BlogIndexClient from '../components/BlogIndexClient';

export const metadata = { title: 'Blog — HanziDict' };

export default function BlogPage() {
  const posts = getAllPosts();
  return <BlogIndexClient posts={posts} />;
}
