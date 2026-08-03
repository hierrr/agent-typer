/**
 * 테마 공용 인터페이스 — AgentTyper의 "테마 = 게임 상태·콜백을 받는 React 컴포넌트
 * 등록" 계약이 정의된 곳. 새 테마(chat/desktop 등)를 추가하려면:
 *
 *   1. src/themes/<id>/index.ts 에서 registerTheme({ id, label, documentTitle, status: 'ready', Component })를 호출한다.
 *   2. Component: React.FC<ThemeProps> — 아래 ThemeProps만 가지고 화면 전체(briefing/typing/playing)를 렌더링한다.
 *   3. App.tsx는 src/themes/* /index.ts를 import.meta.glob(eager)로 전부 로드하므로
 *      App.tsx를 수정할 필요가 없다 — 이 파일을 import해서 registerTheme을 호출하는 것만으로 등록 끝.
 *
 * 테마가 "직접" 하지 않아도 되는 것들(App.tsx/공용 UI가 대신 처리):
 *   - Esc 오버레이 메뉴, SessionReport 화면 — App.tsx가 테마 위에 별도로 띄운다.
 *   - document.title 교체 — ThemeDefinition.documentTitle 문자열만 등록하면 App.tsx가 적용한다.
 *   - 워크플로우 진행/세션 통계 집계 — App.tsx + engine이 담당. 언어 필터 기능은 없다(v0.1.2/
 *     v0.1.3에서 완전히 제거) — 테마는 workflows 전체 목록을 그대로 그리기만 하면 된다.
 *
 * 테마가 "반드시" 해야 하는 것:
 *   - 루트 컨테이너 onClick 등에서 inputRef.current?.focus() 호출("클릭하면 항상 숨은 입력에 포커스").
 *   - handlers를 실제 <input>에 전부 연결(onInput/onCompositionStart/onCompositionEnd/onKeyDown/onPaste).
 *     v0.1.8: handlers.onSelectionChange도 onSelect/onMouseUp/onFocus 세 이벤트 모두에 연결해야
 *     한다 — 캐럿 append-only 정책(마우스 클릭/드래그로 생기는 중간 캐럿·선택을 끝으로 되돌림).
 *     세 테마(terminal/chat/desktop) 모두 동일하게 적용돼 있어야 한다.
 *   - typing.charStates + typing.caret으로 목표 프롬프트를 고스트 텍스트로 렌더링. v0.1.1부터
 *     wrong/pending 위치는 목표 글자가 아니라 "사용자가 실제 입력한 글자"를 그린다
 *     (correct/untyped는 그대로 목표 글자) — 맞은 부분 밝게 / 오타는 은은한 붉은 밑줄 /
 *     미입력은 흐리게 / pending은 중립 스타일로 IME 조합 중 표시.
 *   - phase==='playing'일 때 log를 렌더링(재생 중 항목은 스트리밍처럼, done 항목은 정적으로).
 *   - workflows(피커 목록)를 어떤 형태로든 노출하고 onSelectWorkflow(id)로 전환 가능하게 한다
 *     (탭바든 사이드바든 테마 문법에 맞게 — 구체적 표현은 테마 소관).
 *   - v0.1.2: 화면 어디에도 "스텝 i/n" 같은 진행 분수·"라운드" 단어를 그대로 노출하지 않는다.
 *     roundIndex/roundCount/completedStepCount는 각 테마의 원래 서비스가 사용량/한도를 보여주는
 *     자리(터미널 상태바 등)에 진행 막대+퍼센트 같은 위장된 형태로만 녹여 넣는다.
 *   - v0.1.10: 그 진행 막대는 반드시 completedStepCount ÷ roundCount로만 계산한다(테마 자체
 *     인덱스 계산 금지). currentStepIndex(진행 중인 스텝의 0-based 인덱스)는 마지막 스텝을
 *     시작한 뒤로 더 이상 증가하지 않아 100%에 도달하지 못하는 버그가 있었다 — 대신
 *     completedStepCount는 스텝 i 진행 중엔 i, 마지막 스텝 제출 즉시 roundCount가 되고
 *     보고서를 닫아도 다음 워크플로우 시작 전까지 유지된다.
 *   - v0.1.16: Esc가 없는 모바일을 위해 헤더 타이틀 클릭/탭으로도 메뉴가 열려야 한다 --
 *     handlers.onOpenMenu()를 헤더 트리거에 연결한다(terminal=헤더 라인, chat=상단 헤더
 *     전체, desktop=타이틀바 중앙 텍스트만). 트리거 onClick은 반드시 e.stopPropagation()해서
 *     같은 클릭이 루트 컨테이너의 onClick(inputRef.focus())까지 같이 튀지 않게 한다. 커서
 *     포인터 등 과한 시각 단서는 넣지 않는다(위장 유지) — Esc 단축키도 그대로 병행 유지.
 */

import type React from 'react';
import type { Step, ThemeId, WorkflowCategory, WorkflowLang } from '../engine/types';
import type { CharState, Phase, RoundEngineHandlers, TypingView } from '../engine/typing';
import type { LogEntry } from '../engine/player';
import type { LiveStats } from '../engine/stats';

