/**
 * 라운드(=워크플로우 한 스텝) 상태기계: briefing(첫 입력 대기) → typing(첫 입력에 타이머 시작)
 * → playing.
 * - 판정은 input 이벤트의 value 기준(keydown 판정 금지). 한글 IME는
 *   compositionstart~end 구간을 판정 유예하고 compositionend에서 확정한다.
 * - 오타/수정/문장 끝 스페이스 관용 등 실제 판정 알고리즘은 engine/judge.ts(순수 함수)에
 *   위임한다 -- 이 파일은 그 결과를 DOM 이벤트/React 상태와 연결하는 배선만 담당한다
 *   (v0.1.4 §3: 판정 로직을 브라우저 이벤트에서 분리해 Node에서 독립 검증할 수 있게 함).
 *   조합 중(composing=true)에는 어떤 값도 judge에 전달하지 않는다 -- compositionend
 *   (또는 비조합 input)에서만 applyCommittedValue를 호출해 도깨비불 등 조합 중 되돌림이
 *   오타/수정으로 잘못 기록되지 않게 한다.
 * - v0.1.12 §1: 제출 조건은 완전 일치가 아니라 "입력 길이 도달"이다 -- 문장 끝 스페이스를
 *   뺀 입력 길이가 목표 길이 이상이면 오타·overflow가 남아 있어도 Enter로 제출된다(길이
 *   미달 Enter는 셰이크). 트랜스크립트에 남는 프롬프트 에코도 목표 텍스트가 아니라 그
 *   시점의 실제 입력값(끝 스페이스만 트림)이라 오타가 그대로 보인다. playing 중 Enter는
 *   스크립트 즉시 완료(빨리감기).
 * - v0.1.8 §1: 캐럿 이동 정책은 append-only -- 입력 캐럿은 항상 입력 끝에 고정한다(UI가
 *   캐럿을 항상 입력 끝에 그리므로, 실제 DOM 캐럿도 구조적으로 항상 끝에 있어야 어긋나지
 *   않는다). ArrowLeft/Right/Up/Down·Home/End는 keydown에서 막고(조합 중 제외), 마우스
 *   클릭/드래그로 생기는 중간 선택은 select/mouseup/focus에서 끝으로 collapse한다.
 *   수정은 오직 백스페이스로만.
 *
 * 입력 요소는 IME 안전을 위해 비제어(uncontrolled) <input>으로 다룬다 -- value를
 * React state로 되먹임하지 않고 ref로만 읽고 쓴다.
 *
 * 워크플로우 진행(다음 스텝으로 넘어갈지, 워크플로우를 끝내고 보고서를 띄울지)은
 * 이 훅의 책임이 아니다 -- 호출부(App.tsx)가 onPlaybackDone에서 begin()을 다시 호출해
 * 다음 스텝을 시작하거나, 워크플로우가 끝났으면 보고서 화면으로 전환한다.
 */

import { useCallback, useRef, useState } from 'react';
import type { ClipboardEvent, CompositionEvent, FormEvent, KeyboardEvent, RefObject, SyntheticEvent } from 'react';
import type { RoundStats, Step, Workflow } from './types';
import { countStrokes } from './strokes';
import {
  applyCommittedValue,
  computeFinalAccuracy,
  createJudgeState,
  isSubmittable,
  markEchoAgainstTarget,
  type JudgeState,
} from './judge';
import { useResponsePlayer, type LogEntry, type PlaceholderContext } from './player';

export type Phase = 'briefing' | 'typing' | 'playing';
export type CharState = 'correct' | 'wrong' | 'pending' | 'untyped';

export interface TypingView {
  /** 현재 입력값(조합 중 텍스트 포함) */
  value: string;
  /** target과 같은 길이. 테마는 이 배열로 고스트 텍스트를 렌더링한다. */
  charStates: CharState[];
  /** target 문자열 내 캐럿 위치(조합 중 텍스트 포함해 계산) */
  caret: number;
  composing: boolean;
  /** target 길이를 넘겨 입력된 확정 문자 수(문장 끝 스페이스는 제외 -- 관용 규칙) */
  overflowCount: number;
  /** 불일치 Enter가 눌릴 때마다 +1 -- 테마는 이 값 변화를 감지해 셰이크 애니메이션을 재생 */
  shakeToken: number;
  startedAt: number | null;
}

function emptyView(targetLength: number): TypingView {
  return {
    value: '',
    charStates: new Array(targetLength).fill('untyped'),
    caret: 0,
    composing: false,
    overflowCount: 0,
    shakeToken: 0,
    startedAt: null,
  };
}

