import { execa } from 'execa';

export type ShareService = 'chatgpt' | 'gemini' | 'claude';

export interface DetectedShare {
  service: ShareService;
  shareId: string;
  url: string;
}

export interface ShareMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ShareConversation {
  service: ShareService;
  title: string;
  sourceUrl: string;
  messages: ShareMessage[];
  planText: string;
}

const HEADERS = {
  'user-agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
  'accept-language': 'en-US,en;q=0.9',
};

const CURL_META = '__DEVORCH_HTTP__';
const IMPORT_HINT = 'Copy the assistant reply into a file, then import it with:\n  devorch plan --chat <chatgpt|gemini|claude> --from reply.md';

export function isChatShareUrl(value: string): boolean {
  return detectShareUrl(value) !== undefined;
}

export function detectShareUrl(value: string): DetectedShare | undefined {
  const raw = value.trim();
  let match = raw.match(/^https?:\/\/(?:www\.)?(?:chatgpt\.com|chat\.openai\.com)\/share\/([^/?#\s]+)/i);
  if (match) return { service: 'chatgpt', shareId: match[1], url: canonicalize(raw) };
  match = raw.match(/^https?:\/\/(?:www\.)?claude\.ai\/share\/([^/?#\s]+)/i);
  if (match) return { service: 'claude', shareId: match[1], url: canonicalize(raw) };
  match = raw.match(/^https?:\/\/(?:www\.)?gemini\.google\.com\/share\/([^/?#\s]+)/i);
  if (match) return { service: 'gemini', shareId: match[1], url: canonicalize(raw) };
  match = raw.match(/^https?:\/\/(?:www\.)?share\.gemini\.google(?:\.com)?\/([^/?#\s]+)/i);
  if (match) {
    return {
      service: 'gemini',
      shareId: match[1],
      url: canonicalize(raw),
    };
  }
  match = raw.match(/^https?:\/\/g\.co\/gemini\/share\/([^/?#\s]+)/i);
  if (match) {
    return {
      service: 'gemini',
      shareId: match[1],
      url: canonicalize(raw),
    };
  }
  return undefined;
}

function canonicalize(url: string): string {
  const parsed = new URL(url.trim());
  parsed.hash = '';
  return parsed.toString();
}

export async function fetchShareConversation(
  url: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ShareConversation> {
  const detected = detectShareUrl(url);
  if (!detected) {
    throw new Error(
      [
        'Not a supported public share link.',
        'Use chatgpt.com/share/…, claude.ai/share/…, gemini.google.com/share/…, share.gemini.google/…, or g.co/gemini/share/…',
      ].join('\n'),
    );
  }

  if (detected.service === 'claude') {
    return extractClaude(detected, fetchImpl);
  }
  if (detected.service === 'gemini') {
    return extractGemini(detected, fetchImpl);
  }
  return extractChatGPT(detected, fetchImpl);
}

export function pickPlanText(messages: ShareMessage[], title?: string): string {
  const assistants = messages.filter((message) => message.role === 'assistant' && message.content.trim());
  if (assistants.length === 0) {
    throw new Error(
      ['The shared chat has no assistant reply to import.', IMPORT_HINT].join('\n'),
    );
  }
  const scored = [...assistants].sort((a, b) => planScore(b.content) - planScore(a.content));
  const best = scored[0];
  if (planScore(best.content) >= 2) return best.content;
  return assistants[assistants.length - 1].content;
}

function planScore(text: string): number {
  const hay = text.toLowerCase();
  let score = 0;
  for (const token of [
    'objective',
    'implementation steps',
    'files to create',
    'files to modify',
    'acceptance criteria',
    'step 1',
  ]) {
    if (hay.includes(token)) score += 1;
  }
  return score;
}

async function extractClaude(
  detected: DetectedShare,
  fetchImpl: typeof fetch,
): Promise<ShareConversation> {
  const apiUrl = `https://claude.ai/api/chat_snapshots/${encodeURIComponent(detected.shareId)}?rendering_mode=messages`;
  const { text } = await requestShare(apiUrl, fetchImpl, detected.service, {
    headers: { accept: 'application/json', referer: detected.url },
  });
  const data = JSON.parse(text) as {
    snapshot_name?: string;
    chat_messages?: Array<{
      sender?: string;
      uuid?: string;
      content?: Array<{ type?: string; text?: string }>;
    }>;
  };
  const messages: ShareMessage[] = [];
  for (const raw of data.chat_messages ?? []) {
    const role = raw.sender === 'human' ? 'user' : raw.sender === 'assistant' ? 'assistant' : null;
    if (!role) continue;
    const partText = (raw.content ?? [])
      .filter((part) => part?.type === 'text' && part.text)
      .map((part) => String(part.text))
      .join('\n\n')
      .trim();
    if (partText) messages.push({ role, content: partText });
  }
  return toConversation(detected, data.snapshot_name || detected.shareId, messages);
}

async function extractChatGPT(
  detected: DetectedShare,
  fetchImpl: typeof fetch,
): Promise<ShareConversation> {
  const html = await fetchHtml(detected.url, fetchImpl, detected.service);
  const messages = chatGptMessagesFromHtml(html);
  if (messages.length === 0) {
    throw new Error(
      [
        'Could not read that ChatGPT share.',
        `URL: ${detected.url}`,
        'Make sure it is a public share link (Share → Copy link), not a private chat URL.',
        IMPORT_HINT,
      ].join('\n'),
    );
  }
  const title = titleFromHtml(html) || detected.shareId;
  return toConversation(detected, title.replace(/^ChatGPT - /, ''), messages);
}

async function extractGemini(
  detected: DetectedShare,
  fetchImpl: typeof fetch,
): Promise<ShareConversation> {
  const { html, finalUrl } = await fetchHtmlWithUrl(detected.url, fetchImpl, detected.service);
  const fromJson = walkGeminiTurns(html);
  if (fromJson.length > 0) {
    return toConversation(detected, titleFromHtml(html) || detected.shareId, fromJson);
  }
  const desc = metaDescription(html);
  if (desc && desc.length > 40 && planScore(desc) >= 1) {
    return toConversation(detected, titleFromHtml(html) || detected.shareId, [
      { role: 'assistant', content: desc },
    ]);
  }
  throw new Error(
    [
      'Opened the Gemini share page, but it has no conversation text to import.',
      `URL: ${finalUrl}`,
      'Gemini loads the chat with JavaScript in the browser. The downloaded HTML is only the app shell, not the replies.',
      'Copy Gemini’s reply into a file, then import it with:',
      '  devorch plan --chat gemini --from reply.md',
    ].join('\n'),
  );
}

async function fetchHtml(url: string, fetchImpl: typeof fetch, service: ShareService): Promise<string> {
  const { html } = await fetchHtmlWithUrl(url, fetchImpl, service);
  return html;
}

async function fetchHtmlWithUrl(
  url: string,
  fetchImpl: typeof fetch,
  service: ShareService,
): Promise<{ html: string; finalUrl: string }> {
  const result = await requestShare(url, fetchImpl, service);
  return { html: result.text, finalUrl: result.finalUrl };
}

async function requestShare(
  url: string,
  fetchImpl: typeof fetch,
  service: ShareService,
  init: RequestInit = {},
): Promise<{ text: string; finalUrl: string; status: number }> {
  try {
    const response = await fetchImpl(url, {
      ...init,
      headers: { ...HEADERS, ...(init.headers as Record<string, string> | undefined) },
      redirect: 'follow',
    });
    const finalUrl = response.url || url;
    if (!response.ok) throw shareHttpError(service, response.status, finalUrl);
    return { text: await response.text(), finalUrl, status: response.status };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Could not open the ')) {
      throw error;
    }
    if (fetchImpl === fetch) {
      const viaCurl = await tryCurlGet(url);
      if (viaCurl) {
        if (viaCurl.status >= 400) throw shareHttpError(service, viaCurl.status, viaCurl.finalUrl);
        return { text: viaCurl.body, finalUrl: viaCurl.finalUrl || url, status: viaCurl.status || 200 };
      }
    }
    throw shareNetworkError(error, url, service);
  }
}

async function tryCurlGet(url: string): Promise<{ body: string; status: number; finalUrl: string } | undefined> {
  try {
    const result = await execa(
      'curl',
      [
        '-sL',
        '--max-time',
        '30',
        '-A',
        HEADERS['user-agent'],
        '-H',
        `Accept: ${HEADERS.accept}`,
        '-H',
        `Accept-Language: ${HEADERS['accept-language']}`,
        '-w',
        `\n${CURL_META}\t%{http_code}\t%{url_effective}`,
        url,
      ],
      { timeout: 35_000, maxBuffer: 12 * 1024 * 1024, reject: false },
    );
    if (!result.stdout) return undefined;
    return parseCurlOutput(result.stdout, url);
  } catch {
    return undefined;
  }
}

function parseCurlOutput(stdout: string, fallbackUrl: string): { body: string; status: number; finalUrl: string } {
  const marker = `\n${CURL_META}\t`;
  const index = stdout.lastIndexOf(marker);
  if (index === -1) return { body: stdout, status: 200, finalUrl: fallbackUrl };
  const meta = stdout.slice(index + marker.length).trim();
  const [statusRaw, ...urlParts] = meta.split('\t');
  const status = Number(statusRaw);
  return {
    body: stdout.slice(0, index),
    status: Number.isFinite(status) ? status : 0,
    finalUrl: urlParts.join('\t') || fallbackUrl,
  };
}

function shareHttpError(service: string, status: number, url: string): Error {
  const why =
    status === 404
      ? 'The share was not found or the link expired.'
      : status === 401 || status === 403
        ? 'The chat is not publicly readable (login required).'
        : status === 429
          ? 'The host rate-limited this request. Try again in a moment.'
          : 'The host refused the request.';
  return new Error(
    [
      `Could not open the ${service} share link (HTTP ${status}).`,
      `URL: ${url}`,
      why,
      'The chat must be a public share URL, not a logged-in-only thread.',
      IMPORT_HINT,
    ].join('\n'),
  );
}

function shareNetworkError(error: unknown, url: string, service: string): Error {
  const code = findErrorCode(error);
  return new Error(
    [
      `Could not download the ${service} share link.`,
      `URL: ${url}`,
      networkReason(code, error),
      `Details: ${errorDetail(error)}`,
      IMPORT_HINT,
    ].join('\n'),
  );
}

export function errorDetail(error: unknown): string {
  const parts: string[] = [];
  let current: unknown = error;
  const seen = new Set<unknown>();
  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current);
    const code = codeOf(current);
    if (current instanceof Error) {
      const line = code && !current.message.includes(code) ? `${current.message} (${code})` : current.message;
      if (line && !parts.includes(line)) parts.push(line);
      current = current.cause;
      continue;
    }
    if (code) parts.push(code);
    break;
  }
  return parts.join(' — ') || String(error);
}

function findErrorCode(error: unknown): string | undefined {
  let current: unknown = error;
  const seen = new Set<unknown>();
  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current);
    const code = codeOf(current);
    if (code) return code;
    current = current instanceof Error ? current.cause : undefined;
  }
  return undefined;
}

function codeOf(value: object): string | undefined {
  if (!('code' in value)) return undefined;
  const code = (value as { code: unknown }).code;
  return typeof code === 'string' && code ? code : undefined;
}

function networkReason(code: string | undefined, error: unknown): string {
  if (code === 'UND_ERR_HEADERS_OVERFLOW') {
    return 'Gemini (and some other Google pages) send HTTP headers larger than Node.js allows, so fetch fails with "fetch failed".';
  }
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
    return 'DNS lookup failed. Check the URL and your internet connection.';
  }
  if (code === 'ECONNREFUSED') {
    return 'The connection was refused. Check the URL and your internet connection.';
  }
  if (code === 'ETIMEDOUT' || code === 'UND_ERR_CONNECT_TIMEOUT' || code === 'UND_ERR_HEADERS_TIMEOUT') {
    return 'The request timed out. Check your internet connection and try again.';
  }
  if (code === 'CERT_HAS_EXPIRED' || code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
    return 'TLS certificate verification failed.';
  }
  const message = error instanceof Error ? error.message : String(error);
  if (message.toLowerCase() === 'fetch failed') {
    return 'The HTTP request failed before a response was received.';
  }
  return 'The HTTP request failed before a usable response was received.';
}

function toConversation(
  detected: DetectedShare,
  title: string,
  messages: ShareMessage[],
): ShareConversation {
  if (messages.length === 0) {
    throw new Error(['The shared chat was empty.', IMPORT_HINT].join('\n'));
  }
  return {
    service: detected.service,
    title,
    sourceUrl: detected.url,
    messages,
    planText: pickPlanText(messages, title),
  };
}

function titleFromHtml(html: string): string | undefined {
  const match = html.match(/<title>([\s\S]*?)<\/title>/i);
  return match ? decodeEntities(match[1]).replace(/\s+/g, ' ').trim() : undefined;
}

function metaDescription(html: string): string | undefined {
  const match = html.match(
    /<meta[^>]+(?:name|property)=["'](?:og:description|description)["'][^>]+content=["']([^"']+)["']/i,
  );
  return match ? decodeEntities(match[1]) : undefined;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function chatGptMessagesFromHtml(html: string): ShareMessage[] {
  const messages: ShareMessage[] = [];
  const stream = extractStreamTables(html);
  for (const table of stream) {
    collectChatGptMessages(table, messages);
  }
  if (messages.length > 0) return messages;
  collectChatGptMessages(parseJsonBlobs(html), messages);
  return messages;
}

function extractStreamTables(html: string): unknown[] {
  const tables: unknown[] = [];
  const pattern = /streamController\.enqueue\(("(?:\\.|[^"\\])*")\)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    try {
      const chunk = JSON.parse(match[1]) as unknown;
      if (typeof chunk === 'string' && chunk.trim().startsWith('[')) {
        tables.push(JSON.parse(chunk));
      }
    } catch {
      // ignore
    }
  }
  return tables;
}

function parseJsonBlobs(html: string): unknown[] {
  const blobs: unknown[] = [];
  const pattern = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    const body = match[1].trim();
    if (!(body.startsWith('{') || body.startsWith('['))) continue;
    try {
      blobs.push(JSON.parse(body));
    } catch {
      // ignore
    }
  }
  return blobs;
}

function collectChatGptMessages(node: unknown, into: ShareMessage[], seen = new Set<unknown>()): void {
  if (!node || typeof node !== 'object' || seen.has(node)) return;
  seen.add(node);
  if (Array.isArray(node)) {
    for (const item of node) collectChatGptMessages(item, into, seen);
    return;
  }
  const record = node as Record<string, unknown>;
  const author = record.author as { role?: string } | undefined;
  const content = record.content as { content_type?: string; parts?: unknown[]; text?: string } | undefined;
  const role = author?.role;
  if ((role === 'user' || role === 'assistant') && content) {
    const text = chatGptPartsToText(content).trim();
    if (text) into.push({ role, content: text });
  }
  for (const value of Object.values(record)) collectChatGptMessages(value, into, seen);
}

function chatGptPartsToText(content: {
  content_type?: string;
  parts?: unknown[];
  text?: string;
}): string {
  if (typeof content.text === 'string' && content.text.trim()) return content.text;
  const parts = content.parts ?? [];
  return parts.filter((part): part is string => typeof part === 'string').join('\n');
}

function walkGeminiTurns(html: string): ShareMessage[] {
  const messages: ShareMessage[] = [];
  const blobs = [...extractStreamTables(html), ...parseJsonBlobs(html)];
  for (const blob of blobs) collectGeminiStrings(blob, messages);
  if (messages.length > 0) return messages;

  const objective = html.match(/# Objective[\s\S]{20,8000}/);
  if (objective) messages.push({ role: 'assistant', content: decodeEntities(objective[0]) });
  return messages;
}

function collectGeminiStrings(node: unknown, into: ShareMessage[], seen = new Set<unknown>()): void {
  if (!node || seen.has(node)) return;
  if (typeof node === 'string') {
    if (planScore(node) >= 2) into.push({ role: 'assistant', content: node });
    return;
  }
  if (typeof node !== 'object') return;
  seen.add(node);
  if (Array.isArray(node)) {
    for (const item of node) collectGeminiStrings(item, into, seen);
    return;
  }
  for (const value of Object.values(node as Record<string, unknown>)) {
    collectGeminiStrings(value, into, seen);
  }
}
