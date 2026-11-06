// Buddy mode: two friends see each other's streak and can send a cheer.
// Deliberately tiny: no accounts, no search, no free-text messages.
// What is shared: a nickname, the current streak, whether today is a good
// day yet, and cheers. Never health data, habit names or goals.
//
// Storage: in memory, saved to a JSON file when BUDDY_DATA_FILE is set (use a
// mounted volume on Fly.io or Render). Fine for one server instance; move to
// a database (Postgres, Redis) before running more than one.
import { randomBytes, randomInt } from 'node:crypto';
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { z } from 'zod';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I
const INVITE_TTL_MS = 48 * 3600_000;

export interface Member {
  token: string;
  name: string;
  streak: number;
  todayDone: boolean;
  day?: string;
  updatedAt: number;
  cheersReceived: number;
}
interface Pair {
  code: string;
  createdAt: number;
  members: Member[];
}

// Nicknames are the only text one person shows another, so keep them clean
// (App Store guideline 1.2). Letters, numbers, spaces and a little punctuation only.
const BLOCKED = /(fuck|shit|cunt|bitch|whore|slut|nigg|fag|retard|\brape|nazi|penis|vagina|pussy|porn)/i;
export const nicknameOk = (s: string) => /^[\p{L}\p{N} ._'-]{1,20}$/u.test(s) && !BLOCKED.test(s.replace(/[\s._'-]/g, '').replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e').replace(/4/g, 'a').replace(/5/g, 's'));
const Name = z.string().trim().min(1).max(20).refine(nicknameOk, 'nickname_not_allowed');
const Token = z.string().length(48);
export const BuddyCreateReq = z.object({ name: Name });
export const BuddyJoinReq = z.object({ code: z.string().trim().toUpperCase().length(6), name: Name });
export const BuddySyncReq = z.object({
  token: Token,
  streak: z.number().int().min(0).max(100_000),
  todayDone: z.boolean(),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export const BuddyTokenReq = z.object({ token: Token });

export class BuddyError extends Error {
  constructor(public status: number, public code: string) {
    super(code);
  }
}

export class BuddyStore {
  private pairs = new Map<string, Pair>();
  private byToken = new Map<string, Pair>();

  constructor(private file?: string, private now = () => Date.now()) {
    if (file && existsSync(file)) {
      for (const p of JSON.parse(readFileSync(file, 'utf8')) as Pair[]) this.index(p);
    }
  }

  private index(p: Pair) {
    this.pairs.set(p.code, p);
    for (const m of p.members) this.byToken.set(m.token, p);
  }

  private save() {
    if (!this.file) return;
    const tmp = `${this.file}.tmp`;
    writeFileSync(tmp, JSON.stringify([...this.pairs.values()]));
    renameSync(tmp, this.file);
  }

  private newCode() {
    for (;;) {
      const c = Array.from({ length: 6 }, () => CODE_CHARS[randomInt(CODE_CHARS.length)]).join('');
      if (!this.pairs.has(c)) return c;
    }
  }

  private member(name: string): Member {
    return { token: randomBytes(24).toString('hex'), name, streak: 0, todayDone: false, updatedAt: this.now(), cheersReceived: 0 };
  }

  private find(token: string) {
    const p = this.byToken.get(token);
    if (!p) throw new BuddyError(404, 'not_found');
    const me = p.members.find((m) => m.token === token)!;
    return { p, me, buddy: p.members.find((m) => m.token !== token) };
  }

  /** Removes invites nobody joined within 48 hours. */
  sweep() {
    const cutoff = this.now() - INVITE_TTL_MS;
    let changed = false;
    for (const p of this.pairs.values()) {
      if (p.members.length < 2 && p.createdAt < cutoff) {
        this.pairs.delete(p.code);
        for (const m of p.members) this.byToken.delete(m.token);
        changed = true;
      }
    }
    if (changed) this.save();
  }

  create({ name }: z.infer<typeof BuddyCreateReq>) {
    this.sweep();
    const p: Pair = { code: this.newCode(), createdAt: this.now(), members: [this.member(name)] };
    this.index(p);
    this.save();
    return { code: p.code, token: p.members[0].token };
  }

  join({ code, name }: z.infer<typeof BuddyJoinReq>) {
    this.sweep();
    const p = this.pairs.get(code);
    if (!p) throw new BuddyError(404, 'not_found');
    if (p.members.length >= 2) throw new BuddyError(409, 'full');
    const m = this.member(name);
    p.members.push(m);
    this.byToken.set(m.token, p);
    this.save();
    return { token: m.token, buddyName: p.members[0].name };
  }

  /** Posts my status and returns my buddy's (or null while the invite is open). */
  sync({ token, streak, todayDone, day }: z.infer<typeof BuddySyncReq>) {
    const { p, me, buddy } = this.find(token);
    Object.assign(me, { streak, todayDone, day, updatedAt: this.now() });
    const cheers = me.cheersReceived;
    me.cheersReceived = 0;
    this.save();
    return {
      code: p.members.length < 2 ? p.code : undefined,
      cheers,
      buddy: buddy ? { name: buddy.name, streak: buddy.streak, todayDone: buddy.todayDone, day: buddy.day, updatedAt: buddy.updatedAt } : null,
    };
  }

  cheer({ token }: z.infer<typeof BuddyTokenReq>) {
    const { buddy } = this.find(token);
    if (!buddy) throw new BuddyError(409, 'no_buddy');
    buddy.cheersReceived = Math.min(buddy.cheersReceived + 1, 99);
    this.save();
    return { ok: true };
  }

  /** Either side leaving deletes the pair and both statuses for good. */
  leave({ token }: z.infer<typeof BuddyTokenReq>) {
    const p = this.byToken.get(token);
    if (p) {
      this.pairs.delete(p.code);
      for (const m of p.members) this.byToken.delete(m.token);
      this.save();
    }
    return { ok: true };
  }
}
