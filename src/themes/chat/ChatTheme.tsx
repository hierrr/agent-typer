/**
 * chat 테마 — 밝은 웹챗류 위장. ThemeProps만으로 화면 전체를 렌더링한다.
 * 좌측 대화목록 사이드바(전부 장식) + 중앙 대화 + 하단 고정 입력창.
 * 클릭 시 항상 숨은 입력에 포커스(term 테마와 동일한 방식), Enter/Esc 처리는
 * handlers(엔진)와 App.tsx(Esc 메뉴)가 담당하므로 이 컴포넌트는 순수 렌더만 한다.
 */

import { useEffect, useRef, useState } from 'react';
import type { ThemeProps } from '../theme-api';
import { ChatLog } from './ChatLog';
import { ChatGhostInput } from './GhostInput';
import { deriveUsage } from './usage';
import './chat.css';

export function ChatTheme(props: ThemeProps) {
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
  const showGhost = phase === 'briefing' || phase === 'typing';
  const usage = deriveUsage(completedStepCount, roundCount);

  return (
    <div className="chat-root" onClick={focusInput}>
      <aside className="chat-sidebar">
        <div className="chat-sidebar-scroll">
          <div className="chat-sidebar-brand">
            <span className="chat-brand-glyph">{'◆'}</span>
            <span>Assistant</span>
          </div>

          <button type="button" className="chat-newchat-btn">
            <span className="chat-newchat-plus">{'+'}</span> 새 대화
          </button>

          <nav className="chat-sidebar-list">
            {workflows.map((w) => (
              <button
                key={w.id}
                type="button"
                className="chat-convo-item"
                data-active={w.id === activeWorkflowId}
                title={w.description}
                onClick={() => onSelectWorkflow(w.id)}
              >
                {w.title}
              </button>
            ))}
          </nav>
        </div>

        <div className="chat-plan-chip">
          <div className="chat-usage-track">
            <div className="chat-usage-fill" style={{ width: usage.pct + '%' }} />
          </div>
          <span className="chat-usage-label">
            사용량 {usage.pct}% · {usage.resetsLabel} 초기화
          </span>
        </div>
      </aside>

      <div className="chat-main">
        <header className="chat-header">
          <button type="button" className="chat-model-selector">
            Sonoma 5 Auto <span className="chat-model-caret">{'▾'}</span>
          </button>
        </header>

        <div className="chat-scroll" ref={scrollRef}>
          <ChatLog log={log} />
        </div>

        <div className="chat-inputbar-wrap">
          <div className={'chat-inputbar' + (shaking ? ' chat-shake' : '')}>
            {showGhost ? (
              <ChatGhostInput typing={typing} target={step.prompt} />
            ) : (
              <span className="chat-input-idle">응답 생성 중…</span>
            )}
            <button type="button" className="chat-send-btn" aria-label="전송">
              {'↑'}
            </button>
          </div>
        </div>
      </div>

      <input
        ref={inputRef}
        className="chat-hidden-input"
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
    </div>
  );
}
