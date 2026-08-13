export interface Source {
  id: string;
  title: string;
  url?: string;
  type: "url" | "note" | "text";
  reliability: number;
  excerpt: string;
  fetched?: boolean;
  error?: string;
}

export interface Claim {
  id: string;
  text: string;
  supportedBy: string[];
  contradictedBy?: string[];
}

export interface Brief {
  id: string;
  createdAt: string;
  query: string;
  summary: string;
  claims: Claim[];
  sources: Source[];
  contradictions: { claimA: string; claimB: string; note: string }[];
  confidence: number;
  processingNotes: string[];
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 11);
}

function extractUrls(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;
  const matches = text.match(urlRegex) || [];
  return [...new Set(matches.map((u) => u.replace(/[.,;:!?)]+$/, "")))];
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function extractTitle(html: string, fallback: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (match && match[1]) return stripHtml(match[1]).slice(0, 120) || fallback;
  return fallback;
}

async function fetchUrlContent(url: string): Promise<{ title: string; text: string; ok: boolean; error?: string }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "LumenKnowledgeBot/1.0 (+https://lumen.app; research synthesizer)",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
    });
    clearTimeout(timeout);
    if (!res.ok) return { title: new URL(url).hostname, text: "", ok: false, error: `HTTP ${res.status}` };
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("text/plain") && !contentType.includes("application/xhtml")) {
      return { title: new URL(url).hostname, text: "", ok: false, error: "Unsupported content type" };
    }
    const html = await res.text();
    const title = extractTitle(html, new URL(url).hostname);
    let text = stripHtml(html);
    if (text.length > 4000) text = text.slice(0, 4000) + "…";
    return { title, text, ok: true };
  } catch (err: any) {
    const msg = err?.name === "AbortError" ? "Timeout" : (err?.message || "Fetch failed");
    try { return { title: new URL(url).hostname, text: "", ok: false, error: msg }; }
    catch { return { title: "unknown", text: "", ok: false, error: msg }; }
  }
}

function scoreReliability(source: { type: string; fetched?: boolean; error?: string; textLength: number }): number {
  let score = 50;
  if (source.type === "note") score = 72;
  if (source.type === "url") {
    if (source.fetched && !source.error) score = 68 + Math.min(20, Math.floor(source.textLength / 200));
    else score = 35;
  }
  return Math.max(20, Math.min(95, score));
}

function extractClaimsFromText(text: string, sourceId: string): Claim[] {
  const claims: Claim[] = [];
  if (!text || text.length < 40) return claims;
  const sentences = text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.length > 35 && s.length < 280);
  const assertive = sentences.filter((s) => {
    const lower = s.toLowerCase();
    return !lower.startsWith("http") && (lower.includes(" is ") || lower.includes(" are ") || lower.includes(" was ") || lower.includes(" were ") || lower.includes(" shows ") || lower.includes(" found ") || lower.includes(" indicates ") || lower.includes(" suggests ") || lower.includes(" according to ") || lower.includes(" research ") || lower.includes(" study ") || lower.includes(" data ") || lower.includes(" results "));
  });
  const seen = new Set<string>();
  for (const s of assertive.slice(0, 6)) {
    const key = s.slice(0, 60).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    claims.push({ id: generateId(), text: s.endsWith(".") || s.endsWith("!") || s.endsWith("?") ? s : s + ".", supportedBy: [sourceId] });
    if (claims.length >= 3) break;
  }
  return claims;
}

