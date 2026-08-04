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
 * v0.1.17 §1: 숨은 입력을 chat-inputbar(실제 입력 pill) 안으로 옮겨 배치했다 -- 모바일
 * 키보드가 뜰 때 포커스 스크롤이 화면 상단(구 위치: fixed top:0/left:0)이 아니라 입력창
 * 쪽으로 향하게 하기 위함. chat-inputbar는 항상 마운트되므로(내용만 조건부) 재마운트 없음.
 * v0.1.17 §2(2차 피드백): readOnly(phase==='playing') 토글이 모바일에서 키보드를 내리는
 * 원인으로 확인돼 제거했다 -- playing 중 입력 무시는 handleInput의 phase 게이트만으로
 * 충분(포커스 불변 원칙). 조합(IME) 중에는 scroll-follow effect와 루트 탭 리포커스 모두
 * 개입을 스킵한다(조합 보호 강화). visualViewport resize(키보드 온/오프)마다 스크롤을
 * 최하단으로 재고정한다(하단 고정).
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

  // v0.1.17 §2: 조합(IME) 중에는 어떤 프로그램적 스크롤 개입도 금지한다(실기기에서 확인된
  // 원인 -- 조합 중 매 키 입력마다 scrollTop을 강제로 바꾸면 IME/키보드가 끊길 수 있다).
  // typing.composing이 false로 돌아오면(compositionend) 이 effect가 다시 돌아 자연스럽게
  // 따라잡는다.
  useEffect(() => {
    if (typing.composing) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log, typing.value, typing.composing, phase]);

  // v0.1.17 §2(4): visualViewport resize(키보드 온/오프) 때마다 트랜스크립트를 최하단으로
  // 재고정한다. 위 effect와 같은 규칙(조합 중 스킵)을 따른다.
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

  // v0.1.17 §2: preventScroll + 조합 보호 -- (1) 조합 중엔 루트 탭 리포커스를 스킵, (2)
  // 이미 포커스면 focus() 재호출도 no-op(document.activeElement 체크), (3) 사용자가 직접
  // 키보드를 내려(blur) 둔 상태는 화면 탭 시에만 복귀(이 함수 자체가 그 유일한 복귀 경로).
  const focusInput = () => {
    if (typing.composing) return;
    const el = inputRef.current;
    if (!el || document.activeElement === el) return;
    el.focus({ preventScroll: true });
  };
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

            {/* v0.1.17: chat-inputbar(실제 입력 pill) 안, 항상 마운트된 위치에 둔다 --
                showGhost 조건부 블록 밖이라 phase 전환에도 재마운트되지 않는다(IME 조합
                보존). position:absolute라 레이아웃에 영향 없음. readOnly는 두지 않는다
                (포커스 불변 원칙) -- playing 중 입력 무시는 handlers.onInput 내부의
                phase 게이트만으로 처리한다. */}
            <input
              ref={inputRef}
              className="chat-hidden-input"
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
        </div>
      </div>
    </div>
  );
}
