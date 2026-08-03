/**
 * "가짜 상태 지표" v0.1.1/v0.1.2 — 실제 CLI 리듬을 흉내낸다(스펙 §4, §2).
 * 핵심 규칙: 타이핑 키 입력으로는 절대 움직이지 않는다. 이 훅은 liveStats(타이핑 실측치)를
 * 전혀 보지 않고, 오직 재생 로그(log)의 누적 분량만 본다 -- 사용자가 타이핑하는 동안은
 * log가 바뀌지 않으니 자연히 정지해 있고, 응답이 재생되는 동안에만 log가 자라면서
 * 지표도 함께 움직인다.
 *   - tokens: 재생 중(assistant 쪽 로그 분량)에만 스트리밍 비례 + 약간의 지터로 증가.
 *   - context%: 로그 전체(사용자+assistant) 누적 분량에 따라 완만히 증가.
 *   - tok/s: 재생 중에만 산출(직전 렌더 대비 증가분 ÷ 경과 시간), 그 외엔 마지막 값 또는 "--".
 * 새 워크플로우 시작 시 App.tsx가 log를 비우므로(resetSession) 이 지표들도 자연히 리셋된다.
 *
 * v0.1.2 §2: 워크플로우 진행도(완료 스텝/총 스텝)는 "n/n" 분수로 절대 노출하지 않는다 --
 * deriveUsage()가 이를 사용량 한도 문법(막대+퍼센트+고정된 리셋 시각)으로 위장한다.
 * resets 시각은 고정된 임의 값이며 현재 시각과 무관하다(스펙 v0.1.2c).
 */

import { useRef } from 'react';
import type { LogEntry, Phase } from '../theme-api';

export interface FakeMetrics {
  tokensLabel: string;
  contextPct: number;
  /** null이면 아직 산출된 적이 없다는 뜻 -- 테마는 이때 "--"를 표시한다. */
  tokPerSec: number | null;
}

const TOKENS_PER_CHAR = 3.1;
const CONTEXT_WINDOW_CHARS = 6000;
const TOK_PER_SEC_MIN = 4;
const TOK_PER_SEC_MAX = 140;

function formatK(n: number): string {
  const v = Math.max(0, n);
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return String(Math.round(v));
}

/** 문자 하나하나가 아니라 로그 항목 단위라 진짜 랜덤보다 "그럴듯한 흔들림"이면 충분하다. */
function pseudoJitter(seed: number, range: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  const frac = x - Math.floor(x);
  return (frac - 0.5) * 2 * range;
}

/** assistant(재생 로그) 분량과 전체(사용자+assistant) 분량을 함께 센다. */
function measureLog(log: LogEntry[]): { assistant: number; total: number } {
  let assistant = 0;
  let total = 0;
  for (const e of log) {
    let len = 0;
    switch (e.type) {
      case 'prompt':
        len = e.text.length;
        break;
      case 'thinking':
        len = e.done ? e.text.length : 0;
        break;
      case 'text':
        len = e.visible.length;
        break;
      case 'tool':
        len = e.name.length + e.input.length + (e.phase === 'done' ? e.output.length : 0);
        break;
      case 'diff':
        len = e.done ? e.lines.reduce((s, l) => s + l.text.length, 0) : 0;
        break;
      case 'status':
        len = e.done ? e.text.length : 0;
        break;
      default:
        len = 0;
    }
    total += len;
    if (e.type !== 'prompt') assistant += len;
  }
  return { assistant, total };
}

export function useFakeMetrics(phase: Phase, log: LogEntry[]): FakeMetrics {
  const { assistant, total } = measureLog(log);
  const playing = phase === 'playing';

  const tokPerSecRef = useRef<number | null>(null);
  const prevRef = useRef({ assistant: 0, time: Date.now() });

  if (playing) {
    const now = Date.now();
    const dtSec = Math.max((now - prevRef.current.time) / 1000, 0.05);
    const dChars = assistant - prevRef.current.assistant;
    if (dChars > 0) {
      const instantaneous = (dChars * TOKENS_PER_CHAR) / dtSec;
      tokPerSecRef.current = Math.min(TOK_PER_SEC_MAX, Math.max(TOK_PER_SEC_MIN, Math.round(instantaneous)));
    }
    prevRef.current = { assistant, time: now };
  } else {
    // 타이핑/대기 중엔 다음 재생이 시작될 때 급격한 스파이크가 나지 않도록 기준점만 갱신한다.
    prevRef.current = { assistant, time: Date.now() };
  }

  const jitter = playing ? pseudoJitter(assistant + log.length, 6) : 0;
  const tokens = assistant * TOKENS_PER_CHAR + jitter;
  const contextPct = total <= 0 ? 0 : Math.min(99, Math.max(1, Math.round((total / CONTEXT_WINDOW_CHARS) * 100)));

  return {
    tokensLabel: formatK(tokens),
    contextPct,
    tokPerSec: tokPerSecRef.current,
  };
}

export interface UsageDisguise {
  /** 문자 막대(예: "▓▓▓░░░░░░░"), 항상 USAGE_BAR_WIDTH 길이. */
  bar: string;
  pct: number;
  /** 고정된 임의 값 -- 절대 현재 시각으로 계산하지 않는다(스펙 v0.1.2c). */
  resetsLabel: string;
}

const USAGE_BAR_WIDTH = 10;
/** "사용량 한도" 위장의 리셋 시각 -- 하드코딩된 임의 값, 실제 시계와 무관하다. */
const FAKE_RESETS_LABEL = '21:00';

/**
 * 워크플로우 진행도(완료 스텝 ÷ 총 스텝)를 "사용량 한도" 막대+퍼센트로 위장한다.
 * 화면 어디에도 "i/n" 분수를 그대로 노출하지 않기 위한 유일한 진행도 표기 경로다.
 * completedStepCount는 theme-api.ts의 ThemeProps.completedStepCount를 그대로 받아야 한다
 * (currentStepIndex 기반 자체 계산 금지 -- 마지막 스텝에서 100%에 도달하지 못하는 버그가
 * 있었다, 스펙 v0.1.10 §1).
 */
export function deriveUsage(completedStepCount: number, totalSteps: number): UsageDisguise {
  const pct = totalSteps > 0 ? Math.min(100, Math.max(0, Math.round((completedStepCount / totalSteps) * 100))) : 0;
  const filled = Math.round((pct / 100) * USAGE_BAR_WIDTH);
  const bar = '▓'.repeat(filled) + '░'.repeat(USAGE_BAR_WIDTH - filled);
  return { bar, pct, resetsLabel: FAKE_RESETS_LABEL };
}
