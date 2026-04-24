import { getUserFromToken, getDueCards, upsertProgress } from '@/lib/db';

function sm2(easeFactor, interval, rating) {
  // SM-2 algorithm: rating is 0 (Again), 3 (Hard), 4 (Good), 5 (Easy)
  let ef = easeFactor;
  let iv = interval;

  if (rating < 3) {
    // Again — reset
    iv = 1;
    ef = Math.max(1.3, ef - 0.2);
  } else {
    if (rating === 3) {
      ef = Math.max(1.3, ef - 0.15);
      iv = Math.max(1, Math.round(iv * 1.2));
    } else if (rating === 4) {
      iv = Math.max(1, Math.round(iv * ef));
    } else {
      ef = ef + 0.1;
      iv = Math.max(1, Math.round(iv * ef * 1.3));
    }
  }

  const due = new Date();
  due.setDate(due.getDate() + iv);
  return { easeFactor: ef, interval: iv, dueDate: due.toISOString() };
}

async function getUser(request) {
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  return getUserFromToken(token);
}

export async function GET(request) {
  const user = await getUser(request);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const hsk = parseInt(searchParams.get('hsk') || '1', 10);

  const cards = await getDueCards(user.id, hsk, 20);
  return Response.json({ cards });
}

export async function POST(request) {
  const user = await getUser(request);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { simplified, hsk_level, rating, ease_factor = 2.5, interval = 1, reviews = 0 } = body;

  if (!simplified || rating === undefined) {
    return Response.json({ error: 'Missing fields' }, { status: 400 });
  }

  const ratingMap = { again: 0, hard: 3, good: 4, easy: 5 };
  const numRating = typeof rating === 'string' ? (ratingMap[rating] ?? 4) : rating;

  const { easeFactor, interval: newInterval, dueDate } = sm2(ease_factor, interval, numRating);
  await upsertProgress(user.id, simplified, hsk_level, easeFactor, newInterval, dueDate, reviews + 1);

  return Response.json({ easeFactor, interval: newInterval, dueDate });
}
