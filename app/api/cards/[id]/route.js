import { NextResponse } from 'next/server';
import { existsSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { getUserFromToken, isAdmin } from '@/lib/db';
import { firstDef } from '@/lib/utils';
import { convertPinyin } from '@/lib/pinyin';

async function fetchEntryById(id) {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .eq('id', id)
    .single();
  if (error || !data) return null;
  return data;
}

async function launchBrowser() {
  const { chromium } = await import('playwright-core');

  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const { default: sparticuz } = await import('@sparticuz/chromium-min');
    const binUrl =
      process.env.SPARTICUZ_CHROMIUM_URL ||
      `https://github.com/Sparticuz/chromium/releases/download/v149.0.0/chromium-v149.0.0-pack.tar`;
    return chromium.launch({
      args: [...sparticuz.args, '--disable-web-security'],
      executablePath: await sparticuz.executablePath(binUrl),
      headless: true,
    });
  }

  // Local: try system Brave/Chrome/Chromium
  const candidates = [
    process.env.CHROMIUM_PATH,
    '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/brave-browser',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
  ].filter(Boolean);

  const executablePath = candidates.find(p => existsSync(p));
  if (!executablePath) {
    throw new Error(
      'No browser found. Install Brave/Chrome or set CHROMIUM_PATH in .env.local'
    );
  }

  return chromium.launch({ executablePath, headless: true });
}

// ─── HTML templates ──────────────────────────────────────────────────────────

const FONTS = `
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&family=DM+Sans:ital,wght@0,400;0,600;0,700;1,400&display=swap" rel="stylesheet">
`;

