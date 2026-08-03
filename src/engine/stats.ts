/**
 * 세션/실시간 통계 집계.
 * RoundStats[] → SessionStats, 그리고 진행 중 라운드까지 포함한 라이브 지표(LiveStats).
 * LiveStats는 각 테마가 자기만의 "가짜 상태 지표"(tokens/context%/tok-s 등)를
 * 도출할 때 쓰는 실측 원재료다 -- 변환 공식 자체는 테마 소관.
 */

import type { RoundStats, SessionStats } from './types';

function average(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function computeSessionStats(rounds: RoundStats[]): SessionStats {
  const totalMs = rounds.reduce((sum, r) => sum + Math.max(0, r.endedAt - r.startedAt), 0);
  const totalChars = rounds.reduce((sum, r) => sum + r.targetLength, 0);
  const totalStrokes = rounds.reduce((sum, r) => sum + r.strokes, 0);
  const totalErrors = rounds.reduce((sum, r) => sum + r.errors, 0);
  const totalCorrections = rounds.reduce((sum, r) => sum + r.corrections, 0);
  // totalKeystrokes는 계약대로 계속 집계하지만 현재 어떤 보고서 행에서도 쓰지 않는다(v0.1.13
  // §1 -- "수정 반영 정확도"가 단위 불일치 지표였던 원인이라 폐기, 향후 다른 지표용으로 보존).
  const totalKeystrokes = rounds.reduce((sum, r) => sum + r.typedKeystrokes, 0);
  const totalUncorrectedErrors = rounds.reduce((sum, r) => sum + r.uncorrectedErrors, 0);
  // 최종 정확도 평균(v0.1.13 §1) = Σ(목표길이 − uncorrectedErrors) ÷ Σ목표길이 × 100, 하한 0 --
  // avgAccuracy 등(라운드별 accuracy를 단순 평균)과 달리 세션 전체 합산 비율이다(짧은 라운드
  // 하나의 극단값에 세션 지표가 안 휘둘리도록, 스펙이 명시한 공식 그대로).
  const avgFinalAccuracy = totalChars > 0 ? Math.max(0, (totalChars - totalUncorrectedErrors) / totalChars) * 100 : 0;
  return {
    rounds,
    totalMs,
    totalChars,
    totalStrokes,
    totalErrors,
    totalCorrections,
    totalKeystrokes,
    avgWpm: average(rounds.map((r) => r.wpm)),
    avgCpm: average(rounds.map((r) => r.cpm)),
    avgSpm: average(rounds.map((r) => r.spm)),
    avgAccuracy: average(rounds.map((r) => r.accuracy)),
    avgFinalAccuracy,
  };
}

/** 완료된 라운드 + 현재 진행 중인 라운드의 실시간 진행분까지 합친 지표. */
export interface LiveStats {
  sessionCharsTyped: number;
  sessionElapsedMs: number;
  lastAccuracy: number | null;
  lastWpm: number | null;
}

export interface LiveStatsInput {
  /** 현재 라운드에서 지금까지 입력된 문자 수 (진행 중이 아니면 0) */
  typedLength: number;
  /** 현재 라운드 타이머 시작 시각 (아직 시작 전이면 null) */
  startedAt: number | null;
}

export function computeLiveStats(rounds: RoundStats[], current: LiveStatsInput): LiveStats {
  const completedChars = rounds.reduce((sum, r) => sum + r.targetLength, 0);
  const completedMs = rounds.reduce((sum, r) => sum + Math.max(0, r.endedAt - r.startedAt), 0);
  const inProgressMs = current.startedAt !== null ? Math.max(0, Date.now() - current.startedAt) : 0;
  const last = rounds[rounds.length - 1];
  return {
    sessionCharsTyped: completedChars + current.typedLength,
    sessionElapsedMs: completedMs + inProgressMs,
    lastAccuracy: last ? last.accuracy : null,
    lastWpm: last ? last.wpm : null,
  };
}
