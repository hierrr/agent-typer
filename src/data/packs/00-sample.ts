/**
 * 샘플 워크플로우 팩 - 콘텐츠 팩(20-*.ts)이 하나도 없어도 앱이 완전히 동작하도록
 * 보장하는 최소 세트. ko dev 워크플로우 1개 + en incident 워크플로우 1개, 각 10스텝.
 * 첫 스텝의 prompt가 상황 설명을 겸하고(브리핑 대체), 각 스텝 response의 끝맺음이
 * 다음 스텝 prompt를 자연스럽게 유도한다(마지막 스텝만 예외, 질문 없이 마무리로 닫음).
 * 6가지 ResponseEvent 타입(thinking/text/tool/diff/status/pause)과 showIf 분기,
 * {loc}/{files}/{commits}/{errors} 플레이스홀더, diff/status의 durationMs 생략
 * (기본값 사용) 사례를 전부 담아 다른 에이전트가 콘텐츠 팩(20-*.ts)을 작성할 때
 * 참고할 수 있게 한다. v0.1.6 §1: {spm}/{cpm}/{wpm}/{accuracy}는 응답 텍스트에서
 * 금지(세션 보고서 전용)라 이 팩에서도 쓰지 않는다.
 *
 * v0.1.3 §1 프롬프트 언어 순수성: ko 워크플로우의 title/description/모든 step.prompt는
 * 라틴 문자 없이 한글만 쓴다(기술 용어는 캐시처럼 한글 음차). en 워크플로우는 한글 없이
 * ASCII만 쓴다. response 이벤트 텍스트(코드/명령어 등)는 표시 전용이라 규칙에서 자유롭다.
 * 소재는 20-*.ts 팩(결제 모듈 리팩토링, 레디스 타임아웃 장애, Checkout Outage 등)과
 * 겹치지 않도록 검색 자동완성 성능 / 알림 큐 백로그로 잡았다.
 *
 * v0.1.5 §1: 업무 1건이 스텝 3개로는 너무 짧다는 피드백에 따라 10스텝으로 확장(파악 →
 * 진단/설계 → 수정 → 테스트 → 셀프 리뷰 → 동료 리뷰 → 피드백 반영 → 배포 → 모니터링 →
 * 문서화/포스트모템의 실제 업무 리듬).
 */

import type { Workflow } from '../../engine/types';

