/**
 * Office workflow pack (Korean) -- 주간보고 작성, 회의록 후속 메일 발송.
 * 구 v0.1 시나리오(office-ko-weekly-report, office-ko-meeting-summary,
 * office-ko-email-draft)를 재료로 재활용해 연쇄 업무로 확장했다.
 * v0.1.5: 사용자 피드백("업무가 너무 짧다")으로 워크플로우당 10스텝으로 확장.
 * 파악 -> 보강 -> 동료 검토 -> 반영 -> 다듬기 -> 재확인 -> 상급자 확인 -> 발송 ->
 * 후속 확인 -> 아카이브 리듬.
 */

import type { Workflow } from '../../engine/types';

const weeklyReport: Workflow = {
  id: 'office-ko-weekly-report',
  title: '주간보고 작성',
  description: '이번 주 진행 상황 정리부터 발송까지, 금요일 퇴근 전 주간보고 완성',
  lang: 'ko',
  category: 'office',
  tags: ['주간보고', '문서'],
  steps: [
    {
      id: 'draft-bullets',
      difficulty: 1,
      prompt: '금요일 오후 4시인데 주간보고가 아직 빈칸이야, 이번 주 진행 상황부터 불릿으로 정리해줘',
      response: [
        { type: 'thinking', text: '이번 주에 뭘 했는지 되짚는 중...', durationMs: 900 },
        { type: 'tool', name: 'Search', input: '이번 주 커밋 및 티켓 내역', output: '완료 항목 9건 확인', durationMs: 800 },
        {
          type: 'diff',
          file: '주간보고_초안.md',
          durationMs: 500,
          lines: [
            { op: '+', text: '- 결제 모듈 리팩터링 완료' },
            { op: '+', text: '- 신규 기능 QA 3건 통과' },
            { op: '+', text: '- 세션 버그 수정 및 배포' },
          ],
        },
        { type: 'pause', durationMs: 400 },
        {
          type: 'status',
          kind: 'success',
          text: '이번 주 항목 {files}개 정리했습니다. 근데 항목들이 다 두루뭉술하네요, 숫자를 좀 더 구체적으로 넣어드릴까요?',
          showIf: 'clean',
        },
        {
          type: 'status',
          kind: 'warn',
          text: '초안에 오타 {errors}개 있었지만 정리했습니다. 항목이 다 두루뭉술한데, 숫자를 좀 더 구체적으로 넣어드릴까요?',
          showIf: 'sloppy',
        },
      ],
    },
    {
      id: 'add-metrics',
      difficulty: 2,
      prompt: '응, 테스트 통과율이랑 처리 시간 같은 구체적인 수치를 항목마다 좀 넣어줘',
      response: [
        { type: 'thinking', text: '항목마다 뒷받침할 숫자를 찾는 중...', durationMs: 700 },
        {
          type: 'tool',
          name: 'Search',
          input: '이번 주 처리 건수 및 소요 시간 집계',
          output: '테스트 통과율 100%, 평균 처리 2일',
          durationMs: 800,
        },
        {
          type: 'diff',
          file: '주간보고_초안.md',
          durationMs: 450,
          lines: [
            { op: '-', text: '- 신규 기능 QA 3건 통과' },
            { op: '+', text: '- 신규 기능 테스트 3건 통과 (통과율 100%)' },
            { op: '+', text: '- 평균 처리 기간 2일로 단축' },
          ],
        },
        { type: 'pause', durationMs: 400 },
        {
          type: 'status',
          kind: 'success',
          text: '수치까지 넣으니 훨씬 그럴듯합니다. {files}개 항목 보강했는데, 다음 주 계획도 추가할까요?',
          showIf: 'clean',
        },
        {
          type: 'status',
          kind: 'warn',
          text: '수치 넣다가 초안에 오타 {errors}개 났지만 다 고쳤습니다. 다음 주 계획도 추가할까요?',
          showIf: 'sloppy',
        },
      ],
    },
    {
      id: 'add-next-week',
      difficulty: 1,
      prompt: '다음 주 계획도 세 줄 정도 간단히 추가하고 우선순위 순서로 다시 정렬해줘',
      response: [
        { type: 'thinking', text: '다음 주에 뭐부터 해야 할지 순서를 매기는 중...', durationMs: 700 },
        { type: 'tool', name: 'Read', input: '이전 스프린트 계획', output: '이월된 항목 2건 확인', durationMs: 600 },
        {
          type: 'diff',
          file: '주간보고_초안.md',
          durationMs: 450,
          lines: [
            { op: '+', text: '- 다음 주: 마이그레이션 스크립트 배포 (최우선)' },
            { op: '+', text: '- 다음 주: 대시보드 성능 개선' },
            { op: '+', text: '- 다음 주: 밀린 코드 리뷰 처리' },
          ],
        },
        { type: 'pause', durationMs: 400 },
        {
          type: 'status',
          kind: 'success',
          text: '다음 주 계획까지 넣었습니다. {commits}줄 추가했는데, 옆자리 동료한테 초안 검토 한번 부탁해볼까요?',
          showIf: 'clean',
        },
        {
          type: 'status',
          kind: 'warn',
          text: '초안 정렬하다가 오타 {errors}개, 그래도 순서는 맞췄습니다. 옆자리 동료한테 검토 부탁해볼까요?',
          showIf: 'sloppy',
        },
      ],
    },
    {
      id: 'request-teammate-check',
      difficulty: 1,
      prompt: '그래, 옆자리 동료한테 초안 좀 보여주고 이상한 부분 없는지 검토 부탁해줘',
      response: [
        { type: 'thinking', text: '누구한테 보여줄지 고민하는 중...', durationMs: 600 },
        { type: 'tool', name: 'Post', input: '옆자리 동료에게 초안 공유', output: '검토 요청 전달됨', durationMs: 700 },
        { type: 'pause', durationMs: 400 },
        {
          type: 'tool',
          name: 'Read',
          input: '동료 피드백 확인',
          output: '코멘트 2건 달림, 애매한 표현 지적',
          durationMs: 900,
        },
        {
          type: 'status',
          kind: 'success',
          text: '동료가 코멘트 {commits}건 남겼습니다. 반영해드릴까요?',
          showIf: 'clean',
        },
        {
          type: 'status',
          kind: 'warn',
          text: '요청 문구에 오타 {errors}개 있었지만 동료가 코멘트는 남겨줬습니다. 반영해드릴까요?',
          showIf: 'sloppy',
        },
      ],
    },
    {
      id: 'apply-teammate-feedback',
      difficulty: 2,
      prompt: '동료가 코멘트로 지적한 애매한 표현들을 문장 단위로 전부 명확하게 다시 고쳐줘',
      response: [
        { type: 'thinking', text: '어느 표현이 헷갈렸을지 다시 읽어보는 중...', durationMs: 700 },
        {
          type: 'diff',
          file: '주간보고_초안.md',
          durationMs: 450,
          lines: [
            { op: '-', text: '- 평균 처리 기간 2일로 단축' },
            { op: '+', text: '- 지난주 대비 평균 처리 기간 2일 단축 (기존 4일)' },
            { op: '+', text: '- 표현을 전반적으로 명확하게 정리' },
          ],
        },
        { type: 'pause', durationMs: 400 },
        {
          type: 'status',
          kind: 'success',
          text: '표현 다 정리했습니다. {files}개 문장 손봤는데, 톤도 좀 다듬을까요?',
          showIf: 'clean',
        },
        {
          type: 'status',
          kind: 'warn',
          text: '표현 고치다가 초안에 오타 {errors}개, 다시 확인하고 정리했습니다. 톤도 좀 다듬을까요?',
          showIf: 'sloppy',
        },
      ],
    },
    {
      id: 'polish-tone',
      difficulty: 2,
      prompt: '주간보고 톤을 좀 더 담백하게 다듬고 숫자는 굵게 강조해서 눈에 띄게 해줘',
      response: [
        { type: 'thinking', text: '자랑처럼 안 보이게 톤을 낮추는 중...', durationMs: 700 },
        {
          type: 'diff',
          file: '주간보고_초안.md',
          durationMs: 450,
          lines: [
            { op: '-', text: '- 결제 모듈 리팩터링 완료' },
            { op: '+', text: '- 결제 모듈 리팩터링 완료 (테스트 커버리지 **96%**)' },
            { op: '+', text: '- 신규 기능 QA **3건** 통과' },
          ],
        },
        { type: 'tool', name: 'Format', input: '숫자 굵게 강조 적용', output: '적용 완료', durationMs: 500 },
        { type: 'pause', durationMs: 400 },
        {
          type: 'status',
          kind: 'success',
          text: '다듬었습니다. 마감까지 확실히 끝났는데, 오탈자랑 숫자 사실관계만 마지막으로 한번 확인해볼까요?',
          showIf: 'clean',
        },
        {
          type: 'status',
          kind: 'warn',
          text: '톤 다듬는 중 초안에 오타 {errors}개, 그래도 숫자는 정확합니다. 오탈자랑 숫자만 마지막으로 확인해볼까요?',
          showIf: 'sloppy',
        },
      ],
    },
    {
      id: 'proofread',
      difficulty: 2,
      prompt: '주간보고 제출 전에 오탈자랑 숫자 사실관계까지 마지막으로 한번 더 꼼꼼하게 확인해줘',
      response: [
        { type: 'thinking', text: '숫자 하나하나 원본이랑 대조하는 중...', durationMs: 800 },
        {
          type: 'tool',
          name: 'Grep',
          input: '주간보고_초안.md 숫자 전수 검사',
          output: '숫자 6곳, 오탈자 후보 0건',
          durationMs: 900,
        },
        { type: 'pause', durationMs: 400 },
        {
          type: 'status',
          kind: 'success',
          text: '검토 끝났습니다. {commits}차 확인이라 이제 믿을 만합니다. 팀장님께 미리 슬쩍 컨펌 받아볼까요?',
          showIf: 'clean',
        },
        {
          type: 'status',
          kind: 'warn',
          text: '검토하다 오타 {errors}개 더 나왔지만 다 잡았습니다. 팀장님께 미리 컨펌 받아볼까요?',
          showIf: 'sloppy',
        },
      ],
    },
    {
      id: 'get-manager-preapproval',
      difficulty: 1,
      prompt: '정식으로 발송하기 전에 팀장님한테 내용부터 슬쩍 미리 한번만 보여드리고 와줘',
      response: [
        { type: 'thinking', text: '반응이 어떨지 긴장되는 중...', durationMs: 600 },
        { type: 'tool', name: 'Post', input: '팀장님께 사전 공유', output: '확인 완료, 코멘트 없음', durationMs: 800, showIf: 'clean' },
        {
          type: 'tool',
          name: 'Post',
          input: '팀장님께 사전 공유',
          output: '초안에서 오타 {errors}개 지적받고 바로 수정',
          durationMs: 900,
          showIf: 'sloppy',
        },
        { type: 'pause', durationMs: 400 },
        {
          type: 'status',
          kind: 'success',
          text: '팀장님도 오케이 하셨습니다. {commits}번째 확인 끝, 이제 정식으로 발송할까요?',
          showIf: 'clean',
        },
        {
          type: 'status',
          kind: 'warn',
          text: '지적받은 오타 {errors}개 고쳤습니다. 이제 정식으로 발송할까요?',
          showIf: 'sloppy',
        },
      ],
    },
    {
      id: 'send-report',
      difficulty: 1,
      prompt: '완성된 주간보고 팀장님한테 워크그램으로 보내고 결과 공유 채널에도 링크 올려줘',
      response: [
        { type: 'thinking', text: '보내기 전에 마지막으로 한번 훑는 중...', durationMs: 500 },
        { type: 'tool', name: 'Post', input: '팀장님 워크그램 DM', output: '전송 완료', durationMs: 600 },
        { type: 'tool', name: 'Post', input: '#결과공유 채널', output: '링크 게시됨', durationMs: 500 },
        { type: 'pause', durationMs: 300 },
        {
          type: 'status',
          kind: 'success',
          text: '주간보고 발송 완료. {commits}개 커밋으로 요약해서 보냈는데, 개인 아카이브에도 정리해서 저장해둘까요?',
        },
      ],
    },
    {
      id: 'archive-and-note',
      difficulty: 1,
      prompt: '발송한 주간보고 개인 아카이브 폴더에 저장하고 이번 주 회고 메모도 한 줄 남겨줘',
      response: [
        { type: 'thinking', text: '이번 주를 한 줄로 요약하는 중...', durationMs: 500 },
        { type: 'tool', name: 'Write', input: '개인_아카이브/2026-W31.md', output: '저장 완료', durationMs: 600 },
        {
          type: 'diff',
          file: '회고_메모.md',
          durationMs: 400,
          lines: [
            { op: '+', text: '2026년 31주차: 결제 모듈, 세션 버그, 다음 주는 마이그레이션' },
            { op: '+', text: '느낀 점: 숫자 넣으니 보고서가 그럴듯해 보인다' },
            { op: '+', text: '다음에도 이 순서 그대로 쓰기' },
          ],
        },
        { type: 'pause', durationMs: 300 },
        {
          type: 'status',
          kind: 'success',
          text: '아카이브 완료. {loc}자 분량 기록으로 이번 주도 무사히 넘겼습니다.',
        },
      ],
    },
  ],
};