/** 캐럿을 이동시키는 키 -- append-only 정책상 조합 중이 아니면 전부 막는다(스펙 v0.1.8 §1). */
const CARET_LOCK_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End']);

export interface RoundEngineHandlers {
  onInput: (e: FormEvent<HTMLInputElement>) => void;
  onCompositionStart: (e: CompositionEvent<HTMLInputElement>) => void;
  onCompositionEnd: (e: CompositionEvent<HTMLInputElement>) => void;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  onPaste: (e: ClipboardEvent<HTMLInputElement>) => void;
  /**
   * v0.1.8: 캐럿을 항상 입력 끝에 고정(append-only). 테마는 이 핸들러를 hidden input의
   * onSelect/onMouseUp/onFocus에 전부 연결해야 한다(마우스 클릭·드래그로 생기는 중간
   * 캐럿/선택을 끝으로 되돌리기 위함). 세 이벤트 모두 같은 SyntheticEvent 베이스를 쓰므로
   * 이 핸들러 하나로 충분하다.
   */
  onSelectionChange: (e: SyntheticEvent<HTMLInputElement>) => void;
}

export interface UseRoundEngineOptions {
  /** 유효 제출(입력 길이 도달 + Enter, 스펙 v0.1.12 §1) 시점에 호출 -- 라운드 통계 확정 */
  onRoundComplete?: (stats: RoundStats) => void;
  /** 해당 스텝 응답 재생이 끝까지 완료됐을 때 호출 */
  onPlaybackDone?: () => void;
}

export interface RoundEngine {
  phase: Phase;
  workflow: Workflow | null;
  step: Step | null;
  /** 활성 워크플로우 내 0-based 현재 스텝 인덱스. */
  stepIndex: number;
  typing: TypingView;
  log: LogEntry[];
  inputRef: RefObject<HTMLInputElement | null>;
  handlers: RoundEngineHandlers;
  /** workflow의 stepIndex번째 스텝을 시작한다(briefing으로 진입). 스크롤백 로그는 유지된다. */
  begin(workflow: Workflow, stepIndex: number): void;
  /** 스크롤백 로그를 비운다(새 워크플로우 시작 시 사용). */
  resetSession(): void;
}

