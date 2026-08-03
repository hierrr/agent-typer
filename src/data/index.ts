/**
 * 워크플로우 팩 로더. src/data/packs/*.ts 를 전부 glob 로드하고 id 중복을 제거한 뒤,
 * 피커(탭/사이드바) 표시 순서를 언어 기준으로 인터리브한다.
 * 콘텐츠 팩(20-*.ts)이 0개~N개 어떤 상태로 있어도 (00-sample.ts만 있어도) 동작해야 한다.
 *
 * v0.1.3 §2: 팩 로드 순서(파일 알파벳 순) 그대로 노출하면 mixed 워크플로우가 뒤쪽에
 * 몰린다. 언어(ko/en/mixed)가 번갈아 나오도록 ko→en→mixed 라운드로빈으로 재배열하고,
 * 같은 언어 안에서도 카테고리가 뭉치지 않도록 한 번 더 라운드로빈한다. 전부 입력 순서에만
 * 의존하는 결정적 재배열이라 Math.random/Date 없이도 새로고침 때마다 같은 순서가 나온다.
 */

import type { Workflow, WorkflowLang } from '../engine/types';

const modules = import.meta.glob<{ workflows?: Workflow[] }>('./packs/*.ts', { eager: true });

const byId = new Map<string, Workflow>();

// 경로 알파벳 순으로 정렬해 로드 순서를 결정적으로 만든다(00-sample.ts가 20-*.ts보다 먼저).
// 동일 id가 여러 팩에 있으면 먼저 로드된 쪽을 유지한다(간단하고 결정적인 dedup 규칙).
for (const path of Object.keys(modules).sort()) {
  const mod = modules[path];
  const list = mod?.workflows;
  if (!Array.isArray(list)) continue;
  for (const workflow of list) {
    if (!workflow || typeof workflow.id !== 'string' || !workflow.id) continue;
    if (byId.has(workflow.id)) continue;
    byId.set(workflow.id, workflow);
  }
}

/** 같은 키를 가진 항목끼리 원래 상대 순서를 유지한 채로 묶는다(입력 순서에만 의존, 결정적). */
function groupBy<T, K>(items: T[], keyOf: (item: T) => K): T[][] {
  const order: K[] = [];
  const buckets = new Map<K, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.push(item);
    } else {
      buckets.set(key, [item]);
      order.push(key);
    }
  }
  return order.map((key) => buckets.get(key)!);
}

/** 여러 그룹을 라운드로빈으로 한 줄 세운다(그룹 내부 순서는 유지). 셔플 없음, 입력 순서만으로 결정. */
function roundRobin<T>(groups: T[][]): T[] {
  const result: T[] = [];
  const cursors = new Array(groups.length).fill(0);
  let remaining = groups.reduce((sum, g) => sum + g.length, 0);
  while (remaining > 0) {
    for (let g = 0; g < groups.length; g++) {
      const idx = cursors[g];
      if (idx < groups[g].length) {
        result.push(groups[g][idx]);
        cursors[g] += 1;
        remaining -= 1;
      }
    }
  }
  return result;
}

/** 같은 언어 안에서 카테고리가 뭉치지 않도록 카테고리 단위로 라운드로빈한다. */
function diversifyByCategory(list: Workflow[]): Workflow[] {
  return roundRobin(groupBy(list, (w) => w.category));
}

/** ko → en → mixed 순서로 번갈아 나오게 재배열한다(스펙 v0.1.3 §2). 결정적, 랜덤 시드 없음. */
function interleaveByLang(list: Workflow[]): Workflow[] {
  const byLang = groupBy(list, (w) => w.lang);
  const asLangMap = new Map<WorkflowLang, Workflow[]>(byLang.map((g) => [g[0].lang, g]));
  const order: WorkflowLang[] = ['ko', 'en', 'mixed'];
  const diversified = order.map((lang) => diversifyByCategory(asLangMap.get(lang) ?? []));
  return roundRobin(diversified);
}

export const allWorkflows: Workflow[] = interleaveByLang(Array.from(byId.values()));
