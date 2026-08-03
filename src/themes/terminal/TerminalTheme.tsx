/**
 * terminal 테마 — Claude Code류 CLI 위장. ThemeProps만으로 화면 전체를 렌더링한다.
 * 클릭 시 항상 숨은 입력에 포커스, Enter/Esc 등 키 처리는 handlers.onKeyDown(엔진)과
 * App.tsx(Esc 메뉴)가 담당하므로 이 컴포넌트는 순수하게 "보여주기"만 한다.
 * v0.1.1: 헤더 아래 워크플로우 탭바 추가, 가짜 상태바는 log 기반 useFakeMetrics로 교체.
 * v0.1.2: 헤더/탭바 어디에도 "스텝 i/n" 진행 분수를 노출하지 않는다 -- 진행도는 하단
 * 상태바 우측의 사용량 막대(usage bar) + 퍼센트로만 위장 표기한다(deriveUsage 참고).
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
  } = props;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [shaking, setShaking] = useState(false);

  useEffect(() => {
    if (typing.shakeToken === 0) return;
    setShaking(true);
    const t = setTimeout(() => setShaking(false), 380);
    return () => clearTimeout(t);
  }, [typing.shakeToken]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log, typing.value, phase]);

  const focusInput = () => inputRef.current?.focus();
  const metrics = useFakeMetrics(phase, log);
  const usage = deriveUsage(completedStepCount, roundCount);
  const showGhost = phase === 'briefing' || phase === 'typing';

  return (
    <div className="term-root" onClick={focusInput}>
      <header className="term-header">
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
      </div>

      <input
        ref={inputRef}
        className="term-hidden-input"
        readOnly={phase === 'playing'}
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
