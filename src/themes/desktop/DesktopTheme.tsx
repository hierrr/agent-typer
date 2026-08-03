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

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log, typing.value, phase]);

  const focusInput = () => inputRef.current?.focus();
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

      <input
        ref={inputRef}
        className="desk-hidden-input"
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
