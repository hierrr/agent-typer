/**
 * AgentTyper 데이터 계약 v2 — 단일 진실 공급원.
 * 이 파일은 오케스트레이터 소유: 서브에이전트는 수정 금지 (변경 제안은 최종 보고로).
 *
 * v2 변경: Scenario/briefing 폐지 → Workflow/Step(멀티스텝 연쇄). 지표에 분당 타수(SPM)와
 * 오타 상세(Mistake) 추가. Diff/Status 이벤트에 durationMs? 페이싱 필드 추가.
 *
 * 플레이스홀더: 응답 이벤트의 모든 문자열 필드에서 해당 스텝(라운드) 성적 기반으로 치환.
 *   {wpm} {cpm} {spm} {accuracy} {errors} — 라운드 실측값
 *   {loc} = 목표길이×7, {files} = 2+difficulty, {commits} = clean이면 2, 아니면 1
 */

export type ThemeId = 'terminal' | 'chat' | 'desktop';

/** 워크플로우 언어. mixed = 한국어 지시에 영어 명령/경로가 섞인 현실적 한영 혼합 */
export type WorkflowLang = 'ko' | 'en' | 'mixed';

export type WorkflowCategory = 'dev' | 'incident' | 'office' | 'absurd';

/** 라운드 성적에 따른 이벤트 노출 조건. clean = accuracy >= 97 */
export type ShowIf = 'always' | 'clean' | 'sloppy';

interface EventBase {
  showIf?: ShowIf;
}

/** 스피너와 함께 표시되는 사고 연출 (예: "Deliberating…") */
export interface ThinkingEvent extends EventBase {
  type: 'thinking';
  text: string;
  durationMs: number;
}

/** 스트리밍 텍스트. cps = 초당 문자 수 (기본 40) */
export interface TextEvent extends EventBase {
  type: 'text';
  text: string;
  cps?: number;
}

/** 도구 호출 연출. 실행 중 표시 durationMs 후 output 공개 */
export interface ToolEvent extends EventBase {
  type: 'tool';
  name: string;   // 예: "Bash", "Read", "Deploy"
  input: string;  // 예: "npm test"
  output: string; // 예: "42 passed"
  durationMs: number;
}

export interface DiffLine {
  op: '+' | '-' | ' ';
  text: string;
}

/** 파일 수정 연출. durationMs 생략 시 플레이어 기본값 */
export interface DiffEvent extends EventBase {
  type: 'diff';
  file: string;
  lines: DiffLine[];
  durationMs?: number;
}

export interface StatusEvent extends EventBase {
  type: 'status';
  kind: 'success' | 'warn' | 'error';
  text: string;
  durationMs?: number;
}

export interface PauseEvent extends EventBase {
  type: 'pause';
  durationMs: number;
}

export type ResponseEvent =
  | ThinkingEvent
  | TextEvent
  | ToolEvent
  | DiffEvent
  | StatusEvent
  | PauseEvent;

/** 워크플로우의 한 단계 = 타자연습 한 라운드 */
export interface Step {
  /** 워크플로우 내 유일 kebab-case */
  id: string;
  /**
   * 타이핑 목표. 단일 라인, 키보드로 그대로 입력 가능한 문자만 (스마트쿼트·em dash 금지).
   * 첫 스텝의 prompt는 상황 설명을 겸한다 (브리핑 대체 — 예: "prod Redis가 5분째 타임아웃이야, 원인 찾아줘").
   */
  prompt: string;
  /**
   * 응답 스크립트. 마지막 스텝이 아니면 끝맺음이 다음 스텝의 prompt를 자연스럽게
   * 유도해야 한다 ("커넥션 풀 고갈이 의심됩니다. 설정을 확인해볼까요?").
   */
  response: ResponseEvent[];
  difficulty: 1 | 2 | 3 | 4 | 5;
}

/** 하나의 업무 = 연결된 스텝 3~6개. 완료 시 보고서가 뜬다 */
export interface Workflow {
  /** 전역 유일 kebab-case (예: incident-redis-timeout) */
  id: string;
  /** 피커(터미널 탭/사이드바)에 표시되는 제목 (예: "Redis 장애 대응") */
  title: string;
  /** 피커/툴팁용 한 줄 설명. 트랜스크립트에는 절대 넣지 않는다 */
  description: string;
  lang: WorkflowLang;
  category: WorkflowCategory;
  steps: Step[];
  tags?: string[];
}

/** 오타 상세: 해당 위치에 처음 확정된 입력이 목표와 달랐던 기록 (수정 여부 무관) */
export interface Mistake {
  index: number;
  expected: string;
  got: string;
}

export interface RoundStats {
  workflowId: string;
  stepId: string;
  startedAt: number;
  endedAt: number;
  /** 목표 문자 수 (음절/문자 단위) */
  targetLength: number;
  /** 백스페이스 포함 총 입력 수 */
  typedKeystrokes: number;
  /** 수정: 입력 중 지운 확정 글자 수 (IME 조합 중 자모 취소는 제외) — 오타와 별도 지표 */
  corrections: number;
  /** mistakes.length와 동일 (편의 필드) */
  errors: number;
  /** 오타 상세 — 보고서의 "기대→입력" 목록에 사용 */
  mistakes: Mistake[];
  /** 목표 텍스트의 타수 (한글 자모 분해 기준 — 규칙은 스펙 문서 참조) */
  strokes: number;
  /** 분당 타수 = strokes / 분. 한국 타자연습 관례 지표 */
  spm: number;
  /** 분당 완성 글자 수 (한글은 음절 기준이라 체감보다 낮음) */
  cpm: number;
  /** cpm / 5 */
  wpm: number;
  /** 최초 정확도 0~100. (목표길이 - 오타) / 목표길이, 하한 0 — 수정해도 회복되지 않음 */
  accuracy: number;
  /** 제출 시점에 남아 있던 불일치 수 (미수정 오타 + overflow, 끝 스페이스 관용 적용) */
  uncorrectedErrors: number;
  /** 최종 정확도 0~100. (목표길이 - uncorrectedErrors) / 목표길이, 하한 0 — 다 고치면 100 */
  finalAccuracy: number;
  /** accuracy(최초 정확도) >= 97 — showIf 연출 기준은 최초 실력 유지 */
  clean: boolean;
}

export interface SessionStats {
  rounds: RoundStats[];
  totalMs: number;
  totalChars: number;
  totalStrokes: number;
  totalErrors: number;
  totalCorrections: number;
  /** 백스페이스 포함 총 입력 수 합계 (현재 UI 미사용 — 향후 입력 효율 지표용 보존) */
  totalKeystrokes: number;
  avgWpm: number;
  avgCpm: number;
  avgSpm: number;
  /** 최초 정확도 평균 (수정 미반영) */
  avgAccuracy: number;
  /** 최종 정확도 평균: Σ(목표길이 - uncorrectedErrors) ÷ Σ목표길이 × 100 */
  avgFinalAccuracy: number;
}
