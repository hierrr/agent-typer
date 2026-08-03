/**
 * 헤더 아래 워크플로우 탭바(tmux/iTerm 풍) — 전체 워크플로우 목록(언어 필터 없음, 순서는
 * data/index.ts의 언어/카테고리 인터리브를 그대로 따름)을 가로 스크롤 탭으로 그린다.
 * 활성 워크플로우가 강조되고, 탭 클릭은 즉시 그 워크플로우를 새로 시작한다(진행 중이던
 * 것은 확인창 없이 버려짐 — App.tsx의 onSelectWorkflow 참고).
 * v0.1.2 §2: 진행 분수 노출 금지 규칙에 따라 스텝 수 등 숫자 배지는 붙이지 않는다 --
 * 제목만 보여준다.
 */

import type { WorkflowMeta } from '../theme-api';

export interface WorkflowTabsProps {
  workflows: WorkflowMeta[];
  activeId: string;
  onSelect: (id: string) => void;
}

export function WorkflowTabs({ workflows, activeId, onSelect }: WorkflowTabsProps) {
  if (workflows.length === 0) return null;

  return (
    <div className="term-tabbar" role="tablist" aria-label="워크플로우 목록">
      {workflows.map((w) => (
        <button
          key={w.id}
          type="button"
          role="tab"
          aria-selected={w.id === activeId}
          data-active={w.id === activeId}
          className="term-tab"
          title={w.description}
          onClick={() => onSelect(w.id)}
        >
          <span className="term-tab-title">{w.title}</span>
        </button>
      ))}
    </div>
  );
}