const meetingFollowup: Workflow = {
  id: 'office-ko-meeting-followup',
  title: '회의록 후속 메일 발송',
  description: '녹취록 요약부터 리마인더 등록까지, 회의 후속 처리 한 번에',
  lang: 'ko',
  category: 'office',
  tags: ['회의록', '이메일', '액션아이템'],
  steps: [
    {
      id: 'summarize-minutes',
      difficulty: 2,
      prompt: '1시간짜리 회의 녹취록 받았는데 아무도 요약할 시간이 없어, 결정사항이랑 액션아이템만 뽑아줘',
      response: [
        { type: 'thinking', text: '녹취록을 처음부터 끝까지 훑는 중...', durationMs: 1200 },
        { type: 'tool', name: 'Read', input: '회의록_녹취_0731.txt', output: '43분 분량, 발언자 5명', durationMs: 900 },
        {
          type: 'tool',
          name: 'Summarize',
          input: '결정사항 및 액션아이템 추출',
          output: '결정 3건, 액션아이템 5건 발견',
          durationMs: 1100,
        },
        {
          type: 'diff',
          file: '회의록_요약.md',
          durationMs: 500,
          lines: [
            { op: '+', text: '결정: 배포 주기를 격주에서 매주로 변경' },
            { op: '+', text: '액션: 김대리, 마이그레이션 문서 작성' },
            { op: '+', text: '액션: 박과장, QA 체크리스트 갱신' },
          ],
        },
        { type: 'pause', durationMs: 400 },
        {
          type: 'status',
          kind: 'success',
          text: '액션아이템까지 정리했습니다. {files}개 뽑았는데, 애매하게 들린 부분 몇 군데는 녹취록에서 다시 확인해볼까요?',
          showIf: 'clean',
        },
        {
          type: 'status',
          kind: 'warn',
          text: '정리 중 요약본에 오타 {errors}개 났지만 액션아이템은 다 뽑았습니다. 애매한 부분은 녹취록에서 다시 확인해볼까요?',
          showIf: 'sloppy',
        },
      ],
    },
    {
      id: 'double-check-with-recording',
      difficulty: 2,
      prompt: '회의 중 애매하게 들렸던 두 부분은 녹취록을 다시 틀어서 정확한 내용으로 확인해줘',
      response: [
        { type: 'thinking', text: '재생 위치를 찾아 앞뒤로 돌려보는 중...', durationMs: 700 },
        {
          type: 'tool',
          name: 'Read',
          input: '회의록_녹취_0731.txt 18분 구간',
          output: '배포 주기 발언자는 박과장으로 확인',
          durationMs: 900,
        },
        {
          type: 'tool',
          name: 'Read',
          input: '회의록_녹취_0731.txt 32분 구간',
          output: '체크리스트 갱신 기한은 다음 주 금요일로 정정',
          durationMs: 900,
        },
        { type: 'pause', durationMs: 400 },
        {
          type: 'status',
          kind: 'success',
          text: '두 곳 다 확인해서 정정했습니다. {files}개 항목 업데이트했는데, 담당자별로 마감일도 표로 붙여드릴까요?',
          showIf: 'clean',
        },
        {
          type: 'status',
          kind: 'warn',
          text: '되짚는 중 요약본에 오타 {errors}개 났지만 정정은 끝냈습니다. 마감일도 표로 붙여드릴까요?',
          showIf: 'sloppy',
        },
      ],
    },
    {
      id: 'assign-deadlines',
      difficulty: 2,
      prompt: '액션아이템별 담당자랑 마감일을 3일 뒤, 5일 뒤로 나눠서 표로 깔끔하게 정리해줘',
      response: [
        { type: 'thinking', text: '누가 며칠 안에 끝낼 수 있을지 가늠하는 중...', durationMs: 700 },
        {
          type: 'diff',
          file: '회의록_요약.md',
          durationMs: 450,
          lines: [
            { op: '+', text: '| 담당자 | 액션아이템 | 마감일 |' },
            { op: '+', text: '| 김대리 | 마이그레이션 문서 작성 | D+3 |' },
            { op: '+', text: '| 박과장 | QA 체크리스트 갱신 | D+5 |' },
          ],
        },
        { type: 'tool', name: 'Format', input: '표 레이아웃 정리', output: '표 생성 완료', durationMs: 500 },
        { type: 'pause', durationMs: 400 },
        {
          type: 'status',
          kind: 'success',
          text: '표까지 만들었습니다. {commits}개 액션아이템 정리 끝냈는데, 표에 적은 담당자들이 맞는지 미리 한번 확인해볼까요?',
          showIf: 'clean',
        },
        {
          type: 'status',
          kind: 'warn',
          text: '표 만들다 오타 {errors}개, 그래도 마감일은 맞습니다. 담당자들이 맞는지 미리 확인해볼까요?',
          showIf: 'sloppy',
        },
      ],
    },
    {
      id: 'confirm-owners',
      difficulty: 1,
      prompt: '표에 적은 담당자들 실제로 맞는 사람인지 다시 한번 확인하고 틀린 거 있으면 고쳐줘',
      response: [
        { type: 'thinking', text: '조직도랑 대조해보는 중...', durationMs: 600 },
        {
          type: 'tool',
          name: 'Search',
          input: '조직도에서 담당 업무 재확인',
          output: '박과장 항목은 실제로 이과장 담당으로 확인',
          durationMs: 900,
        },
        {
          type: 'diff',
          file: '회의록_요약.md',
          durationMs: 400,
          lines: [
            { op: ' ', text: '| 김대리 | 마이그레이션 문서 작성 | D+3 |' },
            { op: '-', text: '| 박과장 | QA 체크리스트 갱신 | D+5 |' },
            { op: '+', text: '| 이과장 | QA 체크리스트 갱신 | D+5 |' },
          ],
        },
        { type: 'pause', durationMs: 400 },
        {
          type: 'status',
          kind: 'success',
          text: '담당자 한 명 잘못 적혀 있었네요, 고쳤습니다. {files}개 다시 확인 끝, 메일 초안 써드릴까요?',
          showIf: 'clean',
        },
        {
          type: 'status',
          kind: 'warn',
          text: '표 확인하다 오타 {errors}개, 그래도 담당자는 바로잡았습니다. 메일 초안 써드릴까요?',
          showIf: 'sloppy',
        },
      ],
    },
    {
      id: 'draft-email',
      difficulty: 2,
      prompt: '관련자 다섯 명한테 액션아이템 정리해서 메일 초안 좀 써줘, 톤은 정중하게',
      response: [
        { type: 'thinking', text: '적당히 정중한 어조를 고민하는 중...', durationMs: 900 },
        { type: 'tool', name: 'Search', input: '이전 발송 메일 톤 참고', output: '유사 사례 2건 발견', durationMs: 600 },
        {
          type: 'diff',
          file: '메일_초안.txt',
          durationMs: 450,
          lines: [
            { op: '+', text: '제목: 회의 후속 액션아이템 공유드립니다' },
            { op: '+', text: '본문: 논의된 결정사항과 담당자별 마감일을 정리해 안내드립니다.' },
            { op: '+', text: '맺음말: 확인 부탁드리며 문의사항은 회신 부탁드립니다.' },
          ],
        },
        { type: 'pause', durationMs: 400 },
        {
          type: 'status',
          kind: 'success',
          text: '초안 완성했습니다. 발송 전에 팀장님 검토 한번 받아볼까요?',
          showIf: 'clean',
        },
        {
          type: 'status',
          kind: 'warn',
          text: '초안에 오타 {errors}개, 다시 다듬었습니다. 발송 전에 팀장님 검토 받아볼까요?',
          showIf: 'sloppy',
        },
      ],
    },
    {
      id: 'manager-review-email',
      difficulty: 1,
      prompt: '메일 발송하기 전에 팀장님한테 초안 검토 좀 미리 부탁드리고 답 기다려줘',
      response: [
        { type: 'thinking', text: '팀장님이 바쁘지 않은 시간대인지 살피는 중...', durationMs: 600 },
        { type: 'tool', name: 'Post', input: '팀장님께 메일 초안 검토 요청', output: '10분 만에 코멘트 도착', durationMs: 900 },
        { type: 'pause', durationMs: 300 },
        {
          type: 'status',
          kind: 'success',
          text: '팀장님이 문구 하나만 손봐달라고 하셨습니다. {commits}번째 검토인데, 바로 반영해드릴까요?',
          showIf: 'clean',
        },
        {
          type: 'status',
          kind: 'warn',
          text: '요청 문구에 오타 {errors}개 있었지만 코멘트는 받았습니다. 반영해드릴까요?',
          showIf: 'sloppy',
        },
      ],
    },
    {
      id: 'revise-email',
      difficulty: 1,
      prompt: '팀장님이 아까 지적한 문구 하나만 좀 더 정중한 표현으로 다시 바꿔서 보여줘',
      response: [
        { type: 'thinking', text: '정중하면서 딱딱하지 않은 표현을 고르는 중...', durationMs: 700 },
        {
          type: 'diff',
          file: '메일_초안.txt',
          durationMs: 450,
          lines: [
            { op: '-', text: '본문: 논의된 결정사항과 담당자별 마감일을 정리해 안내드립니다.' },
            { op: '+', text: '본문: 논의된 결정사항과 담당자별 마감일을 정리하여 안내드리오니 참고 부탁드립니다.' },
            { op: ' ', text: '맺음말: 확인 부탁드리며 문의사항은 회신 부탁드립니다.' },
          ],
        },
        { type: 'pause', durationMs: 400 },
        {
          type: 'status',
          kind: 'success',
          text: '문구 다듬었습니다. {files}개 문장 손봤는데, 이제 발송할까요?',
          showIf: 'clean',
        },
        {
          type: 'status',
          kind: 'warn',
          text: '문구 고치다 오타 {errors}개, 다시 확인했습니다. 이제 발송할까요?',
          showIf: 'sloppy',
        },
      ],
    },
    {
      id: 'send-and-remind',
      difficulty: 1,
      prompt: '메일까지 발송하고 팀원 각자 캘린더에도 마감일 리마인더까지 잊지 말고 걸어줘',
      response: [
        { type: 'thinking', text: '리마인더 시간대까지 챙기는 중...', durationMs: 500 },
        { type: 'tool', name: 'Post', input: '메일 발송', output: '5명에게 발송 완료', durationMs: 600 },
        { type: 'tool', name: 'Post', input: '캘린더 리마인더 등록', output: '5건 등록됨', durationMs: 500 },
        { type: 'pause', durationMs: 300 },
        {
          type: 'status',
          kind: 'success',
          text: '회의록 후속 처리 끝. {commits}개 커밋 분량 정리, 발송은 했는데 다음 날 진행 상황도 슬쩍 체크해볼까요?',
        },
      ],
    },
    {
      id: 'track-progress',
      difficulty: 2,
      prompt: '다음 날 액션아이템들이 전부 실제로 잘 진행되고 있는지 슬쩍 하나씩 확인해줘',
      response: [
        { type: 'thinking', text: '누구부터 찔러볼지 순서를 정하는 중...', durationMs: 600 },
        { type: 'tool', name: 'Post', input: '김대리에게 진행 상황 문의', output: '마이그레이션 문서 절반 작성함', durationMs: 800 },
        { type: 'tool', name: 'Post', input: '이과장에게 진행 상황 문의', output: 'QA 체크리스트 갱신 착수 전', durationMs: 800 },
        { type: 'pause', durationMs: 400 },
        {
          type: 'status',
          kind: 'success',
          text: '한 명은 순조롭고 한 명은 아직인데, {commits}건 다 확인했습니다. 회의록 최종본 정리해서 마무리할까요?',
          showIf: 'clean',
        },
        {
          type: 'status',
          kind: 'warn',
          text: '문의 메시지에 오타 {errors}개 났지만 진행 상황은 다 확인했습니다. 회의록 최종본 정리해서 마무리할까요?',
          showIf: 'sloppy',
        },
      ],
    },
    {
      id: 'close-out-doc',
      difficulty: 1,
      prompt: '이번 주 회의록 최종본을 깔끔하게 정리해서 팀 문서함에 보관하고 마무리해줘',
      response: [
        { type: 'thinking', text: '이 회의도 이제 완전히 끝이라 홀가분한 중...', durationMs: 500 },
        { type: 'tool', name: 'Write', input: '문서함/회의록_0731_최종.md', output: '저장 완료', durationMs: 600 },
        { type: 'tool', name: 'Bash', input: '임시 파일 정리', output: '초안 3개 삭제됨', durationMs: 500 },
        { type: 'pause', durationMs: 300 },
        {
          type: 'status',
          kind: 'success',
          text: '정리 끝. {loc}자 분량 회의록으로 이번 회의는 완전히 마무리됐습니다. 다음 회의까지는 평화롭기를.',
        },
      ],
    },
  ],
};

export const workflows: Workflow[] = [weeklyReport, meetingFollowup];
