/**
 * desktop 테마 — Cowork류 데스크탑 앱 프레임 위장. ThemeProps만으로 화면 전체를
 * 렌더링한다. 신호등 타이틀바 + 좌 사이드바(프로젝트/에이전트) + 중앙 대화 +
 * 우측 산출물 패널 + 하단 상태바. 클릭 시 항상 숨은 입력에 포커스, Enter/Esc
 * 처리는 handlers(엔진)와 App.tsx(Esc 메뉴)가 담당하므로 이 컴포넌트는 순수
 * 렌더만 한다.
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
          <div className="desk-titlebar-title">{'Cowork — Sprint Board'}</div>
          <div className="desk-titlebar-spacer" />
        </header>

        <div className="desk-body">
          <aside className="desk-sidebar">
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
                    onClick={() => onSelectWorkflow(w.id)}
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
          <span>에이전트 3개 실행 중</span>
          <span className="desk-statusbar-dim">{'·'}</span>
          <span>큐 대기 0</span>
          <span className="desk-statusbar-dim">{'·'}</span>
          <span>처리량 {metrics.throughputLabel}</span>
          <span className="desk-statusbar-dim">{'·'}</span>
          <span>가동 {metrics.elapsedLabel}</span>
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
