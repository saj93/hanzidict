import { NextResponse } from 'next/server';
import { getUserFromToken, isAdmin } from '@/lib/db';
import fs from 'fs/promises';
import path from 'path';

const SITUATIONS_PATH = path.join(process.cwd(), 'content/phrasebook/situations.json');

async function getAuthedUser(req) {
  const auth = req.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  return getUserFromToken(token);
}

export async function PATCH(request, { params }) {
  const user = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const admin = await isAdmin(user.id);
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { situationId, phraseKey } = await params;
  const body = await request.json();
  const { hanzi, pinyin, english } = body;

  if (!hanzi || !pinyin || !english) {
    return NextResponse.json({ error: 'hanzi, pinyin, english are required' }, { status: 400 });
  }

  // phraseKey format: s{sectionIdx}p{phraseIdx}
  const m = phraseKey.match(/^s(\d+)p(\d+)$/);
  if (!m) return NextResponse.json({ error: 'Invalid phraseKey' }, { status: 400 });
  const sectionIdx = parseInt(m[1], 10);
  const phraseIdx = parseInt(m[2], 10);

  const raw = await fs.readFile(SITUATIONS_PATH, 'utf-8');
  const situations = JSON.parse(raw);

  const situation = situations.find(s => s.id === situationId);
  if (!situation) return NextResponse.json({ error: 'Situation not found' }, { status: 404 });

  const section = situation.sections[sectionIdx];
  if (!section) return NextResponse.json({ error: 'Section not found' }, { status: 404 });

  const phrase = section.phrases[phraseIdx];
  if (!phrase) return NextResponse.json({ error: 'Phrase not found' }, { status: 404 });

  phrase.hanzi = hanzi.trim();
  phrase.pinyin = pinyin.trim();
  phrase.english = english.trim();

  await fs.writeFile(SITUATIONS_PATH, JSON.stringify(situations, null, 2), 'utf-8');
  return NextResponse.json({ phrase });
}
