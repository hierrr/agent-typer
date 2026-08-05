/**
 * v0.1.18: 라이트/다크 모드 상태 관리 — Esc 메뉴에서 system/light/dark 3값을 고르고
 * (기본 system = 기기 설정), 해석된 결과(light|dark)만 <html data-color-mode> 속성으로
 * 내려보낸다. CSS는 이 속성 하나만 보고 테마별 변수 팔레트를 교체한다(각 테마 css 말미의
 * override 블록). system일 때는 기기 설정 변화(matchMedia change)도 실시간 반영한다.
 *
 * index.html의 선주입 스크립트가 같은 저장 키·해석 규칙으로 첫 페인트 전에 속성을 미리
 * 세팅하므로(FOUC 방지), 키나 해석 규칙을 바꿀 땐 그쪽도 반드시 함께 바꿔야 한다.
 */

import { useEffect, useState } from 'react';

export type ColorMode = 'system' | 'light' | 'dark';
type Scheme = 'light' | 'dark';

const STORAGE_KEY = 'agenttyper.color-mode';

/** 해석된 모드별 브라우저 크롬 색(<meta name="theme-color">) — 기본 테마(터미널)의 --term-bg와 일치. */
const THEME_COLOR: Record<Scheme, string> = { dark: '#0b0c0f', light: '#f9f9f7' };

function loadMode(): ColorMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    // 프라이빗 모드 등 저장소 접근 불가 — 기본값으로
  }
  return 'system';
}

function resolveScheme(mode: ColorMode): Scheme {
  if (mode === 'light' || mode === 'dark') return mode;
  // matchMedia 미지원 환경은 기존 모습(다크)을 유지한다.
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function applyScheme(scheme: Scheme): void {
  document.documentElement.setAttribute('data-color-mode', scheme);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[scheme]);
}

/** App 루트에서 1회 사용 — [설정값, 설정 함수]. 설정은 localStorage에 저장되고 즉시 적용된다. */
export function useColorMode(): [ColorMode, (mode: ColorMode) => void] {
  const [mode, setMode] = useState<ColorMode>(loadMode);

  useEffect(() => {
    applyScheme(resolveScheme(mode));
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // 저장 실패는 무시 — 세션 내 적용은 유지된다.
    }
    if (mode !== 'system') return;
    const mq = window.matchMedia?.('(prefers-color-scheme: light)');
    if (!mq) return;
    const onChange = () => applyScheme(resolveScheme('system'));
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [mode]);

  return [mode, setMode];
}
