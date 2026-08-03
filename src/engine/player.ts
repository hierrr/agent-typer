/**
 * 응답 플레이어 — ResponseEvent[]를 타이머 기반으로 순차 재생한다.
 * text는 cps 스트리밍, thinking/tool은 durationMs 유지 후 확정, diff/status는
 * durationMs가 있으면 그만큼, 없으면 플레이어 기본 홀드만큼 표시 유지한다.
 * showIf 필터링과 플레이스홀더 치환을 여기서 수행한다.
 * 재생된 로그는 누적되어 세션 전체의 스크롤백을 구성한다(스텝이 끝나도 유지 --
 * 워크플로우 하나가 끝나 새 워크플로우를 시작할 때 resetLog로 비운다).
 */

import { useCallback, useRef, useState } from 'react';
import type { DiffLine, ResponseEvent } from './types';
import type { EchoMark } from './judge';

export interface PlaceholderContext {
  wpm: number;
  cpm: number;
  spm: number;
  accuracy: number;
  errors: number;
  loc: number;
  files: number;
  commits: number;
}

export type LogEntry =
  /**
   * 스텝이 제출된 프롬프트 에코. v0.1.12 §1부터 완전 일치가 아니라 "입력 길이 도달"이 제출
   * 조건이라 step.prompt(목표)가 아니라 그 시점의 실제 입력값(끝 스페이스만 트림)이 온다 --
   * 오타·overflow가 있었다면 이 텍스트에 그대로 남는다(디에게시스 규칙상 응답이 그걸
   * 언급하진 않지만, 로그에는 보인다).
   * marks: text와 같은 길이의 위치별 판정 마크(스펙 v0.1.14 §1) -- null이면 정답(마크 없음).
   * 제출 시점에 typing.ts가 judge.markEchoAgainstTarget()으로 계산해 넣는다. 로그 엔트리에
   * 저장되므로 다음 스텝으로 넘어가 스크롤백에 남아 있는 동안은 계속 같은 마크가 보인다.
   */
  | { id: number; type: 'prompt'; text: string; marks: (EchoMark | null)[] }
  | { id: number; type: 'thinking'; text: string; done: boolean }
  | { id: number; type: 'text'; full: string; visible: string; done: boolean }
  | { id: number; type: 'tool'; name: string; input: string; output: string; phase: 'running' | 'done' }
  | { id: number; type: 'diff'; file: string; lines: DiffLine[]; done: boolean }
  | { id: number; type: 'status'; kind: 'success' | 'warn' | 'error'; text: string; done: boolean };

const PLACEHOLDER_RE = /\{(wpm|cpm|spm|accuracy|errors|loc|files|commits)\}/g;

export function formatPlaceholders(text: string, ctx: PlaceholderContext): string {
  return text.replace(PLACEHOLDER_RE, (_match, rawKey: string) => {
    const key = rawKey as keyof PlaceholderContext;
    const v = ctx[key];
    if (key === 'accuracy') return v.toFixed(1);
    return Math.round(v).toLocaleString('en-US');
  });
}

/** diff/status 이벤트에 durationMs가 없을 때 쓰는 재생 페이싱 기본값(디자인 선택). */
const DIFF_HOLD_MS = 450;
const STATUS_HOLD_MS = 380;
const DEFAULT_CPS = 40;

export interface UseResponsePlayerOptions {
  /** 스크립트 전체(마지막 이벤트까지) 재생이 끝났을 때 호출 */
  onDone?: () => void;
}

export interface ResponsePlayer {
  log: LogEntry[];
  isPlaying: boolean;
  play(
    events: ResponseEvent[],
    ctx: PlaceholderContext,
    filter: 'clean' | 'sloppy',
    promptText: string,
    promptMarks: (EchoMark | null)[],
  ): void;
  /** 남은 스크립트를 즉시 전부 확정 상태로 완료(Enter 빨리감기) */
  fastForward(): void;
  /** 재생 중이면 즉시 멈춘다. 로그 내용은 그대로 둔다(새 스텝 시작 시 잔여 타이머 정리용). */
  stop(): void;
  /** 로그 전체를 비운다 (새 워크플로우 시작 시) */
  resetLog(): void;
}