export type { ThemeId, Phase, CharState, TypingView, LogEntry, LiveStats };

/**
 * 워크플로우 피커(탭바/사이드바)가 표시에 필요한 만큼만 노출하는 메타 뷰.
 * 언어 필터는 없다 — 항상 전체 워크플로우가 내려오며, 표시 순서는 data/index.ts가
 * 언어/카테고리 인터리브로 미리 정해둔 순서를 그대로 따른다(테마가 다시 정렬할 필요 없음).
 */
export interface WorkflowMeta {
  id: string;
  title: string;
  description: string;
  category: WorkflowCategory;
  lang: WorkflowLang;
  stepCount: number;
}

/** 테마 컴포넌트에 매 렌더 전달되는 전체 게임 상태 + 입력 핸들러. */
export interface ThemeProps {
  phase: Phase;
  /** 현재 진행 중인 스텝(= 한 라운드의 타이핑 목표 + 응답 스크립트). 세션 시작 후엔 항상 채워진다. */
  step: Step;
  typing: TypingView;
  /** 누적 재생 로그 — 워크플로우가 끝나도 유지되는 스크롤백(터미널/챗 로그 느낌), 새 워크플로우 시작 시 비워진다. */
  log: LogEntry[];
  /** 1-based 현재 스텝 번호 / 활성 워크플로우의 총 스텝 수. */
  roundIndex: number;
  roundCount: number;
  /** 세션 누적 + 진행 중 라운드 실측치 — 테마별 "가짜 지표" 환산의 원재료. */
  liveStats: LiveStats;
  /** 숨은 입력 엘리먼트에 그대로 연결할 ref. */
  inputRef: React.RefObject<HTMLInputElement | null>;
  /** 숨은 입력 엘리먼트에 그대로 연결할 이벤트 핸들러 묶음. */
  handlers: RoundEngineHandlers;

  /** 전체 워크플로우 메타 목록(언어 필터 없음) — 탭바/사이드바 피커가 이 순서 그대로 그린다. */
  workflows: WorkflowMeta[];
  /** workflows 중 현재 활성인 항목의 id(탭/리스트 활성 표시용). */
  activeWorkflowId: string;
  /**
   * 활성 워크플로우에서 제출까지 마친 스텝 수(0~roundCount). 스텝 i(0-based) 진행 중엔 i,
   * 마지막 스텝 제출 즉시(응답 재생/보고서 표시와 무관하게) roundCount로 올라가고, 다음
   * 워크플로우를 시작하기 전까지 그 값을 유지한다(v0.1.10 §1). 사용량 진행 막대의 유일한
   * 데이터 소스 — roundIndex-1과 달리 마지막 스텝에서도 정확히 100%에 도달한다.
   */
  completedStepCount: number;
  /** 피커에서 워크플로우를 선택했을 때 호출 — 진행 중이던 스텝은 확인 없이 버려지고 새로 시작한다. */
  onSelectWorkflow: (id: string) => void;
  /** v0.1.16: 헤더 타이틀 클릭/탭 트리거가 호출 — Esc와 병행하는 모바일용 메뉴 오픈 경로. */
  onOpenMenu: () => void;
}

export type ThemeComponent = React.FC<ThemeProps>;

export interface ThemeDefinition {
  id: ThemeId;
  /** Esc 메뉴 등에 표시할 이름 */
  label: string;
  /** 이 테마가 활성화됐을 때 적용할 document.title (위장 문구) */
  documentTitle: string;
  /** 'coming-soon'이면 메뉴에 "(준비 중)" 표기, 선택해도 terminal로 폴백 렌더링 */
  status: 'ready' | 'coming-soon';
  /** status==='ready'일 때만 사용됨 */
  Component?: ThemeComponent;
}

const registry = new Map<ThemeId, ThemeDefinition>();

// 기본 placeholder 등록 — 실제 테마 모듈이 로드되기 전에도 메뉴가 3종을 전부 보여주도록.
// 실제 registerTheme() 호출이 같은 id로 들어오면 Map.set이 이 항목을 덮어쓴다(순서는 유지됨).
registry.set('terminal', {
  id: 'terminal',
  label: 'Terminal',
  documentTitle: '~/work — agent run',
  status: 'coming-soon',
});
registry.set('chat', {
  id: 'chat',
  label: 'Chat',
  documentTitle: 'Assistant',
  status: 'coming-soon',
});
registry.set('desktop', {
  id: 'desktop',
  label: 'Desktop',
  documentTitle: 'Cowork — Sprint Board',
  status: 'coming-soon',
});

export function registerTheme(def: ThemeDefinition): void {
  registry.set(def.id, def);
}

export function getTheme(id: ThemeId): ThemeDefinition | undefined {
  return registry.get(id);
}

/** 등록 순서(terminal, chat, desktop) 그대로 반환 — 메뉴 표시 순서로 바로 쓸 수 있다. */
export function listThemes(): ThemeDefinition[] {
  return Array.from(registry.values());
}

/** id가 아직 'ready'가 아니면 terminal로 폴백한 id를 반환한다. */
export function resolveThemeId(id: ThemeId): ThemeId {
  const def = registry.get(id);
  if (def && def.status === 'ready' && def.Component) return id;
  return 'terminal';
}
