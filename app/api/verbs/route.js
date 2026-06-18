import verbs from '../../../content/verbs.json';

export async function GET() {
  return Response.json({ entries: verbs });
}
