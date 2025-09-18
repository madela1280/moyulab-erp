// app/lib/rules.ts
// 규칙/동기화/인덱스 유틸 (LocalStorage 기반)

export type Row = Record<string, string>;
export type Category = '온라인' | '보건소' | '조리원';

export const LS_UNIFIED_ROWS = 'unified_rows';
export const LS_GUIDE_MAP = 'guide_map';           // 거래처분류 -> 안내분류
export const LS_CATEGORY_MAP = 'category_map';     // 거래처분류 -> 온라인/보건소/조리원
export {};

// ---- 공통 로드/세이브 ----
export function loadUnifiedRows(): Row[] {
  try {
    const raw = localStorage.getItem(LS_UNIFIED_ROWS);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}
export function saveUnifiedRows(rows: Row[]) {
  localStorage.setItem(LS_UNIFIED_ROWS, JSON.stringify(rows));
  window.dispatchEvent(new Event('unified_rows_updated'));
}

export function loadGuideMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem(LS_GUIDE_MAP);
    const obj = raw ? JSON.parse(raw) : {};
    return obj && typeof obj === 'object' ? obj : {};
  } catch { return {}; }
}
export function saveGuideMap(map: Record<string, string>) {
  localStorage.setItem(LS_GUIDE_MAP, JSON.stringify(map));
  window.dispatchEvent(new Event('rules:guide_updated'));
}

export function loadCategoryMap(): Record<string, Category> {
  try {
    const raw = localStorage.getItem(LS_CATEGORY_MAP);
    const obj = raw ? JSON.parse(raw) : {};
    return obj && typeof obj === 'object' ? obj : {};
  } catch { return {}; }
}
export function saveCategoryMap(map: Record<string, Category>) {
  localStorage.setItem(LS_CATEGORY_MAP, JSON.stringify(map));
  window.dispatchEvent(new Event('rules:category_updated'));
}

export function uniqueVendorsFromUnified(): string[] {
  const set = new Set<string>();
  loadUnifiedRows().forEach(r => {
    const v = (r['거래처분류'] ?? '').toString().trim();
    if (v) set.add(v);
  });
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

// ---- 기기 인덱스 (7개 카테고리 전체 스캔) ----
export type DeviceInfo = {
  구매렌탈?: string;  // '구매/렌탈' 값
  기종?: string;
  에러횟수?: string;
  제품?: string;      // 제품명
};
export function buildDeviceIndex(): Record<string, DeviceInfo> {
  const idx: Record<string, DeviceInfo> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i) || '';
      // 기기관리 저장 키 추정: "device_rows:카테고리" 또는 "device_rows:기기관리>카테고리"
      if (!key.startsWith('device_rows:')) continue;
      const raw = localStorage.getItem(key);
      const arr = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(arr)) continue;

      arr.forEach((r: any) => {
        const sys = ((r?.['시스템 기기번호'] ?? r?.['시스템번호'] ?? '') + '').trim();
        if (!sys) return;
        const info: DeviceInfo = {
          구매렌탈: ((r?.['구매/렌탈'] ?? '') + '').trim(),
          기종: ((r?.['기종'] ?? '') + '').trim(),
          에러횟수: ((r?.['에러횟수'] ?? '') + '').trim(),
          제품: ((r?.['제품명'] ?? r?.['제품'] ?? '') + '').trim(),
        };
        idx[sys] = info;
      });
    }
  } catch {}
  return idx;
}

// ---- 자동 적용 로직 ----
export function applyGuideToUnifiedRows() {
  const guide = loadGuideMap();
  const rows = loadUnifiedRows();
  const next = rows.map(r => {
    const vendor = (r['거래처분류'] ?? '').toString().trim();
    const g = guide[vendor];
    if (g) r['안내분류'] = g;
    return r;
  });
  saveUnifiedRows(next);
}

export function applyAutoToRowInPlace(row: Row, deviceIndex?: Record<string, DeviceInfo>) {
  // 거래처 → 안내분류
  const vendor = (row['거래처분류'] ?? '').toString().trim();
  const g = loadGuideMap()[vendor];
  if (g) row['안내분류'] = g;

  // 기기번호 → 기기정보
  const dev = (row['기기번호'] ?? '').toString().trim();
  const idx = deviceIndex || buildDeviceIndex();
  const info = dev ? idx[dev] : undefined;
  if (info) {
    if (info.구매렌탈) row['구매/렌탈'] = info.구매렌탈;
    if (info.기종)     row['기종']      = info.기종;
    if (info.에러횟수) row['에러횟수']  = info.에러횟수;
    if (info.제품)     row['제품']      = info.제품;
  }
}

// ---- 카테고리 뷰(온라인/보건소/조리원) 재구성 ----
function catKey(cat: Category) { return 'cat_rows:' + cat; }

export function rebuildCategoryViewsFromRules() {
  const catMap = loadCategoryMap();
  const rows = loadUnifiedRows();

  const buckets: Record<Category, Row[]> = { 온라인: [], 보건소: [], 조리원: [] };
  rows.forEach(r => {
    const vendor = (r['거래처분류'] ?? '').toString().trim();
    const cat = catMap[vendor];
    if (cat && buckets[cat]) buckets[cat].push({ ...r });
  });

  (Object.keys(buckets) as Category[]).forEach(cat => {
    localStorage.setItem(catKey(cat), JSON.stringify(buckets[cat]));
  });

  window.dispatchEvent(new Event('rules:category_rebuilt'));
}

// 선택한 거래처들을 지정 카테고리로 이동(규칙 갱신 + 재빌드)
export function updateCategoryForVendors(vendors: string[], dest: Category) {
  const map = loadCategoryMap();
  vendors.forEach(v => { if (v) map[v] = dest; });
  saveCategoryMap(map);
  rebuildCategoryViewsFromRules();
}

// app/lib/rules.ts

export function lookupDeviceMeta(systemId: string) {
  const norm = (s: any) => (s ?? '').toString().trim();
  const id = norm(systemId);
  if (!id) return null;

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i) || '';
      if (!key.startsWith('device_rows:')) continue;           // 기기관리 7개 카테고리 저장소
      const raw = localStorage.getItem(key);
      const list = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(list)) continue;

      for (const r of list) {
        const sid = norm(r?.['시스템 기기번호'] ?? r?.['시스템번호']);
        if (sid === id) {
          return {
            '구매/렌탈': norm(r?.['구매/렌탈']),
            '기종':       norm(r?.['기종']),
            '에러횟수':   norm(r?.['에러횟수']),
            '제품':       norm(r?.['제품명'] ?? r?.['제품']),
          };
        }
      }
    }
  } catch {}
  return null;
}
