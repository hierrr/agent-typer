# AgentTyper

> 옆에서 보면 AI 에이전트에게 일을 시키는 중. 사실은 타자연습 중.

AI 시대 개발자의 핵심 역량(?)인 프롬프트 타이핑을 단련하는 위장형 타자연습 웹앱.
HackerTyper의 정신적 후속작 — 다만 이쪽은 진짜로 실력이 는다.

**바로 플레이**: https://hierrr.github.io/agent-typer/

## 실행 (로컬)

```bash
npm install
npm run dev    # http://localhost:5173
npm run build  # 프로덕션 빌드 확인
```

## 구조

```
src/
  engine/   타이핑 판정(judge)·응답 재생·통계·과장 변환 (types.ts가 데이터 계약)
  data/     워크플로우 팩 (packs/*.ts 를 glob 로드, 언어 인터리브 정렬)
  themes/   terminal(CLI) / chat(웹챗) / desktop(데스크탑 앱) 스킨
  ui/       테마 공용 컴포넌트 (세션 보고서 등)
```

## 라이선스

[MIT](LICENSE)
