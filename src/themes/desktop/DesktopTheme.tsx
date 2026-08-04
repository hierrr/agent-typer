/**
 * desktop 테마 — Cowork류 데스크탑 앱 프레임 위장. ThemeProps만으로 화면 전체를
 * 렌더링한다. 신호등 타이틀바 + 좌 사이드바(프로젝트/에이전트) + 중앙 대화 +
 * 우측 산출물 패널 + 하단 상태바. 클릭 시 항상 숨은 입력에 포커스, Enter/Esc
 * 처리는 handlers(엔진)와 App.tsx(Esc 메뉴)가 담당하므로 이 컴포넌트는 순수
 * 렌더만 한다.
 * v0.1.16 §1: 타이틀바 중앙 텍스트 클릭/탭으로도 메뉴가 열린다(Esc와 병행, 모바일 지원).
 * v0.1.16 §2: 하단 상태바는 두 그룹(에이전트 상태 / 처리량·가동)으로 나뉘어, 좁은 화면에서
 * desk.css 미디어쿼리가 이를 두 줄로 쌓는다(단어 중간 줄바꿈 방지).
 * v0.1.16 §2(추가): 좁은 화면에서 좌 사이드바도 기본 숨김 + 타이틀바 좌측 햄버거(☰)로 여는
 * 드로어(오버레이)가 된다(chat과 동일 패턴). 사이드바 상단 브랜드 영역을 탭하면 드로어를
 * 닫으면서 Esc 메뉴를 연다 -- 넓은 화면 고정 사이드바에서도 동일하게 동작.
 * v0.1.17 §1: 숨은 입력을 desk-inputbar(실제 입력줄) 안으로 옮겨 배치했다 -- 모바일
 * 키보드가 뜰 때 포커스 스크롤이 화면 상단(구 위치: fixed top:0/left:0)이 아니라 입력창
 * 쪽으로 향하게 하기 위함. desk-inputbar는 항상 마운트되므로(내용만 조건부) 재마운트 없음.
 * v0.1.17 §2(2차 피드백): readOnly(phase==='playing') 토글이 모바일에서 키보드를 내리는
 * 원인으로 확인돼 제거했다 -- playing 중 입력 무시는 handleInput의 phase 게이트만으로
 * 충분(포커스 불변 원칙). 조합(IME) 중에는 scroll-follow effect와 루트 탭 리포커스 모두
 * 개입을 스킵한다(조합 보호 강화). visualViewport resize(키보드 온/오프)마다 스크롤을
 * 최하단으로 재고정한다(하단 고정).
 */

import { useEffect, useRef, useState } from 'react';
import type { ThemeProps } from '../theme-api';
import { DesktopLog } from './DesktopLog';
import { DeskGhostInput } from './GhostInput';
import { ArtifactsPanel } from './ArtifactsPanel';
import { deriveDesktopMetrics, deriveUsage } from './fakeMetrics';
import { FAKE_AGENTS } from './fakeSidebar';
import './desktop.css';

