/**
 * 누적 로그(log: LogEntry[]) 한 항목을 터미널 문법으로 렌더링.
 * thinking은 진행 중일 때 스피너+동사 로테이션, 끝나면 정적 기록으로 정착한다.
 * prompt 에코는 entry.marks(스펙 v0.1.14 §1)를 글자별로 훑어 wrong/overflow 위치에
 * GhostPrompt와 같은 term-ch-wrong/term-ch-overflow 클래스를 재사용한다 -- 입력 중 고스트와
 * 동일한 은은한 붉은 밑줄 스타일이라 별도 CSS가 필요 없고, 로그 엔트리에 저장되므로 다음
 * 스텝으로 넘어가 스크롤백에 남아 있는 동안은 계속 같은 마크가 보인다.
 */

import { useEffect, useState } from 'react';
import type { LogEntry } from '../theme-api';

const VERBS = ['Pondering', 'Vibing', 'Refactoring', 'Percolating', 'Untangling', 'Reticulating', 'Bikeshedding', 'Yak-shaving'];

function ThinkingSpinner() {
  const [i, setI] = useState(() => Math.floor(Math.random() * VERBS.length));
  useEffect(() => {
    const id = setInterval(() => setI((v) => (v + 1) % VERBS.length), 650);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="term-spinner">
      <span className="term-spinner-glyph" />
      <span className="term-spinner-verb">{VERBS[i]}...</span>
    </span>
  );
}

const STATUS_ICON: Record<string, string> = { success: '✓', warn: '!', error: '✕' };

export function LogLine({ entry }: { entry: LogEntry }) {
  switch (entry.type) {
    case 'prompt':
      return (
        <div className="term-line term-line-prompt">
          <span className="term-prompt-glyph">{'>'}</span>{' '}
          {entry.text.split('').map((ch, i) => {
            const mark = entry.marks[i];
            if (!mark) return <span key={i}>{ch}</span>;
            const cls = mark.kind === 'wrong' ? 'term-ch-wrong' : 'term-ch-overflow';
            return (
              <span key={i} className={cls} title={mark.kind === 'wrong' ? `기대: ${mark.expected}` : undefined}>
                {ch}
              </span>
            );
          })}
        </div>
      );

    case 'thinking':
      return (
        <div className="term-line term-line-thinking">
          {entry.done ? <span className="term-line-thinking-done">{'✣ ' + entry.text}</span> : <ThinkingSpinner />}
        </div>
      );

    case 'tool':
      return (
        <div className="term-line term-line-tool">
          <div className="term-tool-call">
            <span className="term-tool-glyph">{'⏺'}</span> {entry.name}({entry.input})
          </div>
          <div className="term-tool-output">
            <span className="term-tool-glyph">{'⎿'}</span>{' '}
            {entry.phase === 'done' ? entry.output : <span className="term-tool-running">running...</span>}
          </div>
        </div>
      );

    case 'diff':
      return (
        <div className="term-line term-line-diff">
          <div className="term-tool-call">
            <span className="term-tool-glyph">{'⏺'}</span> Update({entry.file})
          </div>
          <div className="term-diff-body">
            {entry.lines.map((l, i) => (
              <div
                key={i}
                className={'term-diff-line term-diff-' + (l.op === '+' ? 'add' : l.op === '-' ? 'del' : 'ctx')}
              >
                <span className="term-diff-op">{l.op}</span>
                {l.text}
              </div>
            ))}
          </div>
        </div>
      );

    case 'status':
      return (
        <div className={'term-line term-line-status term-status-' + entry.kind}>
          <span className="term-status-icon">{STATUS_ICON[entry.kind]}</span> {entry.text}
        </div>
      );

    case 'text':
      return (
        <div className="term-line term-line-text">
          {entry.visible}
          {!entry.done && <span className="term-text-caret" />}
        </div>
      );

    default:
      return null;
  }
}
