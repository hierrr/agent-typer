/**
 * chat 테마 — 밝은 웹챗류 위장. ThemeProps만으로 화면 전체를 렌더링한다.
 * 좌측 대화목록 사이드바(전부 장식) + 중앙 대화 + 하단 고정 입력창.
 * 클릭 시 항상 숨은 입력에 포커스(term 테마와 동일한 방식), Enter/Esc 처리는
 * handlers(엔진)와 App.tsx(Esc 메뉴)가 담당하므로 이 컴포넌트는 순수 렌더만 한다.
 * v0.1.16 §1: 헤더(모델 셀렉터 영역) 클릭/탭으로도 메뉴가 열린다(Esc와 병행, 모바일 지원).
 * v0.1.16 §2: 좁은 화면에서는 사이드바가 기본 숨김이고, 모델 셀렉터 좌측 햄버거(☰)를 탭하면
 * 드로어(오버레이)로 열린다 -- 워크플로우 선택 또는 바깥(배경) 탭 시 닫힌다. 넓은 화면은
 * 기존 고정 사이드바 그대로.
 * v0.1.16 §2(추가): 사이드바 상단 브랜드 영역(◆ Assistant)을 탭하면 드로어를 닫으면서 Esc
 * 메뉴를 연다 -- 넓은 화면 고정 사이드바에서도 동일하게 동작.
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
    onOpenMenu,
  } = props;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [shaking, setShaking] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
      <aside className="chat-sidebar" data-open={sidebarOpen}>
        <div className="chat-sidebar-scroll">
          <div
            className="chat-sidebar-brand"
            onClick={(e) => {
              // v0.1.16 §2(추가): 사이드바 상단 브랜드 영역 탭 -- 드로어를 닫으면서 Esc
              // 메뉴를 연다(넓은 화면 고정 사이드바에서도 동일 동작). stopPropagation으로
              // chat-root의 focusInput까지 안 튀게 막는다.
              e.stopPropagation();
              setSidebarOpen(false);
              onOpenMenu();
            }}
          >
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
                onClick={() => {
                  onSelectWorkflow(w.id);
                  // v0.1.16 §2: 좁은 화면 드로어에서 항목 선택 시 드로어를 닫는다(넓은 화면
                  // 고정 사이드바에서는 의미 없는 no-op).
                  setSidebarOpen(false);
                }}
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

      {sidebarOpen ? (
        <div
          className="chat-sidebar-backdrop"
          onClick={(e) => {
            // v0.1.16 §2: 드로어 바깥(배경) 탭 시 닫는다. chat-root의 onClick(focusInput)까지
            // 튀지 않도록 막는다.
            e.stopPropagation();
            setSidebarOpen(false);
          }}
        />
      ) : null}

      <div className="chat-main">
        <header
          className="chat-header"
          onClick={(e) => {
            // v0.1.16: 상단 헤더(모델 셀렉터 포함 영역) 클릭/탭으로 메뉴 오픈(Esc 없는 모바일
            // 지원). stopPropagation으로 chat-root의 onClick(focusInput)까지 안 튀게 막는다.
            e.stopPropagation();
            onOpenMenu();
          }}
        >
          <div className="chat-header-left">
            <button
              type="button"
              className="chat-hamburger"
              aria-label="사이드바 열기"
              onClick={(e) => {
                // v0.1.16 §2: 좁은 화면 전용 사이드바 드로어 토글. 같은 커밋의 헤더 탭
                // 메뉴 트리거와 겹치지 않도록 stopPropagation.
                e.stopPropagation();
                setSidebarOpen((v) => !v);
              }}
            >
              {'☰'}
            </button>
            <button type="button" className="chat-model-selector">
              Sonoma 5 Auto <span className="chat-model-caret">{'▾'}</span>
            </button>
          </div>
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
