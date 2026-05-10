import { NextResponse } from 'next/server';

function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const text = (searchParams.get('text') || '').trim();
  if (!text) return NextResponse.json({ error: 'Missing text' }, { status: 400 });

  const key = process.env.AZURE_TTS_KEY;
  console.log('[TTS] key present:', !!key, key ? `(starts: ${key.slice(0, 4)}...)` : '(missing)');
  if (!key) return NextResponse.json({ error: 'TTS not configured' }, { status: 503 });

  const ssml = `<speak version='1.0' xml:lang='zh-CN'><voice xml:lang='zh-CN' name='zh-CN-XiaoxiaoNeural'>${escapeXml(text)}</voice></speak>`;
  console.log('[TTS] requesting for text:', text);

  const response = await fetch(
    'https://eastus.tts.speech.microsoft.com/cognitiveservices/v1',
    {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': key,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3',
      },
      body: ssml,
    }
  );

  console.log('[TTS] Azure status:', response.status);
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    console.error('[TTS] Azure response body:', body);
    return NextResponse.json({ error: 'TTS request failed', status: response.status }, { status: 502 });
  }

  const audioBuffer = await response.arrayBuffer();
  return new Response(audioBuffer, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
