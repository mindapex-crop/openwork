/**
 * 移植自 QM (MIT License, Copyright (c) 2026 QM contributors)
 * 原文件：qm/src/directory/person.ts
 * 移植说明：仅提取 personKey/samePerson 两个纯函数；删除 RosterPerson 接口、personKeys、samePersonInDirectory、samePersonMatcher（依赖 directory 查询的函数）。
 */

export function personKey(id: string | null | undefined): string {
  const s = (id ?? "").trim();
  return s.includes("@") ? s.toLowerCase() : s;
}

export function samePerson(a: string | null | undefined, b: string | null | undefined): boolean {
  const key = personKey(a);
  return key !== "" && key === personKey(b);
}