const searchAutocompleteLatency: Workflow = {
  id: 'dev-ko-search-autocomplete-latency',
  title: '검색 자동완성 지연시간 개선',
  description: '느려진 검색 자동완성 원인을 찾아 캐싱을 붙이고 배포까지 확인하는 세션',
  lang: 'ko',
  category: 'dev',
  tags: ['성능', '검색', '캐싱'],
  steps: [
    {
      id: 'profile-latency',
      prompt: '검색창에 두 글자만 쳐도 자동완성이 1초 넘게 걸린다는 불만이 계속 올라와서 원인부터 찾아야 해, 어디서 느려지는지 봐줘',
      difficulty: 2,
      response: [
        { type: 'thinking', text: '자동완성 응답 경로를 따라가는 중...', durationMs: 800 },
        { type: 'tool', name: 'Read', input: 'src/search/autocomplete.ts', output: '매 요청마다 전체 인덱스를 훑음, 캐시 없음', durationMs: 700 },
        { type: 'thinking', text: '어디에 캐시를 붙일지 고민하는 중...', durationMs: 600 },
        {
          type: 'text',
          text: '자주 나오는 검색어 상위 몇 개가 전체 트래픽의 절반이네요. 여기부터 캐시를 붙여볼까요?',
          cps: 30,
        },
      ],
    },
    {
      id: 'check-cache-invalidation-plan',
      prompt: '그래, 붙이기 전에 캐시 무효화 전략부터 정하자, 인덱스가 갱신되면 캐시를 언제 지울지 설계해줘',
      difficulty: 3,
      response: [
        { type: 'thinking', text: '캐시가 오래된 결과를 돌려주면 더 큰 문제가 된다는 걸 되새기는 중...', durationMs: 800 },
        { type: 'tool', name: 'Read', input: 'src/search/indexer.ts', output: '인덱스 갱신은 5분마다 배치로 실행됨', durationMs: 700 },
        { type: 'pause', durationMs: 400 },
        { type: 'thinking', text: '무효화 시점을 인덱스 갱신 주기에 맞추는 중...', durationMs: 600 },
        {
          type: 'text',
          text: '인덱스 갱신 직후 관련 캐시만 지우는 방식으로 설계했습니다, 설계 문서만 {loc}자 분량이네요. 이제 진짜 캐시를 붙여볼까요?',
          cps: 30,
        },
      ],
    },
    {
      id: 'add-cache',
      prompt: '그래, 일단 제일 자주 나오는 검색어부터 캐시를 붙이고 성능도 같이 재봐줘',
      difficulty: 3,
      response: [
        { type: 'thinking', text: '방금 정한 무효화 조건을 코드에 반영하는 중...', durationMs: 800 },
        {
          type: 'diff',
          file: 'src/search/autocomplete.ts',
          lines: [
            { op: ' ', text: 'function suggest(query) {' },
            { op: '-', text: '  return index.scanAll(query);' },
            { op: '+', text: '  return cache.get(query) ?? index.scanAll(query);' },
            { op: ' ', text: '}' },
          ],
          // durationMs 생략 -- 플레이어 기본 홀드(DIFF_HOLD_MS) 사용 사례
        },
        { type: 'pause', durationMs: 300 },
        { type: 'tool', name: 'Bash', input: 'npm run bench -- autocomplete', output: '평균 응답 42ms (기존 1120ms)', durationMs: 1200, showIf: 'clean' },
        {
          type: 'tool',
          name: 'Bash',
          input: 'npm run bench -- autocomplete',
          output: '평균 응답 380ms, 벤치마크 스크립트 오타 {errors}곳 고치고 재측정',
          durationMs: 1400,
          showIf: 'sloppy',
        },
        {
          type: 'status',
          kind: 'success',
          text: '체감 속도가 확 달라졌습니다. 캐시 히트/미스 케이스에 대한 테스트도 추가해볼까요?',
          showIf: 'clean',
          // durationMs 생략 -- 기본 홀드(STATUS_HOLD_MS) 사용 사례
        },
        {
          type: 'status',
          kind: 'warn',
          text: '벤치마크 스크립트 오타 {errors}개 고치고 나서야 제대로 돌았습니다. 캐시 히트/미스 케이스에 대한 테스트도 추가해볼까요?',
          showIf: 'sloppy',
        },
      ],
    },
    {
      id: 'add-cache-tests',
      prompt: '좋아, 캐시 히트랑 미스 두 가지 케이스 전부에 대해서 꼼꼼히 테스트를 추가해줘',
      difficulty: 2,
      response: [
        { type: 'thinking', text: '캐시가 비어있을 때랑 차있을 때를 각각 상상하는 중...', durationMs: 700 },
        {
          type: 'diff',
          file: 'src/search/autocomplete.test.ts',
          lines: [
            { op: '+', text: "test('캐시 미스 시 인덱스를 훑는다', () => {" },
            { op: '+', text: "  expect(suggest('te')).toEqual(index.scanAll('te'));" },
            { op: '+', text: '});' },
            { op: '+', text: "test('캐시 히트 시 인덱스를 건너뛴다', () => {" },
            { op: '+', text: "  cache.set('te', ['test']);" },
            { op: '+', text: "  expect(suggest('te')).toEqual(['test']);" },
            { op: '+', text: '});' },
          ],
          durationMs: 600,
        },
        { type: 'tool', name: 'Bash', input: '테스트 실행', output: '8 passed, 0 failed', durationMs: 900, showIf: 'clean' },
        {
          type: 'tool',
          name: 'Bash',
          input: '테스트 실행',
          output: '6 passed, {errors} failed, 히트 케이스 오타 수정 후 통과',
          durationMs: 1100,
          showIf: 'sloppy',
        },
        {
          type: 'status',
          kind: 'success',
          text: '테스트 {files}개 추가 완료, 전부 통과합니다. 변경 내역을 한 번 더 훑어볼까요?',
          showIf: 'clean',
        },
        {
          type: 'status',
          kind: 'warn',
          text: '테스트 코드 오타 {errors}개 고치고 나서 통과시켰습니다. 그래도 변경 내역을 한 번 더 훑어볼까요?',
          showIf: 'sloppy',
        },
      ],
    },
    {
      id: 'self-review-diff',
      prompt: '그래, 커밋 전에 변경 내역부터 처음부터 끝까지 한 번 더 깔끔하게 정리해서 훑어봐줘',
      difficulty: 1,
      response: [
        { type: 'thinking', text: '지운 코드가 없는지 한 번 더 확인하는 중...', durationMs: 600 },
        { type: 'tool', name: 'Bash', input: '변경사항 확인', output: '수정 파일 2개, 추가 1개, 삭제 0개', durationMs: 700 },
        { type: 'pause', durationMs: 300 },
        { type: 'tool', name: 'Bash', input: '커밋 메시지 초안 작성', output: 'feat: 자동완성 캐시 레이어 추가', durationMs: 500 },
        {
          type: 'text',
          text: '깔끔하게 정리됐습니다, 총 {loc}자 분량 변경이네요. 커밋 전에 동료한테 짧게 리뷰 한번 부탁해볼까요?',
          cps: 30,
        },
      ],
    },
    {
      id: 'teammate-review',
      prompt: '그래, 옆자리 동료한테 지금 바로 리뷰 요청 보내고 코멘트 달리면 바로 알려줘',
      difficulty: 1,
      response: [
        { type: 'thinking', text: '리뷰 요청 메시지 톤을 가볍게 다듬는 중...', durationMs: 500 },
        { type: 'tool', name: 'Review', input: '캐싱 변경사항 리뷰 요청', output: '요청 전송 완료', durationMs: 600 },
        { type: 'pause', durationMs: 900 },
        {
          type: 'tool',
          name: 'Review',
          input: '리뷰 코멘트 확인',
          output: '캐시 최대 크기를 제한하라는 코멘트 1건 도착',
          durationMs: 700,
          showIf: 'clean',
        },
        {
          type: 'tool',
          name: 'Review',
          input: '리뷰 코멘트 확인',
          output: '리뷰 코멘트에 오탈자 {errors}개 있었지만 캐시 크기 제한 요청 1건 확인',
          durationMs: 900,
          showIf: 'sloppy',
        },
        {
          type: 'status',
          kind: 'success',
          text: '코멘트 확인했습니다. 캐시 최대 크기 제한하라는 피드백이네요, 반영할까요?',
          showIf: 'clean',
        },
        {
          type: 'status',
          kind: 'warn',
          text: '확인이 좀 늦었지만 캐시 최대 크기 제한하라는 피드백 받았습니다. 반영할까요?',
          showIf: 'sloppy',
        },
      ],
    },
    {
      id: 'apply-review-feedback',
      prompt: '그래, 캐시 최대 크기를 천 개로 제한하고 넘치면 오래된 것부터 지우게 해줘',
      difficulty: 3,
      response: [
        { type: 'thinking', text: '가장 오래전에 쓰인 항목부터 지우는 방식을 떠올리는 중...', durationMs: 700 },
        {
          type: 'diff',
          file: 'src/search/autocomplete.ts',
          lines: [
            { op: ' ', text: 'const cache = new Map();' },
            { op: '+', text: 'const MAX_CACHE_SIZE = 1000;' },
            { op: '+', text: 'function evictOldest() {' },
            { op: '+', text: '  if (cache.size > MAX_CACHE_SIZE) cache.delete(cache.keys().next().value);' },
            { op: '+', text: '}' },
          ],
          durationMs: 650,
        },
        { type: 'tool', name: 'Bash', input: '테스트 재실행', output: '11 passed, 0 failed', durationMs: 900, showIf: 'clean' },
        {
          type: 'tool',
          name: 'Bash',
          input: '테스트 재실행',
          output: '9 passed, {errors} failed, 초과분 삭제 로직 오타 수정 후 통과',
          durationMs: 1100,
          showIf: 'sloppy',
        },
        {
          type: 'status',
          kind: 'success',
          text: '피드백 반영 완료, {commits}개 커밋으로 정리했습니다. 이제 배포하고 실제로 빨라졌는지 확인해볼까요?',
          showIf: 'clean',
        },
        {
          type: 'status',
          kind: 'warn',
          text: '초과분 삭제 로직 오타 {errors}개 고치고 나서 반영했습니다. 이제 배포하고 실제로 빨라졌는지 확인해볼까요?',
          showIf: 'sloppy',
        },
      ],
    },
    {
      id: 'ship-and-verify',
      prompt: '좋아, 이제 정말로 배포하고 실제로 빨라졌는지 실제 트래픽으로 직접 확인해줘',
      difficulty: 3,
      response: [
        { type: 'thinking', text: '배포 파이프라인을 순서대로 밟는 중...', durationMs: 700 },
        { type: 'tool', name: 'Bash', input: 'npm run deploy -- search', output: '배포 완료, 340ms', durationMs: 1200 },
        { type: 'tool', name: 'Bash', input: 'curl /api/autocomplete?q=te', output: '응답 38ms, 캐시 히트', durationMs: 900 },
        {
          type: 'status',
          kind: 'success',
          text: '배포 완료. {commits}개 커밋으로 마무리했습니다. 하루 정도 캐시 히트율을 지켜볼까요?',
          durationMs: 400,
          showIf: 'clean',
        },
        {
          type: 'status',
          kind: 'warn',
          text: '재시도 {errors}번 끝에 배포는 끝났습니다. 하루 정도 캐시 히트율을 지켜볼까요?',
          durationMs: 400,
          showIf: 'sloppy',
        },
      ],
    },
    {
      id: 'monitor-cache-hit-rate',
      prompt: '그래, 하루 정도 캐시 히트율이랑 응답속도를 계속 지켜보고 이상 없으면 알려줘',
      difficulty: 2,
      response: [
        { type: 'thinking', text: '하루치 그래프가 쌓이길 기다리는 중...', durationMs: 600 },
        {
          type: 'tool',
          name: 'Monitor',
          input: '캐시 히트율 (24시간)',
          output: '히트율 91퍼센트로 안정',
          durationMs: 1000,
          showIf: 'clean',
        },
        {
          type: 'tool',
          name: 'Monitor',
          input: '캐시 히트율 (24시간)',
          output: '히트율은 91퍼센트인데 스파이크 {errors}번 관찰됨',
          durationMs: 1200,
          showIf: 'sloppy',
        },
        { type: 'tool', name: 'Monitor', input: '평균 응답속도 (24시간)', output: '41ms로 안정적 유지', durationMs: 900 },
        { type: 'pause', durationMs: 400 },
        {
          type: 'status',
          kind: 'success',
          text: '하루 내내 안정적입니다, {files}개 지표 전부 정상 범위네요. 캐싱 전략을 문서로 정리해둘까요?',
          showIf: 'clean',
        },
        {
          type: 'status',
          kind: 'warn',
          text: '스파이크는 있었지만 크게 문제없어 보입니다. 캐싱 전략을 문서로 정리해둘까요?',
          showIf: 'sloppy',
        },
      ],
    },
    {
      id: 'document-caching-strategy',
      prompt: '좋아, 캐싱 전략을 팀 문서에 정리하고 다음에 비슷한 문제 생기면 참고할 수 있게 해줘',
      difficulty: 1,
      response: [
        { type: 'thinking', text: '다음 사람이 처음부터 다시 겪지 않게 정리하는 중...', durationMs: 700 },
        { type: 'tool', name: 'Write', input: 'docs/캐싱_전략.md', output: '문서 작성 완료', durationMs: 900 },
        {
          type: 'diff',
          file: 'docs/캐싱_전략.md',
          lines: [
            { op: '+', text: '## 검색 자동완성 캐시' },
            { op: '+', text: '- 무효화: 인덱스 갱신 직후 관련 캐시만 제거' },
            { op: '+', text: '- 크기 제한: 최대 1000개, 초과 시 가장 오래된 항목부터 제거' },
          ],
          durationMs: 500,
        },
        { type: 'pause', durationMs: 300 },
        {
          type: 'status',
          kind: 'success',
          text: '문서화까지 끝났습니다. {loc}자 분량 정리, 검색 자동완성 지연시간 개선은 여기서 마무리입니다.',
        },
      ],
    },
  ],
};

