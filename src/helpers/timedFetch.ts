export type TimedFetchResult = {
  ok: boolean;
  status: number;
  durationMs: number;
  url: string;
  json: unknown | null;
  text: string;
};

export async function timedFetch(url: string, init?: RequestInit): Promise<TimedFetchResult> {
  const started = Date.now();
  const res = await fetch(url, init);
  const durationMs = Date.now() - started;
  const text = await res.text();
  let json: unknown | null = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return {
    ok: res.ok,
    status: res.status,
    durationMs,
    url,
    json,
    text,
  };
}
