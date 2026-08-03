/**
 * 타이핑 판정 핵심 로직 -- 브라우저/React와 무관한 순수 상태기계로 분리했다(v0.1.4 §3).
 * typing.ts(useRoundEngine)가 이 모듈을 감싸 실제 DOM 이벤트(input/composition)에 연결한다.
 * 여기 있는 함수들은 전부 순수(같은 입력엔 같은 출력)라 React/DOM 없이 Node 스크립트 등으로
 * 독립적으로 시뮬레이션/검증할 수 있다.
 *
 * 규칙 요약:
 * - 조합 중(composing=true)에는 어떤 중간값이 오가도 절대 이 모듈에 전달되지 않는다 -- 호출부가
 *   compositionend(또는 비조합 input) 시점에만 applyCommittedValue를 호출해야 한다. 즉 mistakes/
 *   corrections는 "확정된" 값에 대해서만 갱신되고, 조합 중 되돌림(도깨비불 포함)은 자연히 제외된다.
 * - 오타(mistakes): 위치별 "최초 확정" 문자가 목표와 다르면 1회만 기록하고, 이후 그 위치를
 *   수정해도(백스페이스 후 재입력) 다시 판정하지 않는다 -- 기록은 영구 유지.
 * - 수정(corrections): 이미 확정된 글자가 삭제될 때 그 개수만큼 센다. 단, 문장 끝 관용
 *   스페이스(아래)를 지우는 것은 수정으로 치지 않는다.
 * - 문장 끝 스페이스 관용: 목표 뒤에 스페이스만 더 입력된 상태는 오타/수정/overflow 어디에도
 *   잡히지 않는다(한글 IME가 마지막 음절을 확정하려고 스페이스를 치는 습관 때문 -- 스펙
 *   v0.1.3 §3).
 * - 제출 조건(v0.1.12 §1): 완전 일치 요구는 폐지됐다 -- isSubmittable()은 "입력 길이 도달"만
 *   본다. 오타·overflow가 남아 있어도 길이만 채우면 Enter로 제출할 수 있다(오타/수정/최초
 *   정확도 지표는 이미 위 규칙대로 누적된 값을 그대로 쓰므로 제출 조건과 무관하게 변하지
 *   않는다).
 * - 최종 정확도(v0.1.13 §1): countUncorrectedErrors()/computeFinalAccuracy()는 judge 상태
 *   이력과 무관하게 "제출되는 그 순간의 문자열"만 다시 diff한다 -- 다 고치고 제출하면
 *   정확히 100%가 되는, "수정하면 회복되는" 지표(최초 정확도는 회복되지 않는 것과 대비).
 * - 트랜스크립트 오타 표시 보존(v0.1.14 §1): markEchoAgainstTarget()이 countUncorrectedErrors와
 *   같은 diff를 위치별 마크 배열로 반환한다 -- 제출 시 이 배열을 LogEntry(prompt)에 저장해
 *   다음 스텝으로 넘어가도(스크롤백에 남아 있는 한) 오타 표시가 사라지지 않게 한다.
 */

import type { Mistake } from './types';

export interface JudgeState {
  /** 마지막으로 확정된(비조합) 입력 길이. */
  committedLen: number;
  /** 마지막으로 확정된 입력 값 전체 -- 삭제 시 무엇이 지워졌는지 판별하는 데 쓰인다. */
  lastCommittedRaw: string;
  /** 이미 최초 확정 판정을 마친 위치 집합(수정해도 다시 판정하지 않기 위함). */
  seenPositions: Set<number>;
  /** 위치별 최초 확정 오타 기록. */
  mistakes: Mistake[];
  /** 입력 중 지워진 확정 글자 수. */
  corrections: number;
}

export function createJudgeState(): JudgeState {
  return { committedLen: 0, lastCommittedRaw: '', seenPositions: new Set(), mistakes: [], corrections: 0 };
}

/** [oldLen, newLen) 구간에서 처음 확정되는 위치들에 대해서만 오타 여부를 영구 기록한다. */
function recordNewCommits(state: JudgeState, oldLen: number, newLen: number, raw: string, target: string): void {
  for (let i = oldLen; i < newLen; i++) {
    if (state.seenPositions.has(i)) continue;
    state.seenPositions.add(i);
    const got = raw[i] ?? '';
    if (i >= target.length) {
      // overflow 위치: 스페이스는 문장 끝 스페이스 관용으로 오타에 잡지 않는다(스펙 v0.1.3 §3).
      if (got !== ' ') state.mistakes.push({ index: i, expected: '', got });
      continue;
    }
    const expected = target[i];
    if (got !== expected) state.mistakes.push({ index: i, expected, got });
  }
}

