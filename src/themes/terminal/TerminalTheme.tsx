/**
 * terminal 테마 — Claude Code류 CLI 위장. ThemeProps만으로 화면 전체를 렌더링한다.
 * 클릭 시 항상 숨은 입력에 포커스, Enter/Esc 등 키 처리는 handlers.onKeyDown(엔진)과
 * App.tsx(Esc 메뉴)가 담당하므로 이 컴포넌트는 순수하게 "보여주기"만 한다.
 * v0.1.1: 헤더 아래 워크플로우 탭바 추가, 가짜 상태바는 log 기반 useFakeMetrics로 교체.
 * v0.1.2: 헤더/탭바 어디에도 "스텝 i/n" 진행 분수를 노출하지 않는다 -- 진행도는 하단
 * 상태바 우측의 사용량 막대(usage bar) + 퍼센트로만 위장 표기한다(deriveUsage 참고).
 * v0.1.16: 헤더 라인 클릭/탭으로도 메뉴가 열린다(Esc와 병행, 모바일 지원) -- 커서 포인터
 * 등 시각 단서는 넣지 않는다(위장 유지).
 * v0.1.17 §1: 숨은 입력을 term-scroll(실제 프롬프트 라인이 보이는 위치) 안으로 옮겨
 * 배치했다 -- 모바일 키보드가 뜰 때 포커스 스크롤이 화면 상단(구 위치: fixed
 * top:0/left:0)이 아니라 타이핑 영역으로 향하게 하기 위함. 노드는 재마운트 없이 항상
 * 마운트 상태 유지, 위치는 position:sticky + bottom:0(1px·opacity 0)로만 조정.
 * v0.1.17 §2(2차 피드백): readOnly(phase==='playing') 토글이 모바일에서 키보드를 내리는
 * 원인으로 확인돼 제거했다 -- playing 중 입력 무시는 handleInput의 phase 게이트만으로
 * 충분(포커스 불변 원칙). 조합(IME) 중에는 scroll-follow effect와 루트 탭 리포커스 모두
 * 개입을 스킵한다(조합 보호 강화). visualViewport resize(키보드 온/오프)마다 스크롤을
 * 최하단으로 재고정한다(하단 고정).
 */

import { useEffect, useRef, useState } from 'react';
import type { ThemeProps } from '../theme-api';
import { LogLine } from './LogLine';
import { GhostPrompt } from './GhostPrompt';
import { WorkflowTabs } from './WorkflowTabs';
import { useFakeMetrics, deriveUsage } from './fakeMetrics';
import './terminal.css';

