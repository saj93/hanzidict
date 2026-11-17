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

// Retry a temporary failure once, only for an explicitly submitted search.
// Autocomplete intentionally does not use this to avoid multiplying requests.
export async function requestSearch(url, { signal, fetcher = fetch, wait = pause } = {}) {
  for (let attempt = 0; attempt < 2; attempt++) {
    aborted(signal);
    let response;
    try {
      response = await fetcher(url, { signal });
    } catch (error) {
      if (signal?.aborted || error.name === 'AbortError') throw error;
      if (attempt === 0) { await wait(1000, signal); continue; }
      throw new Error('Unable to reach search. Check your connection and try again.');
    }

    if (!response.ok) {
      if ([502, 503, 504].includes(response.status) && attempt === 0) {
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
