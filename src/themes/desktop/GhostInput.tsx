/**
 * 목표 프롬프트를 desktop 중앙 입력창의 고스트 텍스트로 렌더링한다 -- 위장의 핵심.
 * terminal의 GhostPrompt와 동일한 v0.1.1 렌더 규칙(스펙 §3): correct/untyped는 목표
 * 글자를 그대로 보여주지만, wrong/pending은 "사용자가 실제 입력한 글자"를 보여준다
 * (목표 글자가 아니라!) -- 틀리면 은은한 붉은 밑줄, 조합 중(pending)은 중립 스타일.
 * v0.1.3 §3 문장 끝 스페이스 관용: overflow(목표 길이 초과 입력) 중 스페이스는 오타가
 * 아니므로 빨간 취소선이 아니라 중립 스타일로 그린다(그 외 overflow 문자는 기존대로 빨강).
 *
 * v0.1.7 §1 캐럿: 웹 텍스트 입력 관례 -- 얇은 세로바(|)를 글자 사이에 그린다. caret은
 * overflow 중엔 항상 target.length로 캡핑되어 있으므로(엔진 쪽 계약), target을 아직
 * 다 채우지 않은 경우에만 caret 위치 글자 앞에 놓고, 그 외(정확히 다 채움/overflow)엔
 * 입력 맨 끝(=overflow 꼬리 뒤)에 그린다. key를 typing.value로 걸어 매 키 입력마다
 * 다시 마운트시켜 blink 애니메이션을 처음(=solid)부터 재생시킨다 -- "키 입력 직후 잠깐
 * 고정 후 블링크 재개" nice-to-have를 값싸게 구현하는 트릭.
 */

import type { CharState, TypingView } from '../theme-api';

export interface DeskGhostInputProps {
  typing: TypingView;
  target: string;
}

function displayChar(state: CharState, targetCh: string, typedCh: string | undefined): string {
  if (state === 'wrong' || state === 'pending') return typedCh ?? targetCh;
  return targetCh;
}

export function DeskGhostInput({ typing, target }: DeskGhostInputProps) {
  const chars = target.split('');
  const overflowing = typing.value.length > target.length;
  const overflow = overflowing ? typing.value.slice(target.length) : '';
  const caretInTarget = !overflowing && typing.caret < chars.length;
  const caretAtTail = overflowing || typing.caret >= chars.length;

  return (
    <div className="desk-ghost" aria-hidden="true">
      {chars.map((ch, i) => {
        const state = typing.charStates[i];
        return (
          <span key={i} className={'desk-ch desk-ch-' + state}>
            {caretInTarget && typing.caret === i ? <span key={'caret-' + typing.value} className="desk-caret" /> : null}
            {displayChar(state, ch, typing.value[i])}
          </span>
        );
      })}
      {overflow.split('').map((ch, i) => (
        <span
          key={'overflow-' + i}
          className={'desk-ch ' + (ch === ' ' ? 'desk-ch-overflow-space' : 'desk-ch-overflow')}
        >
          {ch}
        </span>
      ))}
      {caretAtTail ? <span key={'caret-' + typing.value} className="desk-caret" /> : null}
    </div>
  );
}
