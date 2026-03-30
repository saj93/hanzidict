import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// In-memory cache to avoid regenerating for the same word
const cache = new Map();

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const word = searchParams.get('word')?.trim();
  if (!word) return Response.json({ error: 'missing word' }, { status: 400 });

  if (cache.has(word)) return Response.json(cache.get(word));

  const prompt = `Generate one short, natural, grammatically correct example sentence in Mandarin Chinese using the word "${word}".

Return ONLY a JSON object with these three fields:
- "zh": the Chinese sentence using simplified characters
- "pinyin": full pinyin romanization with tone marks (not numbers)
- "en": natural English translation

Rules:
- The sentence must actually contain "${word}"
- Keep it short (under 12 words)
- Use everyday conversational Chinese
- The English must be natural — never use placeholder text like "I like [word]"
- Return raw JSON only, no markdown, no explanation`;

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content[0].text.trim();
    // Strip any accidental markdown fences
    const json = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    const result = JSON.parse(json);

    if (!result.zh || !result.pinyin || !result.en) {
      throw new Error('incomplete response');
    }

    cache.set(word, result);
    return Response.json(result);
  } catch (e) {
    return Response.json({ error: 'generation failed' }, { status: 500 });
  }
}
