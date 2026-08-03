/**
 * 목표 프롬프트를 입력 라인의 고스트 텍스트로 렌더링한다 -- 위장의 핵심.
 * v0.1.1 고스트 렌더 규칙(스펙 §3): correct/untyped는 목표 글자를 그대로 보여주지만,
 * wrong/pending은 "사용자가 실제 입력한 글자"를 보여준다(목표 글자가 아니라!) --
 * 틀리면 은은한 붉은 밑줄, 조합 중(pending)은 중립 스타일. 공백도 각 문자와 동일하게
 * 한 칸씩 렌더링되므로 CSS에서 white-space: pre로 보존한다.
 * v0.1.3 §3 문장 끝 스페이스 관용: overflow(목표 길이 초과 입력) 중 스페이스는 오타가
 * 아니므로 빨간 취소선이 아니라 중립 스타일로 그린다(그 외 overflow 문자는 기존대로 빨강).
 *
 * v0.1.7 §1 캐럿: 모노스페이스 CLI 관례 -- 언더바(_)가 "다음에 칠 글자" 아래에 깔린다.
 * target을 다 채우기 전(overflow 아님, caret < target.length)에는 caret 위치의 글자
 * 셀 안에 절대배치 밑줄로 그리고(글자는 항상 untyped 상태), 더 이상 밑줄 그을 다음
 * 글자가 없는 경우(target 정확히 다 채웠거나 overflow 중)엔 입력 맨 끝에 독립된 밑줄
 * 토막을 하나 더 그린다. 두 경우 모두 key를 typing.value로 걸어 매 키 입력마다
 * 요소를 다시 마운트시켜 blink 애니메이션을 처음(=solid)부터 재생시킨다 -- "키 입력
 * 직후 잠깐 고정 후 블링크 재개" nice-to-have를 값싸게 구현하는 트릭.
 */

import type { CharState, TypingView } from '../theme-api';

export interface GhostPromptProps {
  typing: TypingView;
  target: string;
}

function displayChar(state: CharState, targetCh: string, typedCh: string | undefined): string {
  if (state === 'wrong' || state === 'pending') return typedCh ?? targetCh;
  return targetCh;
}

export function GhostPrompt({ typing, target }: GhostPromptProps) {
  const chars = target.split('');
  const overflowing = typing.value.length > target.length;
  const overflow = overflowing ? typing.value.slice(target.length) : '';
  // caret은 overflow 중엔 항상 target.length로 캡핑되어 있으므로(엔진 쪽 계약), 다음에
  // 칠 target 글자가 남아있는 경우에만 글자 밑에 깔고, 그 외(정확히 다 채움/overflow)엔
  // 입력 맨 끝(=overflow 꼬리 뒤)에 독립 토막을 그린다.
  const caretInTarget = !overflowing && typing.caret < chars.length;
  const caretAtTail = overflowing || typing.caret >= chars.length;

  return (
    <div className="term-line term-input-line">
      <span className="term-prompt-glyph">{'>'}</span>{' '}
      <span className="term-ghost" aria-hidden="true">
        {chars.map((ch, i) => {
          const state = typing.charStates[i];
          return (
            <span key={i} className={'term-ch term-ch-' + state}>
              {caretInTarget && typing.caret === i ? (
                <span key={'caret-' + typing.value} className="term-caret-underscore" />
              ) : null}
              {displayChar(state, ch, typing.value[i])}
            </span>
          );
        })}
        {overflow.split('').map((ch, i) => (
          <span
            key={'overflow-' + i}
            className={'term-ch ' + (ch === ' ' ? 'term-ch-overflow-space' : 'term-ch-overflow')}
          >
            {ch}
          </span>
        ))}
        {caretAtTail ? <span key={'caret-' + typing.value} className="term-caret-underscore-tail" /> : null}
      </span>
    </div>
  );
}
