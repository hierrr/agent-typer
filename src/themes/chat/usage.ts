/**
 * chat 테마 "사용량 한도" 위장 -- 워크플로우 진행도(완료 스텝 ÷ 총 스텝)를 무료 한도
 * UI 문법(퍼센트 막대 + 고정 초기화 시각)으로 위장한다(스펙 v0.1.2 §2).
 * 화면 어디에도 "n/n" 분수·"라운드" 단어를 노출하지 않기 위한 유일한 진행도 표기 경로다.
 * resetsLabel은 고정된 임의 값이며 현재 시각과 무관하다(스펙 v0.1.2c) -- 계산 금지.
 */

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
