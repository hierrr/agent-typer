/**
 * Esc 오버레이 메뉴 — 테마 전환 / 화면 모드(v0.1.18: 기기 설정·라이트·다크) /
 * 워크플로우 종료(→ 보고서) / 다른 업무 시작.
 * 언어 필터 설정은 없다(v0.1.2/v0.1.3: 언어 구분은 탭/제목만으로 하고 필터 기능 자체를 제거).
 * 테마와 무관한 공용 컴포넌트라서 어떤 스킨 위에 떠도 자연스러운 중립 스타일을 쓴다.
 */

import type { ThemeId } from '../engine/types';
import type { ThemeDefinition } from '../themes/theme-api';
import type { ColorMode } from './color-mode';
import './overlay.css';

const COLOR_MODE_OPTIONS: { value: ColorMode; label: string }[] = [
  { value: 'system', label: '기기 설정' },
  { value: 'light', label: '라이트' },
  { value: 'dark', label: '다크' },
];

export interface MenuOverlayProps {
  themes: ThemeDefinition[];
  currentThemeId: ThemeId;
  onSelectTheme: (id: ThemeId) => void;
  colorMode: ColorMode;
  onSelectColorMode: (mode: ColorMode) => void;
  onEndWorkflow: () => void;
  onSwitchWork: () => void;
  onClose: () => void;
}

export function MenuOverlay({
  themes,
  currentThemeId,
  onSelectTheme,
  colorMode,
  onSelectColorMode,
  onEndWorkflow,
  onSwitchWork,
  onClose,
}: MenuOverlayProps) {
  return (
    <div className="at-scrim" onClick={onClose}>
      <div className="at-panel" role="dialog" aria-label="메뉴" onClick={(e) => e.stopPropagation()}>
        <p className="at-eyebrow">Esc 메뉴</p>
        <h1>잠깐 딴짓</h1>
        <p className="at-panel-sub">일하는 척은 여기서도 계속됩니다. Esc를 다시 누르면 닫혀요.</p>

        <div className="at-menu-section">
          <p className="at-menu-label">테마 전환</p>
          <div className="at-theme-list">
            {themes.map((t) => (
              <button
                key={t.id}
                type="button"
                className="at-btn"
                data-active={t.id === currentThemeId}
                onClick={() => onSelectTheme(t.id)}
              >
                <span>{t.label}</span>
                {t.status === 'coming-soon' && <span className="at-btn-tag">(준비 중)</span>}
              </button>
            ))}
          </div>
        </div>

        {/* 화면 모드는 선택해도 메뉴를 닫지 않는다 — 배경(테마 화면)이 바로 바뀌는 것을
            보면서 비교·선택할 수 있게(테마 전환의 즉시 닫힘과 의도적으로 다른 동작). */}
        <div className="at-menu-section">
          <p className="at-menu-label">화면 모드</p>
          <div className="at-actions">
            {COLOR_MODE_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                className="at-btn"
                data-active={o.value === colorMode}
                onClick={() => onSelectColorMode(o.value)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div className="at-menu-section">
          <p className="at-menu-label">업무</p>
          <div className="at-actions">
            <button type="button" className="at-btn" onClick={onEndWorkflow}>
              업무 종료 → 보고서
            </button>
            <button type="button" className="at-btn" onClick={onSwitchWork}>
              다른 업무 시작
            </button>
          </div>
        </div>

        <div className="at-menu-section">
          <button type="button" className="at-btn at-btn-primary" onClick={onClose}>
            계속 일하기
          </button>
        </div>
      </div>
    </div>
  );
}