const notificationQueueBacklog: Workflow = {
  id: 'incident-en-notification-queue-backlog',
  title: 'Notification Queue Backlog',
  description: 'Diagnose a stuck push-notification queue, clear the backlog, then write the postmortem',
  lang: 'en',
  category: 'incident',
  tags: ['incident', 'queue', 'oncall'],
  steps: [
    {
      id: 'triage',
      prompt: 'push notifications have been stuck in the queue for twenty minutes, find out why workers stopped draining it',
      difficulty: 3,
      response: [
        { type: 'thinking', text: 'Watching the queue depth climb...', durationMs: 800 },
        { type: 'tool', name: 'Bash', input: 'queue-cli depth notifications', output: 'depth {loc} and rising, 0 acks in last 5 min', durationMs: 900 },
        { type: 'tool', name: 'Bash', input: 'queue-cli workers status', output: 'all 8 workers alive but idle, none acking', durationMs: 700 },
        { type: 'thinking', text: 'Checking what the workers choked on...', durationMs: 600 },
        {
          type: 'text',
          text: 'Workers are up but stuck, something in the queue is making them hang or crash on pickup. Want me to dig into which message is doing it?',
          cps: 38,
        },
      ],
    },
    {
      id: 'identify-poison-message',
      prompt: 'Yes, dig into the queue and figure out exactly which message type keeps crashing the workers',
      difficulty: 3,
      response: [
        { type: 'thinking', text: 'Replaying messages one at a time in a sandbox...', durationMs: 800 },
        { type: 'tool', name: 'Bash', input: 'queue-cli peek notifications --count 50', output: '50 messages sampled, one type stands out', durationMs: 1000 },
        {
          type: 'tool',
          name: 'Read',
          input: 'worker crash logs',
          output: 'TypeError on message.payload.recipient.id, payload missing recipient field',
          durationMs: 800,
        },
        { type: 'pause', durationMs: 400 },
        {
          type: 'status',
          kind: 'warn',
          text: "Found it -- messages of type 'digest_summary' are missing a recipient field and crash the parser. Want me to quarantine them and restart the workers?",
          showIf: 'clean',
        },
        {
          type: 'status',
          kind: 'warn',
          text: "Found it after chasing {errors} red herrings -- 'digest_summary' messages are missing a recipient field. Want me to quarantine them and restart the workers?",
          showIf: 'sloppy',
        },
      ],
    },
    {
      id: 'mitigate',
      prompt: 'yes quarantine the poison message and restart the workers to drain the backlog',
      difficulty: 4,
      response: [
        { type: 'thinking', text: 'Moving the poison message somewhere it cannot hurt anyone...', durationMs: 900 },
        {
          type: 'diff',
          file: 'config/notifications.yml',
          lines: [
            { op: ' ', text: 'consumer:' },
            { op: '-', text: '  on_error: retry' },
            { op: '+', text: '  on_error: dead_letter' },
          ],
          durationMs: 500,
        },
        { type: 'tool', name: 'Bash', input: 'kubectl rollout restart deploy/notification-workers', output: 'rollout restarted, 8 pods', durationMs: 1400 },
        { type: 'pause', durationMs: 300 },
        { type: 'tool', name: 'Bash', input: 'queue-cli depth notifications', output: 'depth 120 and falling', durationMs: 800, showIf: 'clean' },
        {
          type: 'tool',
          name: 'Bash',
          input: 'queue-cli depth notifications',
          output: 'depth 900, still draining after {errors} typo(s) in the filter',
          durationMs: 900,
          showIf: 'sloppy',
        },
        {
          type: 'status',
          kind: 'success',
          text: 'Backlog is draining. Want me to keep watching until it is fully cleared with no re-accumulation?',
          showIf: 'clean',
        },
        {
          type: 'status',
          kind: 'warn',
          text: 'Draining again after fixing {errors} typo(s) in the filter. Want me to keep watching until it is fully cleared?',
          showIf: 'sloppy',
        },
      ],
    },
    {
      id: 'verify-backlog-draining-fully',
      prompt: 'Yes, keep watching the queue until the backlog is fully cleared and confirm nothing is piling back up',
      difficulty: 2,
      response: [
        { type: 'thinking', text: 'Refreshing the dashboard more often than is healthy...', durationMs: 600 },
        { type: 'tool', name: 'Bash', input: 'queue-cli depth notifications', output: 'depth 0, queue fully drained', durationMs: 900, showIf: 'clean' },
        {
          type: 'tool',
          name: 'Bash',
          input: 'queue-cli depth notifications',
          output: 'depth 0 after {errors} more anxious refreshes',
          durationMs: 1000,
          showIf: 'sloppy',
        },
        { type: 'tool', name: 'Bash', input: 'queue-cli depth notifications --watch 300', output: 'steady at 0 for 5 minutes straight', durationMs: 1200 },
        { type: 'pause', durationMs: 400 },
        {
          type: 'status',
          kind: 'success',
          text: 'Queue is empty and staying that way, {commits} commit worth of relief. The quarantine was a patch though, want the real root cause fixed?',
        },
      ],
    },
    {
      id: 'patch-root-cause-in-code',
      prompt: 'Yes, patch the actual parser bug so it stops crashing on messages missing a recipient field',
      difficulty: 4,
      response: [
        { type: 'thinking', text: 'Adding the null check that should have been there from day one...', durationMs: 800 },
        { type: 'tool', name: 'Read', input: 'src/notifications/parser.ts', output: 'no guard around payload.recipient.id', durationMs: 700 },
        {
          type: 'diff',
          file: 'src/notifications/parser.ts',
          lines: [
            { op: '-', text: 'const recipientId = message.payload.recipient.id;' },
            { op: '+', text: 'const recipientId = message.payload.recipient?.id;' },
            { op: '+', text: 'if (!recipientId) return skip(message, "missing recipient");' },
          ],
          durationMs: 550,
        },
        { type: 'tool', name: 'Bash', input: 'npm run build', output: 'build succeeded, 0 type errors', durationMs: 1500, showIf: 'clean' },
        {
          type: 'tool',
          name: 'Bash',
          input: 'npm run build',
          output: 'build failed, {errors} type error(s) on the optional chain',
          durationMs: 1700,
          showIf: 'sloppy',
        },
        {
          type: 'status',
          kind: 'success',
          text: 'Root cause patched, {files} files touched. Should I add a regression test for this exact crash?',
          showIf: 'clean',
        },
        {
          type: 'status',
          kind: 'warn',
          text: '{errors} type error(s) fixed, patched now. Should I add a regression test for this exact crash?',
          showIf: 'sloppy',
        },
      ],
    },
    {
      id: 'add-regression-test',
      prompt: 'Yes, add a regression test that covers a message missing the recipient field',
      difficulty: 2,
      response: [
        { type: 'thinking', text: 'Recreating the exact payload shape that crashed production...', durationMs: 700 },
        {
          type: 'diff',
          file: 'src/notifications/parser.test.ts',
          lines: [
            { op: '+', text: "test('skips message when recipient is missing', () => {" },
            { op: '+', text: '  const result = parse({ payload: { recipient: null } });' },
            { op: '+', text: '  expect(result.skipped).toBe(true);' },
            { op: '+', text: '});' },
          ],
          durationMs: 500,
        },
        { type: 'tool', name: 'Bash', input: 'npm test -- parser', output: '14 passed, 0 failed', durationMs: 1000, showIf: 'clean' },
        {
          type: 'tool',
          name: 'Bash',
          input: 'npm test -- parser',
          output: '12 passed, {errors} failed, fixed the mock payload and reran',
          durationMs: 1200,
          showIf: 'sloppy',
        },
        {
          type: 'status',
          kind: 'success',
          text: '{commits} commit, test suite covers the crash now. Want a teammate to review the fix before it ships?',
          showIf: 'clean',
        },
        {
          type: 'status',
          kind: 'warn',
          text: '{errors} mock payload issue(s) fixed. Want a teammate to review the fix before it ships?',
          showIf: 'sloppy',
        },
      ],
    },
    {
      id: 'get-teammate-review',
      prompt: 'Yes, ask a teammate to review the parser fix before we ship it',
      difficulty: 1,
      response: [
        { type: 'thinking', text: 'Writing a review request that undersells how bad the crash was...', durationMs: 600 },
        { type: 'tool', name: 'Review', input: 'request review on parser fix', output: 'review requested from on-call teammate', durationMs: 700 },
        { type: 'pause', durationMs: 800 },
        {
          type: 'tool',
          name: 'Review',
          input: 'check review status',
          output: 'approved, one suggestion: log skipped messages for visibility',
          durationMs: 600,
          showIf: 'clean',
        },
        {
          type: 'tool',
          name: 'Review',
          input: 'check review status',
          output: 'approved after {errors} typo(s) in the review thread, same suggestion to log skipped messages',
          durationMs: 800,
          showIf: 'sloppy',
        },
        { type: 'status', kind: 'success', text: 'Approved, with a request to log skipped messages. Deploy the real fix now?' },
      ],
    },
    {
      id: 'deploy-the-real-fix',
      prompt: 'Yes, add that logging for skipped messages and deploy the real fix to production',
      difficulty: 2,
      response: [
        { type: 'thinking', text: 'Adding one log line that will save someone a bad night later...', durationMs: 600 },
        {
          type: 'diff',
          file: 'src/notifications/parser.ts',
          lines: [
            { op: ' ', text: 'if (!recipientId) return skip(message, "missing recipient");' },
            { op: '+', text: 'logger.warn("skipped notification", { reason: "missing_recipient" });' },
            { op: '+', text: 'metrics.increment("notifications.skipped");' },
          ],
          durationMs: 450,
        },
        { type: 'tool', name: 'Bash', input: 'git push origin fix/notification-parser', output: 'pushed', durationMs: 700 },
        { type: 'tool', name: 'Deploy', input: 'production', output: 'deployed, 0 errors on rollout', durationMs: 1600, showIf: 'clean' },
        {
          type: 'tool',
          name: 'Deploy',
          input: 'production',
          output: 'deployed after {errors} retry attempt(s)',
          durationMs: 1800,
          showIf: 'sloppy',
        },
        {
          type: 'status',
          kind: 'success',
          text: 'Real fix is live, {commits} commit shipped. Want me to watch the queue for an hour to be sure it holds?',
          showIf: 'clean',
        },
        {
          type: 'status',
          kind: 'warn',
          text: 'Live after {errors} retries. Want me to watch the queue for an hour to be sure it holds?',
          showIf: 'sloppy',
        },
      ],
    },
    {
      id: 'watch-queue-for-an-hour',
      prompt: 'Yes, watch the queue for the next hour and make sure the backlog does not come back',
      difficulty: 1,
      response: [
        { type: 'thinking', text: 'Trying not to stare at the dashboard the entire hour...', durationMs: 600 },
        {
          type: 'tool',
          name: 'Monitor',
          input: 'queue depth, 60 min window',
          output: 'flat at 0-5 messages the whole time',
          durationMs: 1000,
          showIf: 'clean',
        },
        {
          type: 'tool',
          name: 'Monitor',
          input: 'queue depth, 60 min window',
          output: 'mostly flat, {errors} brief blip(s) that cleared on their own',
          durationMs: 1200,
          showIf: 'sloppy',
        },
        { type: 'tool', name: 'Monitor', input: 'worker crash rate, 60 min window', output: 'zero crashes logged', durationMs: 900 },
        { type: 'pause', durationMs: 400 },
        {
          type: 'status',
          kind: 'success',
          text: 'A full hour with no crashes and no backlog, {loc} lines of clean logs to show for it. Time to write the postmortem?',
        },
      ],
    },
    {
      id: 'postmortem',
      prompt: 'write the postmortem now before this backlog situation happens again',
      difficulty: 4,
      response: [
        { type: 'thinking', text: 'Turning a pager alert into calm prose...', durationMs: 700 },
        { type: 'tool', name: 'Write', input: 'docs/postmortems/notification-queue-backlog.md', output: '{loc} lines drafted', durationMs: 1000 },
        {
          type: 'status',
          kind: 'success',
          text: 'Postmortem shipped. {commits} commit, and the pager finally quiet.',
          showIf: 'clean',
        },
        {
          type: 'status',
          kind: 'warn',
          text: 'Postmortem shipped after fixing {errors} typo(s) in the timeline.',
          showIf: 'sloppy',
        },
      ],
    },
  ],
};

export const workflows: Workflow[] = [searchAutocompleteLatency, notificationQueueBacklog];
