let lastCheck: { ok: boolean; checkedAt: number } | null = null;
const CACHE_MS = 30_000; // re-check at most every 30s

export async function checkRagHealth(): Promise<boolean> {
  // return cached result if recent
  if (lastCheck && Date.now() - lastCheck.checkedAt < CACHE_MS) {
    return lastCheck.ok;
  }

  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_CHROMA_HEALTH_URL ?? "/api/rag/health"}`,
      { signal: AbortSignal.timeout(5000) } // 5s timeout
    );
    const ok = res.ok;
    lastCheck = { ok, checkedAt: Date.now() };
    return ok;
  } catch {
    lastCheck = { ok: false, checkedAt: Date.now() };
    return false;
  }
}