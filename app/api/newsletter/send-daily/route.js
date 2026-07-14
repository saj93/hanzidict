import Anthropic from '@anthropic-ai/sdk';
import { Resend } from 'resend';
import { getWordOfDay } from '../../../../lib/db';
import { convertPinyin } from '../../../../lib/pinyin';
import { firstDef } from '../../../../lib/utils';

export const dynamic = 'force-dynamic';

// ── Claude AI lesson generation ────────────────────────────────────────────

function buildWordPrompt(hanzi, pinyin, definition) {
  return `Chinese word of the day: ${hanzi} (${pinyin}) — ${definition}

Write 3 sections. Be ruthlessly brief — every section MUST be one sentence only.

1. EXAMPLE: [Chinese sentence] ([pinyin]) — [English, max 10 words]
2. USAGE: [When to use this vs an alternative, max 15 words]
3. TIP: [One cultural note or common mistake, max 15 words]

Plain text only. No extra explanation.`;
}

function buildChengyuPrompt(hanzi, pinyin, meaning) {
  return `Chinese chengyu of the day: ${hanzi} (${pinyin}) — ${meaning}

Write 3 sections. Be ruthlessly brief — every section MUST be one sentence only.

1. EXAMPLE: [Chinese sentence] ([pinyin]) — [English, max 10 words]
2. STORY: [Historical origin in one clause, max 15 words]
3. TIP: [Formal/casual/written/spoken? One common mistake, max 15 words]

Plain text only. No extra explanation.`;
}

async function generateLesson(wordData) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const pinyin = convertPinyin(wordData.pinyin);
  const def = firstDef(wordData.definitions);

  const prompt = wordData.isChengyu
    ? buildChengyuPrompt(wordData.simplified, pinyin, def)
    : buildWordPrompt(wordData.simplified, pinyin, def);

  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 220,
    messages: [{ role: 'user', content: prompt }],
  });

  return msg.content[0]?.text ?? '';
}

// ── Response parser ────────────────────────────────────────────────────────

function parseSections(text, isChengyu) {
  const labels = isChengyu
    ? ['EXAMPLE', 'STORY', 'TIP']
    : ['EXAMPLE', 'USAGE', 'TIP'];

  // Match "LABEL:", "LABEL\n", "1. LABEL:", "1. LABEL\n" — Claude may omit colons/numbers
  const labelPattern = (l) => new RegExp(`(?:^\\d+\\.\\s*)?\\b${l}\\b[:\\s]`, 'im');

  const positions = labels.map(l => {
    const m = text.match(labelPattern(l));
    return m ? m.index : -1;
  });

  const sections = {};
  labels.forEach((label, i) => {
    if (positions[i] === -1) { sections[label] = ''; return; }
    // Skip past the label word (and optional colon/space)
    const m = text.slice(positions[i]).match(labelPattern(label));
    const contentStart = positions[i] + m[0].length;
    const nextPos = labels.slice(i + 1).map((_, j) => positions[i + 1 + j]).find(p => p > positions[i]) ?? -1;
    sections[label] = text.slice(contentStart, nextPos === -1 ? undefined : nextPos).trim();
  });
  return sections;
}

// ── Email HTML builder ─────────────────────────────────────────────────────

