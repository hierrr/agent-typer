/**
 * 우측 "산출물" 패널 — 이 세션에서 재생된 diff 이벤트를 파일별로 집계해
 * 카드로 쌓아 보여준다. log는 라운드가 끝나도 유지되는 누적 스크롤백이므로
 * (player.ts 참고) 여기서 매 렌더 다시 집계하는 것만으로 "라운드가 지날수록
 * 파일이 쌓이는" 연출이 자연히 성립한다 — 이 패널 자체는 상태를 갖지 않는다.
 */

import { useMemo } from 'react';
import type { LogEntry } from '../theme-api';

interface FileSummary {
  file: string;
  adds: number;
  dels: number;
  touches: number;
}

const EXT_COLORS: Record<string, string> = {
  ts: '#3b82f6',
  tsx: '#3b82f6',
  js: '#eab308',
  jsx: '#eab308',
  json: '#8a8f99',
  md: '#8b5cf6',
  txt: '#8a8f99',
  sql: '#f97316',
  yml: '#10b981',
  yaml: '#10b981',
  css: '#ec4899',
};

function extOf(file: string): string {
  const idx = file.lastIndexOf('.');
  return idx === -1 ? '' : file.slice(idx + 1).toLowerCase();
}

function summarize(log: LogEntry[]): FileSummary[] {
  const byFile = new Map<string, FileSummary>();
  for (const entry of log) {
    if (entry.type !== 'diff') continue;
    const prev = byFile.get(entry.file) ?? { file: entry.file, adds: 0, dels: 0, touches: 0 };
    for (const l of entry.lines) {
      if (l.op === '+') prev.adds += 1;
      else if (l.op === '-') prev.dels += 1;
    }
    prev.touches += 1;
    byFile.set(entry.file, prev);
  }
  return Array.from(byFile.values());
}

export function ArtifactsPanel({ log }: { log: LogEntry[] }) {
  const files = useMemo(() => summarize(log), [log]);

  return (
    <aside className="desk-artifacts">
      <div className="desk-artifacts-head">
        <span>산출물</span>
        <span className="desk-artifacts-count">{files.length}</span>
      </div>
      <div className="desk-artifacts-list">
        {files.length === 0 && <p className="desk-artifacts-empty">아직 수정된 파일이 없습니다.</p>}
        {files.map((f) => {
          const ext = extOf(f.file);
          const color = EXT_COLORS[ext] ?? '#8a8f99';
          const badgeText = (ext || '·').slice(0, 3).toUpperCase();
          return (
            <div className="desk-file-card" key={f.file}>
              <span className="desk-file-badge" style={{ background: color }}>
                {badgeText}
              </span>
              <span className="desk-file-info">
                <span className="desk-file-name" title={f.file}>
                  {f.file}
                </span>
                <span className="desk-file-stat">
                  <span className="desk-file-add">+{f.adds}</span> <span className="desk-file-del">-{f.dels}</span>
                  {f.touches > 1 && <span className="desk-file-touches"> · {f.touches}회 수정</span>}
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
