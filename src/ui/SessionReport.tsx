/**
 * 과장 보고서 화면 — 워크플로우 완료(또는 조기 종료) 시 표시.
 * v0.1.4 §1: 위장 모드와 진짜 지표 모드는 완전히 동일한 레이아웃/컴포넌트 구조를 쓴다 --
 * 토글은 오직 각 슬롯의 텍스트/숫자만 바꾼다(헤드라인, 각 지표 행의 라벨·값·서브캡션,
 * 오타 상세 목록의 각 행). 한쪽 모드에만 있는 섹션/패널은 없다 -- engine/exaggerate.ts의
 * generateReport()가 이미 두 모드분 텍스트를 전부 계산해서 Report로 내려준다.
 * "보고서 복사", "계속 일하기"(다음 워크플로우로 자동 진행), "다른 업무 시작"(현재와 다른
 * 워크플로우로 즉시 전환)은 토글과 무관한 고정 UI 컨트롤.
 * Esc는 App이 전역으로 처리해 이 화면을 즉시 닫고 typing 화면으로 복귀시킨다(위장 유지).
 */

import { useState } from 'react';
import type { Report } from '../engine/exaggerate';
import './overlay.css';

export interface SessionReportProps {
  report: Report;
  onContinue: () => void;
  onSwitchWork: () => void;
  onClose: () => void;
}

/** 오타 상세 섹션(펼친 뒤)의 표시 상한 — 동일 (기대,입력) 합산 후 행 수 기준(v0.1.15 §1). */
const MISTAKE_PREVIEW_LIMIT = 12;

function formatReportText(report: Report, showReal: boolean): string {
  const headline = showReal ? report.realHeadline : report.disguiseHeadline;
  const rows = report.metrics.map((m) => {
    const label = showReal ? m.realLabel : m.disguiseLabel;
    const value = showReal ? m.realValue : m.disguiseValue;
    const caption = showReal ? m.realCaption : m.disguiseCaption;
    return `${m.icon} ${label}: ${value} (${caption})`;
  });
  return [headline, '', ...rows, '', '-- AgentTyper'].join('\n');
}

export function SessionReport({ report, onContinue, onSwitchWork, onClose }: SessionReportProps) {
  const [showReal, setShowReal] = useState(false);
  const [copied, setCopied] = useState(false);
  // v0.1.15 §1: 오타 상세 섹션은 기본 접힘 -- 이 토글이 이제 "12행까지 보여줄지"가 아니라
  // "목록 자체를 보여줄지"를 결정한다(펼치면 상한 12행까지, 별도의 "더 보기" 단계는 없음).
  const [mistakesOpen, setMistakesOpen] = useState(false);

  const handleCopy = () => {
    const text = formatReportText(report, showReal);
    if (navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(text)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        })
        .catch(() => {
          /* 클립보드 권한이 없는 환경 — 조용히 무시 */
        });
    }
  };

  const visibleMistakeRows = report.mistakeRows.slice(0, MISTAKE_PREVIEW_LIMIT);

  return (
    <div className="at-scrim" onClick={onClose}>
      <div className="at-panel" role="dialog" aria-label="세션 리포트" onClick={(e) => e.stopPropagation()}>
        <p className="at-eyebrow">업무 리포트</p>
        <h1 className="at-report-headline">{showReal ? report.realHeadline : report.disguiseHeadline}</h1>

        <div className="at-toggle-row">
          <button type="button" className="at-btn" onClick={() => setShowReal((v) => !v)}>
            {showReal ? '위장 모드로' : '진짜 지표 보기'}
          </button>
          <span>
            <button type="button" className="at-btn" onClick={handleCopy}>
              보고서 복사
            </button>
            {copied && <span className="at-copy-feedback">복사됨</span>}
          </span>
        </div>

        <div className="at-brag-lines">
          {report.metrics.map((m, i) => (
            <div className="at-brag-line" key={i}>
              <span className="at-brag-icon">{m.icon}</span>
              <div className="at-brag-main">
                <div className="at-brag-top">
                  <span className="at-brag-label">{showReal ? m.realLabel : m.disguiseLabel}</span>
                  <span className="at-brag-value">{showReal ? m.realValue : m.disguiseValue}</span>
                </div>
                <div className="at-brag-caption">{showReal ? m.realCaption : m.disguiseCaption}</div>
              </div>
            </div>
          ))}
        </div>

        {report.mistakeRows.length > 0 && (
          <div className="at-mistakes">
            <button
              type="button"
              className="at-mistakes-header"
              onClick={() => setMistakesOpen((v) => !v)}
              aria-expanded={mistakesOpen}
            >
              <span className="at-mistakes-label">
                {showReal ? '오타 상세 (기대 → 입력)' : '반영한 리뷰 코멘트'} · {report.mistakeCount}건
              </span>
              <span className="at-mistakes-caret">{mistakesOpen ? '▾' : '▸'}</span>
            </button>
            {mistakesOpen && (
              <ul className="at-mistakes-list">
                {visibleMistakeRows.map((row, i) => (
                  <li key={i} className="at-mistakes-item">
                    {showReal ? row.realText : row.disguiseText}
                    {row.count >= 2 && <span className="at-mistakes-count">{`×${row.count}`}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="at-actions">
          <button type="button" className="at-btn at-btn-primary" onClick={onContinue}>
            계속 일하기
          </button>
          <button type="button" className="at-btn" onClick={onSwitchWork}>
            다른 업무 시작
          </button>
        </div>
      </div>
    </div>
  );
}
