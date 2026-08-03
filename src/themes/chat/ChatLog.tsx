/**
 * 누적 로그(log: LogEntry[])를 웹챗 문법으로 렌더링한다.
 * prompt는 우측 user 말풍선, 나머지(thinking/text/tool/diff/status)는 좌측 assistant
 * 영역. tool 카드는 기본 접힘 상태를 이 컴포넌트가 entry.id 기준으로 기억한다.
 * prompt 에코는 entry.marks(스펙 v0.1.14 §1)를 글자별로 훑어 GhostInput과 같은
 * chat-ch-wrong/chat-ch-overflow 클래스를 재사용한다 -- 새 시각 언어 없이 기존 오타 스타일
 * 그대로, 로그에 저장되므로 다음 스텝으로 넘어가도 스크롤백에 남아 있는 한 계속 보인다.
 */

import { useState } from 'react';
import type { LogEntry } from '../theme-api';

const STATUS_ICON: Record<string, string> = { success: '✓', warn: '!', error: '✕' };

export function ChatLog({ log }: { log: LogEntry[] }) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  function toggle(id: number) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <>
      {log.map((entry) => (
        <ChatLogItem key={entry.id} entry={entry} expanded={!!expanded[entry.id]} onToggle={() => toggle(entry.id)} />
      ))}
    </>
  );
}

function ChatLogItem({ entry, expanded, onToggle }: { entry: LogEntry; expanded: boolean; onToggle: () => void }) {
  switch (entry.type) {
    case 'prompt':
      return (
        <div className="chat-row chat-row-user">
          <div className="chat-bubble chat-bubble-user">
            {entry.text.split('').map((ch, i) => {
              const mark = entry.marks[i];
              if (!mark) return <span key={i}>{ch}</span>;
              const cls = mark.kind === 'wrong' ? 'chat-ch-wrong' : 'chat-ch-overflow';
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
        <div className="chat-row chat-row-assistant">
          <div className="chat-thinking">
            {entry.done ? (
              <span className="chat-thinking-done">{'✳ 생각 완료 · ' + entry.text}</span>
            ) : (
              <span className="chat-thinking-dots" aria-label="생각 중">
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
        <div className="chat-row chat-row-assistant">
          <div className="chat-bubble chat-bubble-assistant">
            {entry.visible}
            {!entry.done && <span className="chat-text-caret" />}
          </div>
        </div>
      );

    case 'tool':
      return (
        <div className="chat-row chat-row-assistant">
          <div className="chat-tool-card">
            <button type="button" className="chat-tool-head" onClick={onToggle} aria-expanded={expanded}>
              <span className="chat-tool-chevron">{expanded ? '▾' : '▸'}</span>
              <span className="chat-tool-glyph">{'⚙'}</span>
              <span className="chat-tool-label">
                {entry.name}: {entry.input}
              </span>
              {entry.phase === 'running' && <span className="chat-tool-running">실행 중…</span>}
            </button>
            {expanded && (
              <div className="chat-tool-body">{entry.phase === 'done' ? entry.output : '실행 중…'}</div>
            )}
          </div>
        </div>
      );

    case 'diff':
      return (
        <div className="chat-row chat-row-assistant">
          <div className="chat-diff-card">
            <div className="chat-diff-head">
              <span className="chat-diff-glyph">{'▤'}</span> {entry.file}
            </div>
            <div className="chat-diff-body">
              {entry.lines.map((l, i) => (
                <div
                  key={i}
                  className={'chat-diff-line chat-diff-' + (l.op === '+' ? 'add' : l.op === '-' ? 'del' : 'ctx')}
                >
                  <span className="chat-diff-op">{l.op}</span>
                  {l.text}
                </div>
              ))}
            </div>
          </div>
        </div>
      );

    case 'status':
      return (
        <div className="chat-row chat-row-assistant">
          <span className={'chat-badge chat-badge-' + entry.kind}>
            {STATUS_ICON[entry.kind]} {entry.text}
          </span>
        </div>
      );

    default:
      return null;
  }
}