const BASE_CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 1080px; height: 1080px; overflow: hidden;
    background: #161512;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    position: relative;
    font-family: 'DM Sans', system-ui, sans-serif;
  }
  .glow-bl {
    position: absolute; bottom: 0; left: 0;
    width: 640px; height: 640px;
    background: radial-gradient(circle at bottom left, rgba(29,158,117,0.20) 0%, transparent 68%);
    pointer-events: none;
  }
  .glow-tr {
    position: absolute; top: 0; right: 0;
    width: 500px; height: 500px;
    background: radial-gradient(circle at top right, rgba(29,158,117,0.10) 0%, transparent 68%);
    pointer-events: none;
  }
  .footer {
    position: absolute; bottom: 52px; left: 64px; right: 64px;
    display: flex; align-items: center; justify-content: space-between;
    z-index: 1;
  }
  .wordmark {
    font-size: 30px; font-weight: 700; color: #F1EFE8;
    font-family: 'DM Sans', system-ui, sans-serif;
    letter-spacing: -0.02em;
  }
  .wordmark .accent { color: #1D9E75; }
  .url { font-size: 26px; color: #5a5955; font-family: 'DM Sans', system-ui, sans-serif; }
`;

const FOOTER_HTML = `
  <div class="footer">
    <div class="wordmark"><span class="accent">汉</span>HanziDict</div>
    <div class="url">hanzidict.app</div>
  </div>
`;

function wordCardHtml(entry) {
  const hanzi = entry.simplified;
  const pinyin = convertPinyin(entry.pinyin || '');
  const def = firstDef(entry.definitions) || '';
  const hsk = entry.hsk_level
    ? `HSK ${entry.hsk_level >= 7 ? '7–9' : entry.hsk_level}`
    : null;

  return `<!DOCTYPE html><html><head><meta charset="utf-8">${FONTS}<style>
${BASE_CSS}
.content {
  position: relative; z-index: 1;
  display: flex; flex-direction: column; align-items: center;
  width: 880px;
}
.hanzi {
  font-size: 220px; font-weight: 700; color: #F1EFE8; line-height: 1;
  font-family: 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  margin-bottom: 28px;
}
.pinyin {
  font-size: 52px; font-weight: 700; color: #1D9E75;
  font-family: 'DM Sans', system-ui, sans-serif;
  margin-bottom: 52px;
}
.divider {
  width: 560px; height: 1px;
  background: rgba(241,239,232,0.14);
  margin-bottom: 44px;
}
.definition {
  font-size: 36px; color: #b9b7ae; text-align: center;
  max-width: 820px; line-height: 1.45;
  font-family: 'DM Sans', system-ui, sans-serif;
  margin-bottom: 36px;
}
.hsk-badge {
  border: 1.5px solid #1D9E75;
  border-radius: 50px;
  padding: 8px 28px;
  font-size: 24px; font-weight: 600; color: #1D9E75;
  font-family: 'DM Sans', system-ui, sans-serif;
}
</style></head><body>
  <div class="glow-bl"></div>
  <div class="glow-tr"></div>
  <div class="content">
    <div class="hanzi">${hanzi}</div>
    <div class="pinyin">${pinyin}</div>
    <div class="divider"></div>
    <div class="definition">${def}</div>
    ${hsk ? `<div class="hsk-badge">${hsk}</div>` : ''}
  </div>
  ${FOOTER_HTML}
</body></html>`;
}

function chengyuCardHtml(entry) {
  const hanzi = entry.simplified;
  const pinyin = convertPinyin(entry.pinyin || '');
  const mainMeaning = firstDef(entry.definitions) || '';

  // Second non-empty segment as usage note (excludes CL: and Taiwan pr.)
  const segments = (entry.definitions || '').split(' | ').filter(Boolean);
  const usageNote =
    segments
      .slice(1)
      .find(d => d.trim() && !d.startsWith('CL:') && !/^Taiwan pr\./i.test(d))
      ?.trim() || '';

  return `<!DOCTYPE html><html><head><meta charset="utf-8">${FONTS}<style>
${BASE_CSS}
.label {
  position: absolute; top: 62px; left: 0; right: 0;
  text-align: center;
  font-size: 26px; font-weight: 600; color: #1D9E75;
  letter-spacing: 0.14em; text-transform: uppercase;
  font-family: 'DM Sans', system-ui, sans-serif;
  z-index: 1;
}
.content {
  position: relative; z-index: 1;
  display: flex; flex-direction: column; align-items: center;
  width: 880px;
}
.hanzi {
  font-size: 168px; font-weight: 700; color: #F1EFE8; line-height: 1;
  letter-spacing: 6px;
  font-family: 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  margin-bottom: 24px;
}
.pinyin {
  font-size: 44px; font-weight: 700; color: #1D9E75;
  font-family: 'DM Sans', system-ui, sans-serif;
  margin-bottom: 48px;
}
.divider {
  width: 560px; height: 1px;
  background: rgba(241,239,232,0.14);
  margin-bottom: 40px;
}
.meaning {
  font-size: 38px; font-weight: 700; color: #F1EFE8; text-align: center;
  max-width: 820px; line-height: 1.4;
  font-family: 'DM Sans', system-ui, sans-serif;
  margin-bottom: 20px;
}
.usage {
  font-size: 28px; color: #8a8880; text-align: center;
  max-width: 820px; line-height: 1.5;
  font-style: italic;
  font-family: 'DM Sans', system-ui, sans-serif;
}
</style></head><body>
  <div class="glow-bl"></div>
  <div class="glow-tr"></div>
  <div class="label">成语 · CHENGYU</div>
  <div class="content">
    <div class="hanzi">${hanzi}</div>
    <div class="pinyin">${pinyin}</div>
    <div class="divider"></div>
    <div class="meaning">${mainMeaning}</div>
    ${usageNote ? `<div class="usage">${usageNote}</div>` : ''}
  </div>
  ${FOOTER_HTML}
</body></html>`;
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(request, { params }) {
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return new Response('Unauthorized', { status: 401 });

  const user = await getUserFromToken(token);
  if (!user) return new Response('Unauthorized', { status: 401 });

  const admin = await isAdmin(user.id);
  if (!admin) return new Response('Forbidden', { status: 403 });

  const { id } = await params;
  const entry = await fetchEntryById(id);
  if (!entry) return new Response('Not found', { status: 404 });

  const html = entry.is_chengyu ? chengyuCardHtml(entry) : wordCardHtml(entry);
  const filename = `${entry.simplified}-card.png`;

  let browser;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1080, height: 1080 });
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    // Brief pause so fonts have time to render before screenshotting
    await page.waitForTimeout(800);

    const buffer = await page.screenshot({ type: 'png' });

    return new Response(buffer, {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('[/api/cards] screenshot error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    if (browser) await browser.close();
  }
}
