/**
 * "가짜 상태 지표" — 실측 LiveStats를 desktop 하단 상태바 문구로 환산한다.
 * terminal/fakeMetrics.ts와 같은 취지(연출용 공식, 그럴듯하면 충분)지만
 * desktop은 "에이전트 작업 처리량 / 세션 가동시간" 톤으로 다르게 환산한다.
 *
 * deriveUsage()는 별개 관심사: 워크플로우 진행도(완료 스텝 ÷ 총 스텝)를 좌 사이드바
 * 하단 "Pro 플랜" 위젯의 사용량 막대+퍼센트로 위장한다(스펙 v0.1.2 §2) -- "n/n" 분수는
 * 화면 어디에도 노출하지 않기 위한 유일한 진행도 표기 경로다. resetsLabel은 고정된 임의
 * 값이며 현재 시각과 무관하다(스펙 v0.1.2c) -- 계산 금지.
 */

import type { LiveStats } from '../theme-api';

export interface DesktopMetrics {
  throughputLabel: string;
  elapsedLabel: string;
}

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(Math.max(0, ms) / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function deriveDesktopMetrics(live: LiveStats): DesktopMetrics {
  const throughput = live.lastWpm !== null ? Math.max(4, Math.round(live.lastWpm * 1.8)) : 12;
  return {
    throughputLabel: `${throughput} ops/min`,
    elapsedLabel: formatElapsed(live.sessionElapsedMs),
  };
}

export interface UsageDisguise {
  /** 0~100 정수 퍼센트. */
  pct: number;
  /** 하드코딩된 임의 값 -- 절대 현재 시각으로 계산하지 않는다. */
  resetsLabel: string;
}

const FAKE_RESETS_LABEL = '21시';

/**
 * completedStepCount(theme-api.ts의 ThemeProps.completedStepCount)와 totalSteps로 진행도를
 * 퍼센트로 환산한다. currentStepIndex 기반 자체 계산 금지 -- 마지막 스텝에서 100%에 도달하지
 * 못하는 버그가 있었다(스펙 v0.1.10 §1).
 */
export function deriveUsage(completedStepCount: number, totalSteps: number): UsageDisguise {
  const pct = totalSteps > 0 ? Math.min(100, Math.max(0, Math.round((completedStepCount / totalSteps) * 100))) : 0;
  return { pct, resetsLabel: FAKE_RESETS_LABEL };
}
