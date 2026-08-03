/**
 * 누적 로그(log: LogEntry[])를 desktop 앱 톤(어두운/중성)으로 렌더링한다.
 * 구조는 chat 테마와 같은 문법(prompt=우측, 나머지=좌측)이되 배색만 다르다.
 * tool 카드의 펼침 상태는 entry.id 기준으로 이 컴포넌트가 기억한다.
 * prompt 에코는 entry.marks(스펙 v0.1.14 §1)를 글자별로 훑어 GhostInput과 같은
 * desk-ch-wrong/desk-ch-overflow 클래스를 재사용한다 -- 새 시각 언어 없이 기존 오타 스타일
 * 그대로, 로그에 저장되므로 다음 스텝으로 넘어가도 스크롤백에 남아 있는 한 계속 보인다.
 */

import { useState } from 'react';
import type { LogEntry } from '../theme-api';

const STATUS_ICON: Record<string, string> = { success: '✓', warn: '!', error: '✕' };

export function DesktopLog({ log }: { log: LogEntry[] }) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  function toggle(id: number) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <>
      {log.map((entry) => (
        <DesktopLogItem key={entry.id} entry={entry} expanded={!!expanded[entry.id]} onToggle={() => toggle(entry.id)} />
      ))}
    </>
  );
}

function DesktopLogItem({ entry, expanded, onToggle }: { entry: LogEntry; expanded: boolean; onToggle: () => void }) {
  switch (entry.type) {
    case 'prompt':
      return (
        <div className="desk-row desk-row-user">
          <div className="desk-bubble desk-bubble-user">
            {entry.text.split('').map((ch, i) => {
              const mark = entry.marks[i];
              if (!mark) return <span key={i}>{ch}</span>;
              const cls = mark.kind === 'wrong' ? 'desk-ch-wrong' : 'desk-ch-overflow';
              return (
                <span key={i} className={cls} title={mark.kind === 'wrong' ? `기대: ${mark.expected}` : undefined}>
                  {ch}
                </span>
              );
            })}
          </div>
        </div>
      );

    case 'thinking':
      return (
        <div className="desk-row desk-row-assistant">
          <div className="desk-thinking">
            {entry.done ? (
              <span className="desk-thinking-done">{'✳ 완료 · ' + entry.text}</span>
            ) : (
              <span className="desk-thinking-dots" aria-label="작업 중">
                <span />
                <span />
                <span />
              </span>
            )}
          </div>
        </div>
      );

    case 'text':
      return (
        <div className="desk-row desk-row-assistant">
          <div className="desk-bubble desk-bubble-assistant">
            {entry.visible}
            {!entry.done && <span className="desk-text-caret" />}
          </div>
        </div>
      );

    case 'tool':
      return (
        <div className="desk-row desk-row-assistant">
          <div className="desk-tool-card">
            <button type="button" className="desk-tool-head" onClick={onToggle} aria-expanded={expanded}>
              <span className="desk-tool-chevron">{expanded ? '▾' : '▸'}</span>
              <span className="desk-tool-glyph">{'⚙'}</span>
              <span className="desk-tool-label">
                {entry.name}: {entry.input}
              </span>
              {entry.phase === 'running' && <span className="desk-tool-running">실행 중…</span>}
            </button>
            {expanded && (
              <div className="desk-tool-body">{entry.phase === 'done' ? entry.output : '실행 중…'}</div>
            )}
          </div>
        </div>
      );

    case 'diff':
      return (
        <div className="desk-row desk-row-assistant">
          <div className="desk-diff-card">
            <div className="desk-diff-head">
              <span className="desk-diff-glyph">{'▤'}</span> {entry.file}
            </div>
            <div className="desk-diff-body">
              {entry.lines.map((l, i) => (
                <div
                  key={i}
                  className={'desk-diff-line desk-diff-' + (l.op === '+' ? 'add' : l.op === '-' ? 'del' : 'ctx')}
                >
                  <span className="desk-diff-op">{l.op}</span>
                  {l.text}
                </div>
              ))}
            </div>
          </div>
        </div>
      );

    case 'status':
      return (
        <div className="desk-row desk-row-assistant">
          <span className={'desk-badge desk-badge-' + entry.kind}>
            {STATUS_ICON[entry.kind]} {entry.text}
          </span>
        </div>
      );

    default:
      return null;
  }
}
