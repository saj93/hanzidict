function aborted(signal) {
  if (signal?.aborted) throw new DOMException('Search cancelled', 'AbortError');
}

function pause(ms, signal) {
  return new Promise((resolve, reject) => {
    aborted(signal);
    const done = () => { signal?.removeEventListener('abort', cancel); resolve(); };
    const timer = setTimeout(done, ms);
    function cancel() {
      clearTimeout(timer);
      signal?.removeEventListener('abort', cancel);
      reject(new DOMException('Search cancelled', 'AbortError'));
    }
    signal?.addEventListener('abort', cancel, { once: true });
  });
}

function remoteError(code) {
  const error = new Error(code === 'SEARCH_TIMEOUT'
    ? 'The search took too long to complete. Please try again.'
    : 'The search server is temporarily unavailable. Please try again.');
  error.retryable = true;
  return error;
}

async function readStream(response, onPreview, signal) {
  if (!response.body) throw new Error('The server returned an unexpected response. Refresh the page and try again.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '', completed;
  function frame(line) {
    aborted(signal);
    if (!line.trim()) return;
    const data = JSON.parse(line);
    if (data.type === 'error') throw remoteError(data.code);
    if (data.type === 'preview' && Array.isArray(data.results) && data.results.length) onPreview?.(data);
    if (data.type === 'complete') {
      if (!Array.isArray(data.results) || !Number.isFinite(data.total)) throw new Error('Invalid search response');
      completed = data;
    }
  }
  try {
    while (true) {
      aborted(signal);
      const { value, done } = await reader.read();
      if (done) { buffer += decoder.decode(); break; }
      buffer += decoder.decode(value, { stream: true });
      let end;
      while ((end = buffer.indexOf('\n')) !== -1) { frame(buffer.slice(0, end)); buffer = buffer.slice(end + 1); }
    }
    frame(buffer);
    if (!completed) throw new Error('The server returned an unexpected response. Refresh the page and try again.');
    return completed;
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

// Explicit searches retry once; autocomplete opts out to avoid extra requests.
/**
 * @param {string} url
 * @param {{ signal?: AbortSignal, onPreview?: (data: {results: Array<Record<string, unknown>>}) => void,
 *   retry?: boolean, fetcher?: typeof fetch, wait?: (ms: number, signal?: AbortSignal) => Promise<void> }} [options]
 * @returns {Promise<{results: Array<Record<string, unknown>>, total: number}>}
 */
export async function requestSearch(url, { signal, onPreview, retry = true, fetcher = fetch, wait = pause } = {}) {
  for (let attempt = 0; attempt < (retry ? 2 : 1); attempt++) {
    aborted(signal);
    let response;
    try {
      response = await fetcher(url, { signal });
    } catch (error) {
      if (signal?.aborted || error.name === 'AbortError') throw error;
      if (retry && attempt === 0) { await wait(1000, signal); continue; }
      throw new Error('Unable to reach search. Check your connection and try again.');
    }

    if (!response.ok) {
      if ([502, 503, 504].includes(response.status) && retry && attempt === 0) {
        await wait(1000, signal);
        continue;
      }
      if (response.status === 429) throw new Error('Too many searches. Please wait a moment and try again.');
      if ([401, 403].includes(response.status)) throw new Error('Search access was blocked. Refresh the page and try again.');
      let body;
      try { body = await response.json(); } catch { /* A gateway may return HTML. */ }
      if (body?.code === 'SEARCH_TIMEOUT') throw new Error('The search took too long to complete. Please try again.');
      throw new Error('The search server is temporarily unavailable. Please try again.');
    }

    if (response.headers.get('content-type')?.includes('application/x-ndjson')) {
      try { return await readStream(response, onPreview, signal); }
      catch (error) {
        aborted(signal);
        if (error.retryable && retry && attempt === 0) { await wait(1000, signal); continue; }
        throw error;
      }
    }

    let data;
    try { data = await response.json(); } catch {
      throw new Error('The server returned an unexpected response. Refresh the page and try again.');
    }
    if (!Array.isArray(data.results) || !Number.isFinite(data.total)) {
      throw new Error('The server returned an unexpected response. Refresh the page and try again.');
    }
    return data;
  }
}
