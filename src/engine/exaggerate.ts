/**
 * 과장 보고서 생성.
 * v0.1.4 §1: 위장 모드와 진짜 지표 모드가 완전히 동일한 레이아웃을 쓰도록, 모든 슬롯(헤드라인/
 * 각 지표 행의 라벨·값·서브캡션/오타 목록 행)이 위장 문구와 실측 문구를 "쌍"으로 갖는다.
 * SessionReport.tsx는 이 Report를 받아 토글 상태에 따라 각 슬롯의 disguise/real 중 하나만
 * 골라 그대로 꽂아 넣는다 -- 컴포넌트 구조 자체는 토글과 무관하게 항상 동일하다.
 *
 * v0.1.9 §2: 스텝 기반 행(완료한 스텝/정확도 97%+/97%미만 및 그 위장짝인 오늘의 커밋/배포/
 * 해결한 장애)을 전부 제거하고, 남은 행 + 신설한 "수정 반영 정확도" 행을 5개 그룹으로
 * 재배치했다: ①속도(SPM·WPM·CPM) ②정확도(최초·수정반영) ③오타·수정 ④입력 분량 ⑤연습 시간.
 * v0.1.11 §2: 그룹 사이 시각 구분선(가로선)은 이상해 보인다는 피드백으로 제거했다 --
 * 그룹핑은 metrics 배열의 행 순서로만 표현하고, 행 간격은 전부 균일하다.
 * v0.1.13 §1: "수정 반영 정확도"(=입력 효율, 목표길이÷총타건수)는 이름이 "다 고치면 100%"를
 * 기대하게 하는데 실체는 단위가 다른 지표였다(한글은 음절당 2~3타라 완벽해도 바닥이 ~37%).
 * "최종 정확도"(제출 시점 남은 불일치 기준, 다 고치면 정확히 100%)로 교체했다.
 * v0.1.15 §1: 오타 상세 행에서 위치 표기를 없애고, 동일한 (기대,입력) 쌍은 한 행 + "×N"
 * 배지로 합친다 -- 위장 문구 해시도 (기대,입력) 쌍만 보고 위치는 안 본다(hashMistakePair)
 * 그래야 같은 쌍이 항상 같은 위장 문구가 된다. mistakeCount(원본 총 건수)는 합산과 별개로
 * 헤더 요약용으로 그대로 남겨 노출한다.
 *
 * types.ts의 BragReport/BragLine(라벨 고정, value만 real로 교체하는 v0.1.1~v0.1.3 방식)은
 * "라벨도 같이 바뀌고 서브캡션도 양쪽에 다 있어야 한다"는 새 요구사항을 담을 자리가 없어
 * 이 파일 안에서 새 로컬 타입(Report/ReportMetricRow/ReportMistakeRow)으로 대체했다.
 * BragReport/BragLine은 v0.1.4에서 types.ts에서 제거됐다 (이 모듈의 Report 계열이 대체)
 * (오케스트레이터에게 정리 여부 제안 -- 최종 보고 참고).
 */

import type { Mistake, SessionStats } from './types';

export interface ReportMetricRow {
  icon: string;
  disguiseLabel: string;
  disguiseValue: string;
  /** 위장 모드의 서브캡션(정의 문구 자리와 같은 슬롯) -- 예: "지난주 대비 +12%". */
  disguiseCaption: string;
  realLabel: string;
  realValue: string;
  /** 진짜 모드의 서브캡션 -- 해당 지표의 정의 한 줄. */
  realCaption: string;
}

export interface ReportMistakeRow {
  /** 위장 모드 행 -- (기대,입력) 쌍 내용 기반 결정적 생성(랜덤/시각 요소 없음). */
  disguiseText: string;
  /** 진짜 모드 행 -- "기대 → 입력" (위치 표기 없음, v0.1.15 §1). */
  realText: string;
  /** 동일 (기대,입력) 쌍이 합쳐진 개수 -- 2 이상이면 UI가 "×N" 배지를 붙인다(두 모드 동일). */
  count: number;
}