export function useRoundEngine(options: UseRoundEngineOptions = {}): RoundEngine {
  const onRoundCompleteRef = useRef(options.onRoundComplete);
  onRoundCompleteRef.current = options.onRoundComplete;
  const onPlaybackDoneRef = useRef(options.onPlaybackDone);
  onPlaybackDoneRef.current = options.onPlaybackDone;

  const [phase, setPhase] = useState<Phase>('briefing');
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [step, setStep] = useState<Step | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [typing, setTyping] = useState<TypingView>(() => emptyView(0));

  const inputRef = useRef<HTMLInputElement | null>(null);
  const workflowRef = useRef<Workflow | null>(null);
  const stepRef = useRef<Step | null>(null);
  const phaseRef = useRef<Phase>('briefing');
  const composingRef = useRef(false);
  const startedAtRef = useRef<number | null>(null);
  const keystrokesRef = useRef(0);
  const precomposeLenRef = useRef(0);
  const shakeTokenRef = useRef(0);
  /** 오타/수정 판정 상태 -- 순수 함수(judge.ts)가 다루는 단일 상태 객체. */
  const judgeRef = useRef<JudgeState>(createJudgeState());

  const player = useResponsePlayer({
    onDone: () => onPlaybackDoneRef.current?.(),
  });
  const { resetLog, play: playResponse, fastForward, stop: stopPlayback } = player;

  const setPhaseBoth = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  /** DOM 캐럿/선택이 입력 끝(collapsed)이 아니면 끝으로 되돌린다(append-only 정책, v0.1.8 §1). */
  const enforceCaretAtEnd = useCallback((el: HTMLInputElement) => {
    const len = el.value.length;
    if (el.selectionStart !== len || el.selectionEnd !== len) {
      el.setSelectionRange(len, len);
    }
  }, []);

  const applyValue = useCallback((raw: string, composing: boolean) => {
    const target = stepRef.current?.prompt ?? '';
    const committedLen = composing ? Math.min(precomposeLenRef.current, raw.length) : raw.length;
    const charStates: CharState[] = new Array(target.length);
    for (let i = 0; i < target.length; i++) {
      if (i < committedLen) {
        charStates[i] = raw[i] === target[i] ? 'correct' : 'wrong';
      } else if (i < raw.length) {
        charStates[i] = 'pending';
      } else {
        charStates[i] = 'untyped';
      }
    }
    // overflow 중 스페이스는 문장 끝 스페이스 관용 규칙 대상 -- 통계(overflowCount)에서 뺀다.
    const overflowTail = committedLen > target.length ? raw.slice(target.length, committedLen) : '';
    const overflowCount = overflowTail.split('').filter((ch) => ch !== ' ').length;
    setTyping({
      value: raw,
      charStates,
      caret: Math.min(raw.length, target.length),
      composing,
      overflowCount,
      shakeToken: shakeTokenRef.current,
      startedAt: startedAtRef.current,
    });
  }, []);

  const begin = useCallback(
    (nextWorkflow: Workflow, nextStepIndex: number) => {
      // 이전 스텝이 중간에 버려졌더라도(예: 재생 중 워크플로우 전환) 잔여 재생 타이머가
      // 새 스텝 로그에 계속 끼어들지 않도록 먼저 정리한다.
      stopPlayback();
      const nextStep = nextWorkflow.steps[nextStepIndex];
      workflowRef.current = nextWorkflow;
      stepRef.current = nextStep;
      composingRef.current = false;
      startedAtRef.current = null;
      keystrokesRef.current = 0;
      precomposeLenRef.current = 0;
      shakeTokenRef.current = 0;
      judgeRef.current = createJudgeState();
      if (inputRef.current) inputRef.current.value = '';
      setWorkflow(nextWorkflow);
      setStep(nextStep);
      setStepIndex(nextStepIndex);
      setTyping(emptyView(nextStep.prompt.length));
      setPhaseBoth('briefing');
    },
    [stopPlayback],
  );

  const resetSession = useCallback(() => {
    resetLog();
  }, [resetLog]);

  const handleInput = useCallback(
    (e: FormEvent<HTMLInputElement>) => {
      const raw = e.currentTarget.value;
      keystrokesRef.current += 1;
      if (startedAtRef.current === null) startedAtRef.current = Date.now();
      if (phaseRef.current === 'briefing') setPhaseBoth('typing');
      if (phaseRef.current !== 'typing') return;

      // v0.1.11 §3 코드 레벨 점검: composingRef(수동 추적)만 보지 않고 이 input 이벤트
      // 자체의 네이티브 isComposing도 함께 확인한다 -- compositionstart를 못 받는 등
      // 수동 플래그가 어떤 이유로든 낡아 있어도(stale) 조합 중간값이 judge로 새지 않도록
      // 하는 이중 방어(defense-in-depth). 정상 흐름에서는 두 값이 항상 같아 동작 변화 없음.
      const nativeIsComposing = (e.nativeEvent as InputEvent).isComposing === true;
      if (composingRef.current || nativeIsComposing) {
        // 조합 중 중간값은 절대 판정 상태(judge)로 전달하지 않는다 -- 도깨비불 등 조합 중
        // 되돌림이 오타/수정으로 잘못 기록되는 것을 원천 차단(스펙 v0.1.4 §3).
        applyValue(raw, true);
        return;
      }
      applyCommittedValue(judgeRef.current, raw, stepRef.current?.prompt ?? '');
      applyValue(raw, false);
    },
    [applyValue],
  );

  const handleCompositionStart = useCallback(
    (e: CompositionEvent<HTMLInputElement>) => {
      if (startedAtRef.current === null) startedAtRef.current = Date.now();
      if (phaseRef.current === 'briefing') setPhaseBoth('typing');
      if (phaseRef.current !== 'typing') return;
      composingRef.current = true;
      precomposeLenRef.current = e.currentTarget.value.length;
    },
    [],
  );

  const handleCompositionEnd = useCallback(
    (e: CompositionEvent<HTMLInputElement>) => {
      composingRef.current = false;
      if (phaseRef.current !== 'typing') return;
      const raw = e.currentTarget.value;
      applyCommittedValue(judgeRef.current, raw, stepRef.current?.prompt ?? '');
      applyValue(raw, false);
      // v0.1.8 §1: 조합 확정 직후에도 캐럿이 끝에 있는지 다시 한번 강제한다(방어적 재확인).
      enforceCaretAtEnd(e.currentTarget);
    },
    [applyValue, enforceCaretAtEnd],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (CARET_LOCK_KEYS.has(e.key)) {
        // IME 조합 중에는 개입하지 않는다 -- 후보 이동 등 조합 자체의 방향키 사용을 깨뜨리지
        // 않기 위함(스펙 v0.1.8 §1).
        if (!(composingRef.current || e.nativeEvent.isComposing || e.keyCode === 229)) {
          e.preventDefault();
        }
        return;
      }
      if (e.key !== 'Enter') return;
      e.preventDefault();

      if (phaseRef.current === 'playing') {
        fastForward();
        return;
      }
      if (phaseRef.current !== 'typing') return;
      // IME 조합 확정 키로 눌린 Enter는 제출로 취급하지 않는다.
      if (composingRef.current || e.nativeEvent.isComposing || e.keyCode === 229) return;

      const target = stepRef.current?.prompt ?? '';
      const raw = inputRef.current?.value ?? '';
      if (!isSubmittable(raw, target)) {
        shakeTokenRef.current += 1;
        applyValue(raw, false);
        return;
      }
      // v0.1.12 §1: 트랜스크립트 에코는 목표 텍스트가 아니라 실제 입력값(끝 스페이스만 트림) --
      // 완전 일치를 더 이상 강제하지 않으므로 오타·overflow가 그대로 로그에 남는다.
      const echoText = raw.replace(/ +$/, '');
      // v0.1.14 §1: 위치별 마크(correct=null/wrong/overflow)를 여기서 한 번만 계산해 로그
      // 엔트리에 그대로 저장한다 -- 스크롤백에 남아 있는 한 다음 스텝으로 넘어가도 유지된다.
      const echoMarks = markEchoAgainstTarget(echoText, target);

      const endedAt = Date.now();
      const startedAt = startedAtRef.current ?? endedAt;
      const mistakes = judgeRef.current.mistakes.slice();
      const errors = mistakes.length;
      const targetLength = target.length;
      const strokes = countStrokes(target);
      const elapsedMinutes = Math.max(endedAt - startedAt, 1) / 60000;
      const spm = strokes / elapsedMinutes;
      const cpm = targetLength / elapsedMinutes;
      const wpm = cpm / 5;
      const accuracy = targetLength === 0 ? 100 : Math.max(0, (targetLength - errors) / targetLength) * 100;
      // v0.1.13 §1: 최종 정확도는 judge 이력이 아니라 "지금 제출되는 문자열"을 target과
      // 다시 diff한다(echoMarks와 동일 diff -- 마크 개수를 그대로 센다) -- 다 고치고
      // 제출하면 정확히 100%가 되는 지표.
      const uncorrectedErrors = echoMarks.filter((m) => m !== null).length;
      const finalAccuracy = computeFinalAccuracy(targetLength, uncorrectedErrors);
      const stats: RoundStats = {
        workflowId: workflowRef.current!.id,
        stepId: stepRef.current!.id,
        startedAt,
        endedAt,
        targetLength,
        typedKeystrokes: keystrokesRef.current,
        corrections: judgeRef.current.corrections,
        errors,
        mistakes,
        strokes,
        spm,
        cpm,
        wpm,
        accuracy,
        uncorrectedErrors,
        finalAccuracy,
        // clean 판정은 최초 정확도(accuracy) 기준 유지 -- 처음 실력이 showIf 서사를 결정한다.
        clean: accuracy >= 97,
      };

      onRoundCompleteRef.current?.(stats);
      setPhaseBoth('playing');

      const ctx: PlaceholderContext = {
        wpm,
        cpm,
        spm,
        accuracy,
        errors,
        loc: targetLength * 7,
        files: 2 + (stepRef.current?.difficulty ?? 1),
        commits: stats.clean ? 2 : 1,
      };
      playResponse(stepRef.current!.response, ctx, stats.clean ? 'clean' : 'sloppy', echoText, echoMarks);
    },
    [applyValue, playResponse, fastForward],
  );

  const handlePaste = useCallback((e: ClipboardEvent<HTMLInputElement>) => {
    // 이 앱의 전제는 "진짜 타자 실력 측정" -- 붙여넣기로 판정을 우회하지 못하게 막는다.
    e.preventDefault();
  }, []);

  const handleSelectionChange = useCallback(
    (e: SyntheticEvent<HTMLInputElement>) => {
      // 조합 중에는 IME가 내부적으로 selection을 활용할 수 있으므로 개입하지 않는다.
      if (composingRef.current) return;
      enforceCaretAtEnd(e.currentTarget);
    },
    [enforceCaretAtEnd],
  );

  return {
    phase,
    workflow,
    step,
    stepIndex,
    typing,
    log: player.log,
    inputRef,
    handlers: {
      onInput: handleInput,
      onCompositionStart: handleCompositionStart,
      onCompositionEnd: handleCompositionEnd,
      onKeyDown: handleKeyDown,
      onPaste: handlePaste,
      onSelectionChange: handleSelectionChange,
    },
    begin,
    resetSession,
  };
}