export async function synthesizeInput(rawInput: string): Promise<Brief> {
  const processingNotes: string[] = [];
  const urls = extractUrls(rawInput);
  const cleanText = rawInput.replace(/https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi, " ").replace(/\s+/g, " ").trim();
  const sources: Source[] = [];
  const allClaims: Claim[] = [];
  const urlsToFetch = urls.slice(0, 4);
  if (urls.length > 4) processingNotes.push(`Limited to first 4 of ${urls.length} URLs for speed.`);
  const fetchResults = await Promise.all(urlsToFetch.map(async (url, idx) => {
    const result = await fetchUrlContent(url);
    return { url, idx, ...result };
  }));
  for (const fr of fetchResults) {
    const id = `s${fr.idx + 1}`;
    const reliability = scoreReliability({ type: "url", fetched: fr.ok, error: fr.error, textLength: fr.text.length });
    sources.push({
      id, title: fr.title, url: fr.url, type: "url", reliability,
      excerpt: fr.ok ? fr.text.slice(0, 220) + (fr.text.length > 220 ? "…" : "") : `Could not retrieve content (${fr.error || "unknown error"}).`,
      fetched: fr.ok, error: fr.error,
    });
    if (fr.ok && fr.text) {
      allClaims.push(...extractClaimsFromText(fr.text, id));
      processingNotes.push(`Extracted content from ${fr.title}`);
    } else {
      processingNotes.push(`Failed to fetch ${fr.url}: ${fr.error}`);
    }
  }
  if (cleanText.length > 25) {
    const noteId = `s${sources.length + 1}`;
    sources.push({ id: noteId, title: "Your notes / thoughts", type: "note", reliability: 74, excerpt: cleanText.slice(0, 240) + (cleanText.length > 240 ? "…" : ""), fetched: true });
    allClaims.push(...extractClaimsFromText(cleanText, noteId));
  }
  if (sources.length === 0) {
    sources.push({ id: "s1", title: "Input fragment", type: "text", reliability: 40, excerpt: rawInput.slice(0, 160) || "Empty input" });
  }
  const uniqueClaims: Claim[] = [];
  const claimKeys = new Set<string>();
  for (const c of allClaims) {
    const key = c.text.slice(0, 50).toLowerCase();
    if (claimKeys.has(key)) continue;
    claimKeys.add(key);
    uniqueClaims.push(c);
  }
  if (uniqueClaims.length === 0) {
    uniqueClaims.push({ id: generateId(), text: "The supplied material was processed but yielded limited extractable assertions.", supportedBy: sources.map((s) => s.id) });
  }
  const contradictions: Brief["contradictions"] = [];
  if (uniqueClaims.length >= 2) {
    const positive = uniqueClaims.filter((c) => /increase|improve|higher|better|success|effective|strong|positive|support/i.test(c.text));
    const negative = uniqueClaims.filter((c) => /decrease|worse|lower|fail|ineffective|weak|negative|contradict|limited|concern/i.test(c.text));
    if (positive.length && negative.length) {
      contradictions.push({ claimA: positive[0].text, claimB: negative[0].text, note: "Potential tension detected between positively and negatively framed statements. Manual review recommended." });
      positive[0].contradictedBy = [negative[0].id];
      negative[0].contradictedBy = [positive[0].id];
    }
  }
  const avgRel = sources.reduce((a, s) => a + s.reliability, 0) / sources.length;
  const fetchedCount = sources.filter((s) => s.fetched).length;
  let summary = "";
  if (fetchedCount === 0 && sources.every((s) => s.type !== "note")) {
    summary = "No usable content could be retrieved from the provided links. Reliability is low. Consider checking the URLs or adding direct notes.";
  } else if (sources.length === 1) {
    summary = `Processed a single source. Average reliability ${Math.round(avgRel)}%. ${uniqueClaims.length} claim(s) extracted.`;
  } else {
    summary = `Synthesized ${sources.length} inputs (${fetchedCount} successfully retrieved). Average source reliability ${Math.round(avgRel)}%. ${uniqueClaims.length} claims identified${contradictions.length ? "; tension flags raised" : ""}.`;
  }
  const confidence = Math.min(92, Math.round(avgRel * 0.7 + fetchedCount * 6 + Math.min(uniqueClaims.length * 3, 15)));
  return {
    id: generateId(), createdAt: new Date().toISOString(),
    query: rawInput.slice(0, 140) + (rawInput.length > 140 ? "…" : ""),
    summary, claims: uniqueClaims.slice(0, 8), sources, contradictions, confidence, processingNotes,
  };
}