/** raw가 oldLen에서 newLen으로 줄어들 때(백스페이스 등) 지워진 구간이 관용 스페이스가 아니면 수정으로 센다. */
function countCorrections(state: JudgeState, oldLen: number, newLen: number, target: string): void {
  const removed = state.lastCommittedRaw.slice(newLen, oldLen);
  const removedIsToleratedTrailingSpace = newLen >= target.length && removed.length > 0 && /^ +$/.test(removed);
  if (!removedIsToleratedTrailingSpace) {
    state.corrections += oldLen - newLen;
  }
}

/**
 * 비조합(확정) raw 값이 새로 들어올 때마다 호출한다 -- 조합 중(isComposing)에는 절대 호출하면
 * 안 된다(호출부 책임). 호출 순서: 길이가 줄었으면 countCorrections → recordNewCommits → 상태 갱신.
 */
export function applyCommittedValue(state: JudgeState, raw: string, target: string): void {
  const oldLen = state.committedLen;
  const newLen = raw.length;
  if (newLen < oldLen) countCorrections(state, oldLen, newLen, target);
  recordNewCommits(state, oldLen, newLen, raw, target);
  state.committedLen = newLen;
  state.lastCommittedRaw = raw;
}

/**
 * 제출 가능 여부(스펙 v0.1.12 §1) -- 완전 일치 요구를 폐지하고 "입력 길이 도달"로 완화했다.
 * 목표 뒤 문장 끝 스페이스(스펙 v0.1.3 §3)를 뺀 실제 입력 길이가 목표 길이 이상이면 오타나
 * overflow가 남아 있어도 제출을 허용한다. 길이 미달이면 false(호출부는 셰이크 피드백).
 */
export function isSubmittable(raw: string, target: string): boolean {
  const trimmed = raw.replace(/ +$/, '');
  return trimmed.length >= target.length;
}

/** prompt 에코 한 글자의 판정 마크. 배열 원소가 null이면 그 위치는 마크 없음(정답, 스펙 v0.1.14 §1). */
export interface EchoMark {
  kind: 'wrong' | 'overflow';
  /** wrong일 때만 존재 -- 그 위치의 목표 글자(툴팁용). overflow는 목표 자체가 없어 없음. */
  expected?: string;
}

/**
 * 제출된 echo 텍스트(끝 스페이스 트림됨) 전체를 target과 diff해 위치별 마크를 만든다
 * (스펙 v0.1.14 §1) -- countUncorrectedErrors와 완전히 같은 기준: 목표 구간은 위치별 불일치,
 * 초과분(overflow)은 스페이스를 뺀 비-공백 문자만 마크(끝 스페이스 관용, 스펙 v0.1.3 §3).
 * 반환 배열 길이는 echoText와 같다.
 */
export function markEchoAgainstTarget(echoText: string, target: string): (EchoMark | null)[] {
  const marks: (EchoMark | null)[] = new Array(echoText.length).fill(null);
  for (let i = 0; i < echoText.length; i++) {
    if (i < target.length) {
      if (echoText[i] !== target[i]) marks[i] = { kind: 'wrong', expected: target[i] };
    } else if (echoText[i] !== ' ') {
      marks[i] = { kind: 'overflow' };
    }
  }
  return marks;
}

/**
 * 제출 시점 "남은 불일치" 수(스펙 v0.1.13 §1) -- 최종 정확도의 분자다. judge 상태(mistakes
 * 이력)와는 무관하게, 제출되는 그 순간의 문자열을 target과 다시 diff해서 센다(markEchoAgainstTarget과
 * 동일 기준 -- 마크 개수를 그대로 센다). trimmedRaw는 호출 전에 rtrim(끝 스페이스 제거)돼
 * 있어야 하고, isSubmittable()로 길이가 충분함이 이미 보장된 뒤에만 의미가 있다.
 */
export function countUncorrectedErrors(trimmedRaw: string, target: string): number {
  return markEchoAgainstTarget(trimmedRaw, target).filter((m) => m !== null).length;
}

/** 최종 정확도(스펙 v0.1.13 §1) = (목표길이 − uncorrectedErrors) ÷ 목표길이 × 100, 하한 0. */
export function computeFinalAccuracy(targetLength: number, uncorrectedErrors: number): number {
  if (targetLength === 0) return 100;
  return Math.max(0, (targetLength - uncorrectedErrors) / targetLength) * 100;
}