export interface Report {
  disguiseHeadline: string;
  realHeadline: string;
  metrics: ReportMetricRow[];
  /** 합산·상한 적용 전 원본 오타 총 건수 -- 오타 상세 섹션 헤더 요약에 쓴다. */
  mistakeCount: number;
  mistakeRows: ReportMistakeRow[];
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

function formatK(n: number): string {
  const v = Math.max(0, n);
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return String(Math.round(v));
}

function disguiseHeadline(avgAccuracy: number, roundCount: number, workflowTitle: string): string {
  if (roundCount === 0) return `${workflowTitle} -- 아직 커밋 하나 없는 새하얀 시작입니다.`;
  const done = `완료한 업무: ${workflowTitle}. `;
  if (avgAccuracy >= 97) return done + '오늘도 프로덕션은 평화롭다.';
  if (avgAccuracy >= 90) return done + '작은 장애 몇 건, 전부 조용히 묻었다.';
  if (avgAccuracy >= 80) return done + '핫픽스가 핫픽스를 부르는 하루였지만 결국 다 막았다.';
  return done + '오늘 회고에서 할 말이 많아질 것 같다.';
}

function realHeadline(session: SessionStats, roundCount: number): string {
  if (roundCount === 0) return '아직 완료한 스텝이 없습니다.';
  return `평균 ${Math.round(session.avgSpm)}타/분 · 최초 정확도 ${session.avgAccuracy.toFixed(1)}%`;
}

/** mistake 하나마다 결정적으로 하나의 문구를 고른다(Math.random/Date 금지, 내용 기반 해시). */
const REVIEW_COMMENTS = [
  '네이밍 컨벤션 통일',
  '불필요한 콘솔 로그 제거',
  '타입 힌트 보강',
  '에러 메시지 문구 수정',
  '주석 오타 수정',
  '린트 경고 해소',
  '커밋 메시지 다듬기',
  '변수명 축약 해제',
  '예외 처리 추가',
  '테스트 케이스 이름 정리',
  'PR 설명 보강',
  '포맷팅 통일',
];

/** (기대,입력) 쌍만 보고 해시한다(위치는 뺀다) -- 동일 쌍은 합쳐진 뒤에도 항상 같은 위장 문구가 되도록. */
function hashMistakePair(expected: string, got: string): number {
  const s = `${expected}:${got}`;
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** 동일한 (기대,입력) 쌍을 한 행으로 합치고 등장 횟수를 센다 -- 원래 등장 순서(첫 등장 기준)를 유지. */
function buildMistakeRows(mistakes: Mistake[]): ReportMistakeRow[] {
  const order: string[] = [];
  const groups = new Map<string, { expected: string; got: string; count: number }>();
  for (const m of mistakes) {
    // expected/got은 항상 0~1글자(overflow는 expected=''), 구분자로 스페이스 하나만 둬도
    // 두 필드 위치가 헷갈릴 수 없다(예: expected=''+got='a' -> " a", expected='a'+got='' -> "a ").
    const key = `${m.expected} ${m.got}`;
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      groups.set(key, { expected: m.expected, got: m.got, count: 1 });
      order.push(key);
    }
  }
  return order.map((key) => {
    const g = groups.get(key)!;
    return {
      disguiseText: `반영한 리뷰 코멘트 -- ${REVIEW_COMMENTS[hashMistakePair(g.expected, g.got) % REVIEW_COMMENTS.length]}`,
      realText: `${g.expected || '∅'} → ${g.got || '∅'}`,
      count: g.count,
    };
  });
}

export function generateReport(session: SessionStats, workflowTitle: string): Report {
  const roundCount = session.rounds.length;
  const minutes = session.totalMs / 60000;

  const loc = session.totalChars * 7;
  const files = roundCount * 3 + Math.floor(session.avgWpm / 20);
  const tokens = session.totalChars * 42;
  const cost = Math.floor(session.avgCpm * 1.337);
  const meetings = Math.floor(minutes / 10) + 1;
  const tokensPerMin = session.avgSpm * 13.5;
  const reviewComments = session.totalErrors + session.totalCorrections;

  const metrics: ReportMetricRow[] = [
    // ① 속도: 분당 타수(SPM) · 평균 WPM · 분당 CPM 인접 배치(v0.1.9 §2)
    {
      icon: '⚡',
      disguiseLabel: '처리량',
      disguiseValue: `${formatK(tokensPerMin)} tokens/min`,
      disguiseCaption: '지난주 대비 +12%',
      realLabel: '분당 타수(SPM)',
      realValue: `${session.avgSpm.toFixed(1)}타/분`,
      realCaption: '목표 텍스트 자모 분해 타건 수 ÷ 분',
    },
    {
      icon: '🗂️',
      disguiseLabel: '수정한 파일',
      disguiseValue: `${fmt(files)}개`,
      disguiseCaption: '리팩토링 범위 내',
      realLabel: '평균 타이핑 속도(WPM)',
      realValue: `${session.avgWpm.toFixed(1)} WPM`,
      realCaption: 'CPM ÷ 5',
    },
    {
      icon: '🔥',
      disguiseLabel: '소모 토큰',
      disguiseValue: `${fmt(tokens)} tok`,
      disguiseCaption: '예산 한도 내',
      realLabel: '분당 입력 속도(CPM)',
      realValue: `${session.avgCpm.toFixed(1)} CPM`,
      realCaption: '분당 완성 글자 수',
    },
    // ② 정확도 2종 인접 배치 -- 최초 정확도(수정 미반영, 회복 불가) / 최종 정확도(제출 시점 기준, 고치면 회복)
    {
      icon: '💰',
      disguiseLabel: '절감한 클라우드 비용',
      disguiseValue: `$${fmt(cost)}`,
      disguiseCaption: '전월 대비 절감',
      realLabel: '최초 정확도',
      realValue: `${session.avgAccuracy.toFixed(1)}%`,
      realCaption: '처음 친 입력 기준 — 수정해도 회복되지 않음',
    },
    {
      icon: '✅',
      disguiseLabel: 'CI 통과율',
      disguiseValue: `${session.avgFinalAccuracy.toFixed(1)}%`,
      disguiseCaption: '리뷰 반영 후 최종 빌드 기준',
      realLabel: '최종 정확도',
      realValue: `${session.avgFinalAccuracy.toFixed(1)}%`,
      realCaption: '제출한 문장 기준 — 고치면 회복됨',
    },
    // ③ 오타 · 수정
    {
      icon: '💬',
      disguiseLabel: '반영한 리뷰 코멘트',
      disguiseValue: `${fmt(reviewComments)}건`,
      disguiseCaption: '품질 게이트 통과',
      realLabel: '오타 · 수정',
      realValue: `오타 ${session.totalErrors} · 수정 ${session.totalCorrections}`,
      realCaption: '오타: 위치별 최초 확정 문자가 목표와 다른 횟수 · 수정: 입력 중 지운 글자 수',
    },
    // ④ 입력 분량
    {
      icon: '📝',
      disguiseLabel: '출고한 코드',
      disguiseValue: `${fmt(loc)}줄`,
      disguiseCaption: '코드 리뷰 통과',
      realLabel: '입력한 글자 수',
      realValue: `${fmt(session.totalChars)}자`,
      realCaption: '확정 입력한 총 글자 수',
    },
    // ⑤ 연습 시간
    {
      icon: '🗓️',
      disguiseLabel: '대체한 회의',
      disguiseValue: `${fmt(meetings)}개`,
      disguiseCaption: '캘린더 여유 확보',
      realLabel: '연습 시간',
      realValue: `${minutes.toFixed(1)}분`,
      realCaption: '이 업무에 쓴 시간',
    },
  ];

  const mistakes = session.rounds.flatMap((r) => r.mistakes);

  return {
    disguiseHeadline: disguiseHeadline(session.avgAccuracy, roundCount, workflowTitle),
    realHeadline: realHeadline(session, roundCount),
    metrics,
    mistakeCount: mistakes.length,
    mistakeRows: buildMistakeRows(mistakes),
  };
}
