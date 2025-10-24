// app/lib/rules.ts
export type Category = {
  id?: string;
  name?: string;
  type?: string;
};

export function applyAutoToRowInPlace(row: Record<string, string>): void {
  // 자동 처리 규칙을 적용하는 더미 함수
  return;
}

export function buildDeviceIndex(rows: Record<string, string>[]): Record<string, number> {
  const index: Record<string, number> = {};
  rows.forEach((r, i) => {
    if (r['기기번호']) index[r['기기번호']] = i;
  });
  return index;
}

export function rebuildCategoryViewsFromRules(rows: Record<string, string>[]): void {
  // 카테고리 관련 규칙을 재구성하는 더미 함수
  return;
}

export function updateCategoryForVendors(rows: Record<string, string>[]): void {
  // 거래처 분류 자동 업데이트용 더미 함수
  return;
}
