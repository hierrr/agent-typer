/**
 * 분당 타수(SPM) 계산용 자모 분해 — 스펙 v0.1.1 §2.
 *
 * 완성형 한글 음절(유니코드 0xAC00~0xD7A3)은 코드포인트 분해로 초/중/종성 인덱스를
 * 복원해 타수를 센다: 초성 1타(쌍자음 ㄲㄸㅃㅆㅉ도 1타), 복합모음 ㅘㅙㅚㅝㅞㅟㅢ는 2타,
 * 겹받침 ㄳㄵㄶㄺㄻㄼㄽㄾㄿㅀㅄ은 2타, 그 외 자모(단독 자모 포함)는 1타.
 * 한글 음절이 아닌 문자(영문/숫자/기호/공백)는 shift 여부와 무관하게 전부 1타.
 */

const HANGUL_BASE = 0xac00;
const HANGUL_LAST = 0xd7a3;
const JUNG_COUNT = 21;
const JONG_COUNT = 28;

/** 복합모음(2타) -- JUNG 테이블(ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ) 내 인덱스: ㅘㅙㅚㅝㅞㅟㅢ */
const COMPLEX_JUNG_INDICES = new Set([9, 10, 11, 14, 15, 16, 19]);

/** 겹받침(2타) -- JONG 테이블(0=받침없음, 1=ㄱ ...) 내 인덱스: ㄳㄵㄶㄺㄻㄼㄽㄾㄿㅀㅄ */
const COMPOUND_JONG_INDICES = new Set([3, 5, 6, 9, 10, 11, 12, 13, 14, 15, 18]);

function strokesForSyllable(code: number): number {
  const offset = code - HANGUL_BASE;
  const jongIndex = offset % JONG_COUNT;
  const jungIndex = Math.floor(offset / JONG_COUNT) % JUNG_COUNT;

  const choStrokes = 1; // 초성은 쌍자음 포함 항상 1타
  const jungStrokes = COMPLEX_JUNG_INDICES.has(jungIndex) ? 2 : 1;
  const jongStrokes = jongIndex === 0 ? 0 : COMPOUND_JONG_INDICES.has(jongIndex) ? 2 : 1;

  return choStrokes + jungStrokes + jongStrokes;
}

/** 문자 하나의 타수. 완성형 한글 음절이면 자모 분해, 그 외(영문/숫자/기호/공백/단독 자모)는 1타. */
export function strokesForChar(ch: string): number {
  const code = ch.codePointAt(0);
  if (code === undefined) return 0;
  if (code >= HANGUL_BASE && code <= HANGUL_LAST) {
    return strokesForSyllable(code);
  }
  return 1;
}

/** 문자열 전체의 타수 합 -- RoundStats.strokes / SPM 산출에 사용. */
export function countStrokes(text: string): number {
  let total = 0;
  for (const ch of text) {
    total += strokesForChar(ch);
  }
  return total;
}
