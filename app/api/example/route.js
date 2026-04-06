const examples = {
  '学习': { zh: '我每天学习中文。', pinyin: 'Wǒ měitiān xuéxí Zhōngwén.', en: 'I study Chinese every day.' },
};

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const word = searchParams.get('word')?.trim();
  if (!word) return Response.json({ error: 'missing word' }, { status: 400 });

  const result = examples[word];
  if (!result) return Response.json({ error: 'no example' }, { status: 404 });

  return Response.json(result);
}