function contentBlock(label, text, accentColor) {
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px; background:#f8f7f4; border-radius:8px; border-left:3px solid ${accentColor};">
    <tr>
      <td style="padding:14px 16px;">
        <p style="font-size:11px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:${accentColor}; margin:0 0 6px 0;">${label}</p>
        <p style="font-size:14px; line-height:1.65; color:#444444; margin:0;">${text.replace(/\n/g, '<br>')}</p>
      </td>
    </tr>
  </table>`;
}

function buildHtml(wordData, sections, isChengyu) {
  const pinyin  = convertPinyin(wordData.pinyin);
  const hanzi   = wordData.simplified;
  const def     = (wordData.definitions || '').split(' | ')[0];
  const wordUrl = `https://hanzidict.app/word/${encodeURIComponent(hanzi)}`;
  const accent  = '#1D9E75';

  const bannerLabel = isChengyu ? '成语 of the day' : 'Word of the day';
  const ctaLabel    = isChengyu ? 'See full entry →' : 'See full entry →';

  const sectionLabels = isChengyu
    ? [['EXAMPLE', 'Example'], ['STORY', 'Story'], ['TIP', 'Tip']]
    : [['EXAMPLE', 'Example'], ['USAGE', 'Usage'], ['TIP', 'Tip']];

  const contentBlocks = sectionLabels
    .map(([key, label]) => sections[key]
      ? contentBlock(label, sections[key], accent)
      : '')
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; background-color:#f4f3ef; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f3ef; padding:40px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:12px; overflow:hidden;">

          <!-- Wordmark -->
          <tr>
            <td style="padding:36px 40px 20px 40px; text-align:center;">
              <span style="font-size:20px; font-weight:700; color:#111111;">Hanzi<span style="color:${accent};">Dict</span></span>
            </td>
          </tr>

          <!-- Green banner -->
          <tr>
            <td style="background-color:${accent}; padding:24px 40px 28px 40px; text-align:center;">
              <p style="font-size:12px; font-weight:700; color:rgba(255,255,255,0.75); letter-spacing:0.1em; text-transform:uppercase; margin:0 0 12px 0;">${bannerLabel}</p>
              <p style="font-size:52px; font-weight:700; color:#ffffff; margin:0 0 8px 0; line-height:1;">${hanzi}</p>
              <p style="font-size:16px; color:rgba(255,255,255,0.85); margin:0 0 6px 0;">${pinyin}</p>
              <p style="font-size:14px; color:rgba(255,255,255,0.75); margin:0;">${def}</p>
            </td>
          </tr>

          <!-- AI-generated content blocks -->
          <tr>
            <td style="padding:28px 40px 8px 40px;">
              ${contentBlocks}
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:8px 40px 36px 40px; text-align:center;">
              <a href="${wordUrl}" style="display:inline-block; background-color:${accent}; color:#ffffff; text-decoration:none; font-size:15px; font-weight:600; padding:12px 28px; border-radius:8px;">${ctaLabel}</a>
            </td>
          </tr>

        </table>

        <!-- Footer -->
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="margin-top:20px;">
          <tr>
            <td style="text-align:center;">
              <p style="font-size:12px; color:#aaaaaa; margin:0;">HanziDict &middot; <a href="https://hanzidict.app" style="color:#aaaaaa; text-decoration:none;">hanzidict.app</a></p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ── Route handler ──────────────────────────────────────────────────────────

export async function GET(request) {
  // Verify cron secret to prevent unauthorized calls
  const auth = request.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const resendKey  = process.env.RESEND_API_KEY;
  const audienceId = process.env.RESEND_AUDIENCE_ID;
  if (!resendKey || !audienceId) {
    return Response.json({ error: 'Resend not configured' }, { status: 500 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: 'Anthropic API key not configured' }, { status: 500 });
  }

  // 1. Get today's word
  const wordData = await getWordOfDay();
  if (!wordData) {
    return Response.json({ error: 'No word of the day available' }, { status: 500 });
  }

  const isChengyu = !!wordData.isChengyu;

  // 2. Generate AI lesson
  let lessonText = '';
  try {
    lessonText = await generateLesson(wordData);
  } catch (err) {
    console.error('[send-daily] Claude error:', err);
    return Response.json({ error: 'Failed to generate lesson', detail: err?.message }, { status: 500 });
  }

  const sections = parseSections(lessonText, isChengyu);

  // 3. Build HTML
  const html = buildHtml(wordData, sections, isChengyu);

  const subjectWord = convertPinyin(wordData.pinyin);
  const subject = isChengyu
    ? `成语 of the day: ${wordData.simplified} (${subjectWord})`
    : `Word of the day: ${wordData.simplified} (${subjectWord})`;

  // 4. Create + send Resend broadcast
  try {
    const resend = new Resend(resendKey);

    const { data: broadcast, error: createErr } = await resend.broadcasts.create({
      audienceId,
      from: 'HanziDict <daily@hanzidict.app>',
      subject,
      html,
    });

    if (createErr) {
      console.error('[send-daily] Broadcast create error:', createErr);
      return Response.json({ error: 'Failed to create broadcast', detail: createErr }, { status: 500 });
    }

    const { error: sendErr } = await resend.broadcasts.send(broadcast.id);
    if (sendErr) {
      console.error('[send-daily] Broadcast send error:', sendErr);
      return Response.json({ error: 'Failed to send broadcast', detail: sendErr }, { status: 500 });
    }

    console.log(`[send-daily] Sent broadcast ${broadcast.id} for ${wordData.simplified}`);
    return Response.json({ ok: true, broadcastId: broadcast.id, word: wordData.simplified, isChengyu });
  } catch (err) {
    console.error('[send-daily] Resend error:', err);
    return Response.json({ error: 'Resend error', detail: err?.message }, { status: 500 });
  }
}
