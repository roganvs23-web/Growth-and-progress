// App-wide state: the plan, daily logs, coach chat and check-ins, persisted
// to device storage, plus watch data refreshed from the health source.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState as RNAppState } from 'react-native';
import type { AppState, CheckIn, CoachMessage, DailyHealth, DayKey, DayLog, Plan, PlanChange } from './core/types';
import { toDayKey } from './core/dates';
import { emptyLog } from './core/progress';
import { applyPlanChange } from './core/checkin';
import { initialState, loadState, saveState } from './storage/store';
import { connectHealthSource, type HealthSource } from './health';
import { SampleHealthSource } from './health/HealthSource';

interface Ctx {
  ready: boolean;
  state: AppState;
  today: DayKey;
  health: Record<DayKey, DailyHealth>;
  healthSourceName: string;
  /** Ask for watch data access (shows the OS permission sheet the first time). */
  connectWatch(): Promise<void>;
  setPlan(p: Plan | null): void;
  updateLog(day: DayKey, f: (l: DayLog) => DayLog): void;
  applyChange(c: PlanChange): void;
  addChat(...m: CoachMessage[]): void;
  addCheckIn(c: CheckIn): void;
  reset(): void;
}

const MomentumCtx = createContext<Ctx | null>(null);

export function MomentumProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<AppState>(initialState);
  const [health, setHealth] = useState<Record<DayKey, DailyHealth>>({});
  const [today, setToday] = useState(toDayKey(new Date()));
  const loaded = useRef(false);
  const source = useRef<HealthSource>(new SampleHealthSource());
  const connected = useRef(false);
  const [sourceName, setSourceName] = useState(source.current.name);

  useEffect(() => {
    loadState().then((s) => {
      setState(s);
      loaded.current = true;
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (loaded.current) saveState(state);
  }, [state]);

  const refreshHealth = useCallback(async () => {
    setToday(toDayKey(new Date()));
    try {
      setHealth(await source.current.dailySummaries(28));
    } catch {
      // Keep the last data we had.
    }
  }, []);

  const connectWatch = useCallback(async () => {
    if (!connected.current) {
      connected.current = true;
      source.current = await connectHealthSource();
      setSourceName(source.current.name);
    }
    await refreshHealth();
  }, [refreshHealth]);

  // Returning users: reconnect on launch. New users connect when they start onboarding.
  useEffect(() => {
    if (ready && state.plan) connectWatch();
    else refreshHealth();
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const sub = RNAppState.addEventListener('change', (s) => s === 'active' && refreshHealth());
    return () => sub.remove();
  }, [refreshHealth]);

  const value = useMemo<Ctx>(
    () => ({
      ready,
      state,
      today,
      health,
      healthSourceName: sourceName,
      connectWatch,
      setPlan: (plan) => setState((s) => ({ ...s, plan })),
      updateLog: (day, f) => setState((s) => ({ ...s, logs: { ...s.logs, [day]: f(s.logs[day] ?? emptyLog()) } })),
      applyChange: (c) => setState((s) => (s.plan ? { ...s, plan: applyPlanChange(s.plan, c) } : s)),
      addChat: (...m) => setState((s) => ({ ...s, chat: [...s.chat, ...m].slice(-200) })),
      addCheckIn: (c) => setState((s) => ({ ...s, checkIns: [c, ...s.checkIns.filter((x) => x.weekOf !== c.weekOf)].slice(0, 52) })),
      reset: () => setState(initialState),
    }),
    [ready, state, today, health, sourceName, connectWatch],
  );

  return <MomentumCtx.Provider value={value}>{children}</MomentumCtx.Provider>;
}

export function useMomentum(): Ctx {
  const c = useContext(MomentumCtx);
  if (!c) throw new Error('useMomentum must be used inside MomentumProvider');
  return c;
}

/** Last n days of health data, oldest first, for sending to the coach. */
export function recentHealth(health: Record<DayKey, DailyHealth>, n = 7): DailyHealth[] {
  return Object.values(health).sort((a, b) => (a.day < b.day ? -1 : 1)).slice(-n);
}
