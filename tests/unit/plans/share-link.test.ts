import { describe, it, expect } from 'vitest';
import {
  detectShareUrl,
  pickPlanText,
  fetchShareConversation,
} from '../../../src/plans/share-link.js';

describe('plans/share-link', () => {
  it('detects ChatGPT, Gemini, Claude, and g.co share URLs', () => {
    expect(detectShareUrl('https://chatgpt.com/share/abc-123')?.service).toBe('chatgpt');
    expect(detectShareUrl('https://chat.openai.com/share/abc')?.service).toBe('chatgpt');
    expect(detectShareUrl('https://claude.ai/share/xyz')?.service).toBe('claude');
    expect(detectShareUrl('https://gemini.google.com/share/ggg')?.service).toBe('gemini');
    expect(detectShareUrl('https://g.co/gemini/share/ggg')?.url).toContain('g.co/gemini/share/ggg');
    expect(detectShareUrl('https://share.gemini.google/HjpFVh21AFUs')?.service).toBe('gemini');
    expect(detectShareUrl('https://share.gemini.google/HjpFVh21AFUs')?.shareId).toBe(
      'HjpFVh21AFUs',
    );
    expect(detectShareUrl('https://share.gemini.google/HjpFVh21AFUs')?.url).toBe(
      'https://share.gemini.google/HjpFVh21AFUs',
    );
    expect(detectShareUrl('https://example.com/nope')).toBeUndefined();
  });

  it('picks the assistant message that looks most like a plan', () => {
    const text = pickPlanText([
      { role: 'user', content: 'make a calculator' },
      { role: 'assistant', content: 'Sure, I can help.' },
      {
        role: 'assistant',
        content: '# Objective\nBuild it\n# Implementation Steps\n## Step 1: HTML\nDo it',
      },
    ]);
    expect(text).toContain('# Objective');
  });

  it('imports a Claude snapshot JSON', async () => {
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      expect(url).toContain('/api/chat_snapshots/snap-1');
      return new Response(
        JSON.stringify({
          snapshot_name: 'Calculator plan',
          chat_messages: [
            { sender: 'human', content: [{ type: 'text', text: 'plan a calculator' }] },
            {
              sender: 'assistant',
              content: [
                {
                  type: 'text',
                  text: '# Objective\nA calculator\n# Files To Create\n- index.html\n# Implementation Steps\n## Step 1: UI\nBuild it\n# Acceptance Criteria\n- works',
                },
              ],
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    };
    const conversation = await fetchShareConversation('https://claude.ai/share/snap-1', fetchImpl);
    expect(conversation.service).toBe('claude');
    expect(conversation.planText).toContain('index.html');
    expect(conversation.messages[0].role).toBe('user');
  });

  it('reads ChatGPT messages embedded in the share HTML', async () => {
    const payload = {
      message: {
        author: { role: 'assistant' },
        content: {
          content_type: 'text',
          parts: [
            '# Objective\nShip a calculator\n# Implementation Steps\n## Step 1: HTML\nWrite it',
          ],
        },
      },
    };
    const html = `<html><title>ChatGPT - Calc</title><script>${JSON.stringify(payload)}</script></html>`;
    const fetchImpl: typeof fetch = async () =>
      new Response(html, { status: 200, headers: { 'content-type': 'text/html' } });
    const conversation = await fetchShareConversation('https://chatgpt.com/share/abc', fetchImpl);
    expect(conversation.planText).toContain('calculator');
  });

  it('keeps the original Gemini short URL so redirects can be followed', async () => {
    const seen: string[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      seen.push(String(input));
      return new Response(
        `<html><title>Gemini</title><meta property="og:description" content="Created with Gemini"></html>`,
        { status: 200, headers: { 'content-type': 'text/html' } },
      );
    };
    await expect(
      fetchShareConversation('https://share.gemini.google/HjpFVh21AFUs', fetchImpl),
    ).rejects.toThrow(/JavaScript in the browser/);
    expect(seen).toEqual(['https://share.gemini.google/HjpFVh21AFUs']);
  });

  it('imports Gemini HTML that already contains a plan', async () => {
    const html = `<html><title>Gemini share</title><body># Objective\nBuild a calculator\n# Implementation Steps\n## Step 1: HTML\nWrite it</body></html>`;
    const fetchImpl: typeof fetch = async () =>
      new Response(html, { status: 200, headers: { 'content-type': 'text/html' } });
    const conversation = await fetchShareConversation(
      'https://gemini.google.com/share/abc123',
      fetchImpl,
    );
    expect(conversation.planText).toContain('# Objective');
  });

  it('explains HTTP status instead of a bare fetch failure', async () => {
    const fetchImpl: typeof fetch = async () => new Response('nope', { status: 404 });
    await expect(
      fetchShareConversation('https://claude.ai/share/missing', fetchImpl),
    ).rejects.toThrow(/HTTP 404/);
    await expect(
      fetchShareConversation('https://claude.ai/share/missing', fetchImpl),
    ).rejects.toThrow(/not found or the link expired/);
  });

  it('explains Node header-overflow fetch failures', async () => {
    const overflow = Object.assign(new Error('Headers Overflow Error'), {
      code: 'UND_ERR_HEADERS_OVERFLOW',
    });
    const failed = new TypeError('fetch failed', { cause: overflow });
    const fetchImpl: typeof fetch = async () => {
      throw failed;
    };
    await expect(
      fetchShareConversation('https://share.gemini.google/HjpFVh21AFUs', fetchImpl),
    ).rejects.toThrow(/headers larger than Node/);
    await expect(
      fetchShareConversation('https://share.gemini.google/HjpFVh21AFUs', fetchImpl),
    ).rejects.toThrow(/UND_ERR_HEADERS_OVERFLOW/);
    await expect(
      fetchShareConversation('https://share.gemini.google/HjpFVh21AFUs', fetchImpl),
    ).rejects.toThrow(/devorch plan --chat/);
  });
});
