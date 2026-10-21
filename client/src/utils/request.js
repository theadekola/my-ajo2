// Bound the complete request, including response body and caller cancellation.
export async function fetchWithDeadline(url, options = {}, read = response => response.json(), milliseconds = 20000) {
  const controller = new AbortController();
  const abort = () => controller.abort(options.signal?.reason);
  if (options.signal?.aborted) abort();
  options.signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => controller.abort(), milliseconds);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return await read(response);
  } catch (error) {
    if (controller.signal.aborted && !options.signal?.aborted) throw new Error('The server did not respond within 20 seconds. Please retry.');
    throw error;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', abort);
  }
}
