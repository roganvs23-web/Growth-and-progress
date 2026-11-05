// Minimal HTTP server for the Stride coach. Deploy anywhere that runs Node
// (Fly.io, Render, Railway, Cloud Run). Set ANTHROPIC_API_KEY in the host's
// secrets, then point the app at it with EXPO_PUBLIC_COACH_URL.
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { ChatReq, CheckInReq, CoachRefusal, OnboardReq, PlanReq, chat, checkIn, onboard, plan } from './coach';

const routes: Record<string, { schema: z.ZodType; run: (b: any) => Promise<unknown> }> = {
  '/v1/onboard': { schema: OnboardReq, run: onboard },
  '/v1/plan': { schema: PlanReq, run: plan },
  '/v1/chat': { schema: ChatReq, run: chat },
  '/v1/checkin': { schema: CheckInReq, run: checkIn },
};

const MAX_BODY = 200_000;

// Very small per-IP rate limit so one device cannot run up the bill.
// Replace with per-account limits once sign-in and subscriptions exist.
const hits = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 20;
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error('too large'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new Error('bad json'));
      }
    });
    req.on('error', reject);
  });
}

const server = createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') return send(res, 200, { ok: true });
  const route = req.method === 'POST' && req.url ? routes[req.url] : undefined;
  if (!route) return send(res, 404, { error: 'not_found' });

  const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
  if (limited(ip)) return send(res, 429, { error: 'rate_limited' });

  let body: unknown;
  try {
    body = await readBody(req);
  } catch {
    return send(res, 400, { error: 'bad_request' });
  }
  const parsed = route.schema.safeParse(body);
  if (!parsed.success) return send(res, 400, { error: 'invalid_body' });

  try {
    send(res, 200, await route.run(parsed.data));
  } catch (e) {
    if (e instanceof CoachRefusal) return send(res, 422, { error: 'refused' });
    if (e instanceof Anthropic.RateLimitError) return send(res, 429, { error: 'rate_limited' });
    if (e instanceof Anthropic.APIError) {
      console.error('Claude API error', e.status, e.message);
      return send(res, 502, { error: 'upstream' });
    }
    console.error(e);
    send(res, 500, { error: 'internal' });
  }
});

const port = Number(process.env.PORT ?? 8787);
server.listen(port, () => console.log(`Stride coach listening on :${port}`));