export function TerminalTheme(props: ThemeProps) {
  const {
    phase,
    step,
    typing,
    log,
    roundCount,
    completedStepCount,
    inputRef,
    handlers,
    workflows,
    activeWorkflowId,
    onSelectWorkflow,
    onOpenMenu,
  } = props;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [shaking, setShaking] = useState(false);

  useEffect(() => {
    if (typing.shakeToken === 0) return;
    setShaking(true);
    const t = setTimeout(() => setShaking(false), 380);
    return () => clearTimeout(t);
  }, [typing.shakeToken]);

  // v0.1.17 §2: 조합(IME) 중에는 어떤 프로그램적 스크롤 개입도 금지한다 -- 조합 중 매 키
  // 입력(자모 단위)마다 scrollTop을 강제로 바꾸는 것이 실기기에서 IME 조합/키보드가
  // 끊기는 사례의 원인으로 확인됐다(스크롤된 상태에서 조합 중 키보드가 사라지는 버그).
  // typing.composing이 false로 돌아오면(compositionend) 이 effect가 다시 돌아 자연스럽게
  // 따라잡으므로 별도의 catch-up 로직이 필요 없다.
  useEffect(() => {
    if (typing.composing) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log, typing.value, typing.composing, phase]);

  // v0.1.17 §2(4): visualViewport resize(키보드 온/오프) 때마다 트랜스크립트를 최하단으로
  // 재고정한다. 응답 재생 자동 스크롤(위 effect)과 같은 규칙(조합 중 스킵)을 따른다.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => {
      if (typing.composing) return;
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    };
    vv.addEventListener('resize', onResize);
    return () => vv.removeEventListener('resize', onResize);
  }, [typing.composing]);

  // v0.1.17 §2: preventScroll + 조합 보호 -- (1) 조합 중엔 루트 탭 리포커스를 스킵(조합
  // 보호 강화), (2) 이미 포커스면 focus() 재호출도 no-op(document.activeElement 체크,
  // 불필요한 재호출로 인한 모바일 스크롤/키보드 흔들림 방지), (3) 사용자가 직접 키보드를
  // 내려(blur) 둔 상태는 화면 탭 시에만 복귀(이 함수 자체가 그 유일한 복귀 경로).
  const focusInput = () => {
    if (typing.composing) return;
    const el = inputRef.current;
    if (!el || document.activeElement === el) return;
    el.focus({ preventScroll: true });
  };
  const metrics = useFakeMetrics(phase, log);
  const usage = deriveUsage(completedStepCount, roundCount);
  const showGhost = phase === 'briefing' || phase === 'typing';

  return (
    <div className="term-root" onClick={focusInput}>
      <header
        className="term-header"
        onClick={(e) => {
          // v0.1.16: 헤더 탭/클릭으로 메뉴 오픈(Esc 없는 모바일 지원). stopPropagation으로
          // 이 클릭이 term-root의 onClick(focusInput)까지 같이 튀지 않게 막는다.
          e.stopPropagation();
          onOpenMenu();
        }}
      >
        <span className="term-header-title">{'✳ agent-cli v0.1.0 · ~/work'}</span>
      </header>

      <WorkflowTabs workflows={workflows} activeId={activeWorkflowId} onSelect={onSelectWorkflow} />

      <div className="term-scroll" ref={scrollRef}>
        {log.map((entry) => (
          <LogLine key={entry.id} entry={entry} />
        ))}

        {showGhost && (
          <div className={'term-input-wrap' + (shaking ? ' term-shake' : '')}>
            <GhostPrompt typing={typing} target={step.prompt} />
          </div>
        )}

        {/* v0.1.17: term-scroll(실제 프롬프트가 보이는 스크롤 영역) 안, 항상 마운트된
            위치에 둔다 -- showGhost 조건부 블록 밖이라 phase 전환에도 재마운트되지
            않는다(IME 조합 보존). position:sticky라 레이아웃에 거의 영향 없음(1px).
            readOnly는 두지 않는다(포커스 불변 원칙) -- playing 중 입력 무시는
            handlers.onInput 내부의 phase 게이트만으로 처리한다. */}
        <input
          ref={inputRef}
          className="term-hidden-input"
          onInput={handlers.onInput}
          onCompositionStart={handlers.onCompositionStart}
          onCompositionEnd={handlers.onCompositionEnd}
          onKeyDown={handlers.onKeyDown}
          onPaste={handlers.onPaste}
          onSelect={handlers.onSelectionChange}
          onMouseUp={handlers.onSelectionChange}
          onFocus={handlers.onSelectionChange}
          autoFocus
          autoComplete="off"
          spellCheck={false}
          aria-label="타이핑 입력"
        />
      </div>

      <footer className="term-statusbar">
        <span className="term-statusbar-group">
          <span>tokens {metrics.tokensLabel}</span>
          <span className="term-statusbar-dim">{'·'}</span>
          <span>context {metrics.contextPct}%</span>
          <span className="term-statusbar-dim">{'·'}</span>
          <span>{metrics.tokPerSec !== null ? `${metrics.tokPerSec} tok/s` : '— tok/s'}</span>
        </span>
        <span className="term-statusbar-group">
          <span>
            usage {usage.bar} {usage.pct}%
          </span>
          <span className="term-statusbar-dim">{'·'}</span>
          <span>resets {usage.resetsLabel}</span>
        </span>
      </footer>
    </div>
  );
}