export function useResponsePlayer(options: UseResponsePlayerOptions = {}): ResponsePlayer {
  const [log, setLog] = useState<LogEntry[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);

  const idCounterRef = useRef(0);
  const queueRef = useRef<ResponseEvent[]>([]);
  const idxRef = useRef(0);
  const ctxRef = useRef<PlaceholderContext | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onDoneRef = useRef(options.onDone);
  onDoneRef.current = options.onDone;

  const clearTimer = () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const append = useCallback((entry: LogEntry) => {
    setLog((prev) => [...prev, entry]);
  }, []);

  const patch = useCallback((id: number, changes: Partial<LogEntry>) => {
    setLog((prev) => prev.map((e) => (e.id === id ? ({ ...e, ...changes } as LogEntry) : e)));
  }, []);

  /** 이벤트를 애니메이션 없이 최종 상태로 완전히 해석한다(빨리감기용). pause는 로그에 남지 않는다. */
  const resolveFull = useCallback((ev: ResponseEvent, ctx: PlaceholderContext): LogEntry | null => {
    const id = ++idCounterRef.current;
    switch (ev.type) {
      case 'pause':
        return null;
      case 'thinking':
        return { id, type: 'thinking', text: formatPlaceholders(ev.text, ctx), done: true };
      case 'text': {
        const full = formatPlaceholders(ev.text, ctx);
        return { id, type: 'text', full, visible: full, done: true };
      }
      case 'tool':
        return {
          id,
          type: 'tool',
          name: formatPlaceholders(ev.name, ctx),
          input: formatPlaceholders(ev.input, ctx),
          output: formatPlaceholders(ev.output, ctx),
          phase: 'done',
        };
      case 'diff':
        return {
          id,
          type: 'diff',
          file: formatPlaceholders(ev.file, ctx),
          lines: ev.lines.map((l) => ({ op: l.op, text: formatPlaceholders(l.text, ctx) })),
          done: true,
        };
      case 'status':
        return { id, type: 'status', kind: ev.kind, text: formatPlaceholders(ev.text, ctx), done: true };
      default:
        return null;
    }
  }, []);

  const step = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    if (idxRef.current >= queueRef.current.length) {
      setIsPlaying(false);
      onDoneRef.current?.();
      return;
    }
    const ev = queueRef.current[idxRef.current];
    idxRef.current += 1;

    switch (ev.type) {
      case 'pause': {
        timerRef.current = setTimeout(step, ev.durationMs);
        return;
      }
      case 'thinking': {
        const id = ++idCounterRef.current;
        append({ id, type: 'thinking', text: formatPlaceholders(ev.text, ctx), done: false });
        timerRef.current = setTimeout(() => {
          patch(id, { done: true });
          step();
        }, ev.durationMs);
        return;
      }
      case 'text': {
        const full = formatPlaceholders(ev.text, ctx);
        const id = ++idCounterRef.current;
        append({ id, type: 'text', full, visible: '', done: full.length === 0 });
        if (full.length === 0) {
          step();
          return;
        }
        const cps = ev.cps ?? DEFAULT_CPS;
        const msPerChar = Math.max(1000 / Math.max(cps, 1), 4);
        let i = 0;
        const tick = () => {
          i += 1;
          const done = i >= full.length;
          patch(id, { visible: full.slice(0, i), done });
          if (done) {
            step();
          } else {
            timerRef.current = setTimeout(tick, msPerChar);
          }
        };
        timerRef.current = setTimeout(tick, msPerChar);
        return;
      }
      case 'tool': {
        const id = ++idCounterRef.current;
        append({
          id,
          type: 'tool',
          name: formatPlaceholders(ev.name, ctx),
          input: formatPlaceholders(ev.input, ctx),
          output: formatPlaceholders(ev.output, ctx),
          phase: 'running',
        });
        timerRef.current = setTimeout(() => {
          patch(id, { phase: 'done' });
          step();
        }, ev.durationMs);
        return;
      }
      case 'diff': {
        const id = ++idCounterRef.current;
        append({
          id,
          type: 'diff',
          file: formatPlaceholders(ev.file, ctx),
          lines: ev.lines.map((l) => ({ op: l.op, text: formatPlaceholders(l.text, ctx) })),
          done: true,
        });
        timerRef.current = setTimeout(step, ev.durationMs ?? DIFF_HOLD_MS);
        return;
      }
      case 'status': {
        const id = ++idCounterRef.current;
        append({ id, type: 'status', kind: ev.kind, text: formatPlaceholders(ev.text, ctx), done: true });
        timerRef.current = setTimeout(step, ev.durationMs ?? STATUS_HOLD_MS);
        return;
      }
      default:
        step();
    }
  }, [append, patch]);

  const play = useCallback(
    (
      events: ResponseEvent[],
      ctx: PlaceholderContext,
      filter: 'clean' | 'sloppy',
      promptText: string,
      promptMarks: (EchoMark | null)[],
    ) => {
      clearTimer();
      const filtered = events.filter((e) => !e.showIf || e.showIf === 'always' || e.showIf === filter);
      queueRef.current = filtered;
      idxRef.current = 0;
      ctxRef.current = ctx;
      append({ id: ++idCounterRef.current, type: 'prompt', text: promptText, marks: promptMarks });
      setIsPlaying(true);
      step();
    },
    [append, step],
  );

  const fastForward = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx || !isPlaying) return;
    clearTimer();
    setLog((prev) => {
      const finished = prev.map((e) => finalizeEntry(e));
      const rest: LogEntry[] = [];
      while (idxRef.current < queueRef.current.length) {
        const ev = queueRef.current[idxRef.current];
        idxRef.current += 1;
        const resolved = resolveFull(ev, ctx);
        if (resolved) rest.push(resolved);
      }
      return [...finished, ...rest];
    });
    setIsPlaying(false);
    onDoneRef.current?.();
  }, [isPlaying, resolveFull]);

  /** 진행 중이던 재생을 로그는 건드리지 않고 즉시 중단한다(스크롤백에 계속 끼어드는 걸 막는다). */
  const stop = useCallback(() => {
    clearTimer();
    idxRef.current = 0;
    queueRef.current = [];
    ctxRef.current = null;
    setIsPlaying(false);
  }, []);

  const resetLog = useCallback(() => {
    stop();
    setLog([]);
  }, [stop]);

  return { log, isPlaying, play, fastForward, stop, resetLog };
}

function finalizeEntry(e: LogEntry): LogEntry {
  switch (e.type) {
    case 'text':
      return e.done ? e : { ...e, visible: e.full, done: true };
    case 'thinking':
      return e.done ? e : { ...e, done: true };
    case 'tool':
      return e.phase === 'done' ? e : { ...e, phase: 'done' };
    default:
      return e;
  }
}