export function DesktopTheme(props: ThemeProps) {
  const {
    phase,
    step,
    typing,
    log,
    roundCount,
    completedStepCount,
    liveStats,
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
  const working = phase === 'playing';
  const metrics = deriveDesktopMetrics(liveStats);
  const usage = deriveUsage(completedStepCount, roundCount);
  const activeWorkflow = workflows.find((w) => w.id === activeWorkflowId);

  return (
    <div className="desk-backdrop" onClick={focusInput}>
      <div className="desk-window">
        <header className="desk-titlebar">
          <div className="desk-traffic">
            <span className="desk-dot desk-dot-red" />
            <span className="desk-dot desk-dot-yellow" />
            <span className="desk-dot desk-dot-green" />
          </div>
          <button
            type="button"
            className="desk-hamburger"
            aria-label="사이드바 열기"
            onClick={(e) => {
              // v0.1.16 §2(추가): 좁은 화면 전용 사이드바 드로어 토글. 타이틀바 메뉴 트리거·
              // desk-backdrop의 focusInput과 겹치지 않도록 stopPropagation.
              e.stopPropagation();
              setSidebarOpen((v) => !v);
            }}
          >
            {'☰'}
          </button>
          <div
            className="desk-titlebar-title"
            onClick={(e) => {
              // v0.1.16: 타이틀바 중앙 텍스트 클릭/탭으로 메뉴 오픈(Esc 없는 모바일 지원) --
              // 신호등 점 3개는 트리거가 아니다(실제 macOS 앱처럼 별개 동작으로 보이도록).
              // stopPropagation으로 desk-backdrop의 onClick(focusInput)까지 안 튀게 막는다.
              e.stopPropagation();
              onOpenMenu();
            }}
          >
            {'Cowork — Sprint Board'}
          </div>
          <div className="desk-titlebar-spacer" />
        </header>

        <div className="desk-body">
          <aside className="desk-sidebar" data-open={sidebarOpen}>
            <div
              className="desk-sidebar-brand"
              onClick={(e) => {
                // v0.1.16 §2(추가): 사이드바 상단 브랜드 영역 탭 -- 드로어를 닫으면서 Esc
                // 메뉴를 연다(넓은 화면 고정 사이드바에서도 동일 동작). stopPropagation으로
                // desk-backdrop의 focusInput까지 안 튀게 막는다.
                e.stopPropagation();
                setSidebarOpen(false);
                onOpenMenu();
              }}
            >
              <span className="desk-brand-glyph">{'◆'}</span>
              <span>Cowork</span>
            </div>
            <div className="desk-sidebar-scroll">
              <p className="desk-sidebar-label">프로젝트</p>
              <div className="desk-project-list">
                {workflows.map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    className="desk-project-item"
                    data-active={w.id === activeWorkflowId}
                    title={w.description}
                    onClick={() => {
                      onSelectWorkflow(w.id);
                      // v0.1.16 §2(추가): 좁은 화면 드로어에서 항목 선택 시 드로어를 닫는다
                      // (넓은 화면 고정 사이드바에서는 의미 없는 no-op).
                      setSidebarOpen(false);
                    }}
                  >
                    {w.title}
                  </button>
                ))}
              </div>

              <p className="desk-sidebar-label">에이전트</p>
              <div className="desk-agent-list">
                {FAKE_AGENTS.map((name) => (
                  <div key={name} className="desk-agent-item">
                    <span className="desk-agent-name">{name}</span>
                    {working ? (
                      <span className="desk-agent-status desk-agent-status-working">
                        <span className="desk-agent-spinner" />
                        작업 중
                      </span>
                    ) : (
                      <span className="desk-agent-status desk-agent-status-idle">
                        <span className="desk-agent-dot" />
                        대기
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="desk-plan-widget">
              <div className="desk-plan-line">Pro 플랜 · 사용량 {usage.pct}%</div>
              <div className="desk-usage-track">
                <div className="desk-usage-fill" style={{ width: usage.pct + '%' }} />
              </div>
              <div className="desk-plan-caption">{usage.resetsLabel} 초기화</div>
            </div>
          </aside>

          {sidebarOpen ? (
            <div
              className="desk-sidebar-backdrop"
              onClick={(e) => {
                // v0.1.16 §2(추가): 드로어 바깥(배경) 탭 시 닫는다. desk-backdrop의
                // focusInput까지 튀지 않도록 막는다.
                e.stopPropagation();
                setSidebarOpen(false);
              }}
            />
          ) : null}

          <div className="desk-center">
            <div className="desk-center-header">
              <span className="desk-center-title">세션</span>
              <span className="desk-center-subtitle" title={activeWorkflow?.description}>
                {activeWorkflow?.title ?? ''}
              </span>
            </div>

            <div className="desk-scroll" ref={scrollRef}>
              <DesktopLog log={log} />
            </div>

            <div className="desk-inputbar-wrap">
              <div className={'desk-inputbar' + (shaking ? ' desk-shake' : '')}>
                {showGhost ? (
                  <DeskGhostInput typing={typing} target={step.prompt} />
                ) : (
                  <span className="desk-input-idle">에이전트 실행 중…</span>
                )}
                <button type="button" className="desk-send-btn" aria-label="전송">
                  {'↑'}
                </button>

                {/* v0.1.17: desk-inputbar(실제 입력줄) 안, 항상 마운트된 위치에 둔다 --
                    showGhost 조건부 블록 밖이라 phase 전환에도 재마운트되지 않는다(IME
                    조합 보존). position:absolute라 레이아웃에 영향 없음. readOnly는 두지
                    않는다(포커스 불변 원칙) -- playing 중 입력 무시는 handlers.onInput
                    내부의 phase 게이트만으로 처리한다. */}
                <input
                  ref={inputRef}
                  className="desk-hidden-input"
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

          <ArtifactsPanel log={log} />
        </div>

        <footer className="desk-statusbar">
          <span className="desk-statusbar-group">
            <span>에이전트 3개 실행 중</span>
            <span className="desk-statusbar-dim">{'·'}</span>
            <span>큐 대기 0</span>
          </span>
          <span className="desk-statusbar-group">
            <span>처리량 {metrics.throughputLabel}</span>
            <span className="desk-statusbar-dim">{'·'}</span>
            <span>가동 {metrics.elapsedLabel}</span>
          </span>
        </footer>
      </div>
    </div>
  );
}
