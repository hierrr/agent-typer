/**
 * 앱 셸 — 워크플로우(3~6스텝) 진행, 테마 선택/폴백, Esc 오버레이 메뉴,
 * document.title 위장, SessionReport 전환을 담당한다.
 * 실제 스텝 판정/재생은 engine/typing.ts(useRoundEngine)에 위임하고,
 * 화면 렌더링은 등록된 테마 컴포넌트(theme-api.ts)에 위임한다.
 *
 * v0.1.1: 진행 단위가 "스프린트 5라운드"에서 "워크플로우 1건(스텝 3~6)"으로 바뀌었다.
 * 워크플로우가 끝나면(마지막 스텝 재생 완료) 항상 SessionReport로 전환한다.
 * v0.1.2/v0.1.3: 언어 필터 기능은 완전히 제거됐다 — 피커는 항상 전체 워크플로우 목록을
 * 보여주고(순서는 data/index.ts가 언어/카테고리 인터리브로 결정), 언어 구분은 제목만으로 한다.
 * "계속 일하기"/"다른 업무 시작"도 전체 목록 기준으로 동작한다.
 */

import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import type { RoundStats, ThemeId, Workflow } from './engine/types';
import { useRoundEngine } from './engine/typing';
import { computeLiveStats, computeSessionStats } from './engine/stats';
import { generateReport } from './engine/exaggerate';
import { allWorkflows } from './data';
import { getTheme, listThemes, resolveThemeId, type WorkflowMeta } from './themes/theme-api';
import { TerminalTheme } from './themes/terminal/TerminalTheme';
import { MenuOverlay } from './ui/MenuOverlay';
import { SessionReport } from './ui/SessionReport';

// 테마 모듈을 전부 로드해 등록 부작용(registerTheme 호출)을 일으킨다.
// src/themes/chat, src/themes/desktop 이 나중에 추가돼도 이 파일은 수정할 필요가 없다.
import.meta.glob('./themes/*/index.ts', { eager: true });

function toMeta(w: Workflow): WorkflowMeta {
  return { id: w.id, title: w.title, description: w.description, category: w.category, lang: w.lang, stepCount: w.steps.length };
}

// allWorkflows는 모듈 로드 시 한 번 정해지고 런타임에 바뀌지 않으므로 렌더마다 다시 만들 필요가 없다.
const WORKFLOW_METAS: WorkflowMeta[] = allWorkflows.map(toMeta);

type Screen = 'game' | 'report';

export default function App() {
  const [themeId, setThemeId] = useState<ThemeId>('terminal');
  const [screen, setScreen] = useState<Screen>('game');
  const [menuOpen, setMenuOpen] = useState(false);
  const [rounds, setRounds] = useState<RoundStats[]>([]);

  const engine = useRoundEngine({
    onRoundComplete: (stats) => setRounds((prev) => [...prev, stats]),
    onPlaybackDone: () => {
      const wf = engine.workflow;
      if (!wf) return;
      const next = engine.stepIndex + 1;
      if (next < wf.steps.length) {
        engine.begin(wf, next);
      } else {
        setScreen('report');
        setMenuOpen(false);
      }
    },
  });

  /** 진행 중이던 것은 확인 없이 버리고 workflow를 처음(스텝 0)부터 새로 시작한다 — 새 세션이므로 로그도 리셋. */
  function startWorkflow(wf: Workflow) {
    engine.resetSession();
    setRounds([]);
    engine.begin(wf, 0);
    setScreen('game');
    setMenuOpen(false);
  }

  // 마운트 시 1회: 첫 워크플로우 시작. useLayoutEffect로 페인트 전에 첫 스텝을 채운다.
  useLayoutEffect(() => {
    if (allWorkflows.length === 0) return;
    engine.begin(allWorkflows[0], 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Esc: 보고서 화면이면 즉시 닫고 게임으로, 아니면 메뉴 토글.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      if (screen === 'report') {
        setScreen('game');
        return;
      }
      setMenuOpen((v) => !v);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [screen]);

  const resolvedThemeId = resolveThemeId(themeId);
  const themeDef = getTheme(resolvedThemeId);
  const ActiveComponent = themeDef?.Component ?? TerminalTheme;

  useEffect(() => {
    document.title = themeDef?.documentTitle ?? 'AgentTyper';
  }, [themeDef]);

  const sessionStats = useMemo(() => computeSessionStats(rounds), [rounds]);
  const workflowTitle = engine.workflow?.title ?? '';
  const report = useMemo(() => generateReport(sessionStats, workflowTitle), [sessionStats, workflowTitle]);
  const liveStats = computeLiveStats(rounds, {
    typedLength: engine.typing.value.length,
    startedAt: engine.typing.startedAt,
  });

  function handleSelectWorkflow(id: string) {
    const wf = allWorkflows.find((w) => w.id === id);
    if (!wf) return;
    startWorkflow(wf);
  }

  /** 보고서의 "계속 일하기" — 전체 워크플로우 목록에서 다음 것을 순환 선택해 자동 시작. */
  function handleContinue() {
    if (allWorkflows.length === 0) return;
    const currentId = engine.workflow?.id;
    const idx = allWorkflows.findIndex((w) => w.id === currentId);
    const next = allWorkflows[(idx === -1 ? 0 : idx + 1) % allWorkflows.length];
    startWorkflow(next);
  }

  /** "다른 업무 시작" — 현재와 다른 워크플로우를 무작위로 골라 새로 시작(가능한 후보가 없으면 아무거나). */
  function handleSwitchWork() {
    if (allWorkflows.length === 0) return;
    const currentId = engine.workflow?.id;
    const candidates = allWorkflows.filter((w) => w.id !== currentId);
    const pool = candidates.length > 0 ? candidates : allWorkflows;
    startWorkflow(pool[Math.floor(Math.random() * pool.length)]);
  }

  function handleEndWorkflow() {
    setScreen('report');
    setMenuOpen(false);
  }

  if (allWorkflows.length === 0) {
    return (
      <div style={{ padding: 32, fontFamily: 'ui-monospace, monospace', color: '#ccc', background: '#111', minHeight: '100vh' }}>
        로드된 워크플로우가 없습니다. src/data/packs/*.ts 를 확인하세요.
      </div>
    );
  }

  const currentStep = engine.step;
  const currentWorkflow = engine.workflow;
  if (!currentStep || !currentWorkflow) return null;

  return (
    <>
      {screen === 'report' ? (
        <SessionReport
          report={report}
          onContinue={handleContinue}
          onSwitchWork={handleSwitchWork}
          onClose={() => setScreen('game')}
        />
      ) : (
        <>
          <ActiveComponent
            phase={engine.phase}
            step={currentStep}
            typing={engine.typing}
            log={engine.log}
            roundIndex={engine.stepIndex + 1}
            roundCount={currentWorkflow.steps.length}
            liveStats={liveStats}
            inputRef={engine.inputRef}
            handlers={engine.handlers}
            workflows={WORKFLOW_METAS}
            activeWorkflowId={currentWorkflow.id}
            completedStepCount={rounds.length}
            onSelectWorkflow={handleSelectWorkflow}
          />
          {menuOpen && (
            <MenuOverlay
              themes={listThemes()}
              currentThemeId={themeId}
              onSelectTheme={(id) => {
                setThemeId(id);
                setMenuOpen(false);
              }}
              onEndWorkflow={handleEndWorkflow}
              onSwitchWork={handleSwitchWork}
              onClose={() => setMenuOpen(false)}
            />
          )}
        </>
      )}
    </>
  );
}
