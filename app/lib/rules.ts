// app/lib/rules.ts
// 규칙/동기화/인덱스 유틸 (LocalStorage 기반)

export type Row = Record<string, string>;
export type Category = '온라인' | '보건소' | '조리원';

export const LS_UNIFIED_ROWS = 'unified_rows';
export const LS_GUIDE_MAP = 'guide_map';           // 거래처분류 -> 안내분류
export const LS_CATEGORY_MAP = 'category_map';     // 거래처분류 -> 온라인/보건소/조리원

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

// ---- 날짜/상태 계산 유틸 ----
function toInt(n: any) { return Number.parseInt(String(n), 10); }
function parseDateLocal(s: string | undefined): Date | null {
  const t = (s ?? '').toString().trim();
  if (!t) return null;
  const m = t.match(/\d+/g);
  if (!m || m.length < 3) return null;
  const y = toInt(m[0]); const mo = toInt(m[1]); const d = toInt(m[2]);
  if (!y || !mo || !d) return null;
  return new Date(y, mo - 1, d); // 로컬 기준
}
function startOfDay(d: Date): Date { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function diffDays(a: Date, b: Date): number {
  const ms = startOfDay(a).getTime() - startOfDay(b).getTime();
  return Math.round(ms / 86400000);
}

/**
 * 상태 규칙(우선순위):
 * 1) 반납완료일 있음 -> "회수완료"
 * 2) 반납요청일 있음 -> "회수중"
 * 3) 종료일 기준
 *    - due - today ∈ [1,3] -> "만기3일전"
 *    - due - today >= 0     -> "대여중"  (오늘 포함)
 *    - due - today < 0      -> "만기지남"
 * 4) 종료일 없으면 기존값 유지
 */
export function computeStatusForRow(row: Row, today: Date = new Date()): string {
  const has = (k: string) => ((row[k] ?? '').toString().trim() !== '');
  if (has('반납완료일')) return '회수완료';
  if (has('반납요청일')) return '회수중';

  const due = parseDateLocal(row['종료일']);
  if (!due) return (row['상태'] ?? '').toString().trim();

  const d = diffDays(due, startOfDay(today));
  if (d >= 1 && d <= 3) return '만기3일전';
  if (d >= 0) return '대여중';
  return '만기지남';
}

export function applyStatusToRowInPlace(row: Row, today: Date = new Date()): boolean {
  const next = computeStatusForRow(row, today);
  if ((row['상태'] ?? '') !== next) { row['상태'] = next; return true; }
  return false;
}

let _statusRecalcLock = false;
export function recomputeStatusesNow() {
  if (_statusRecalcLock) return;
  _statusRecalcLock = true;
  try {
    const rows = loadUnifiedRows();
    let changed = false;
    const today = new Date();
    rows.forEach(r => { if (applyStatusToRowInPlace(r, today)) changed = true; });
    if (changed) {
      localStorage.setItem(LS_UNIFIED_ROWS, JSON.stringify(rows));
      window.dispatchEvent(new Event('unified_rows_updated'));
    }
  } finally {
    _statusRecalcLock = false;
  }
}

// ---- 기기 인덱스 (7개 카테고리 전체 스캔) ----
export type DeviceInfo = {
  구매렌탈?: string;  // '구매/렌탈'
  기종?: string;
  에러횟수?: string;
  제품?: string;      // 제품명
};
export function buildDeviceIndex(): Record<string, DeviceInfo> {
  const idx: Record<string, DeviceInfo> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i) || '';
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

  // 상태 갱신
  applyStatusToRowInPlace(row);
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

// ---- 기기 메타 조회 ----
export function lookupDeviceMeta(systemId: string) {
  const norm = (s: any) => (s ?? '').toString().trim();
  const id = norm(systemId);
  if (!id) return null;

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i) || '';
      if (!key.startsWith('device_rows:')) continue;
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

// ---- 기기관리 → 통합관리 메타 동기화 (핵심 추가) ----
let _deviceSyncLock = false;
export function syncDeviceMetaToUnifiedNow() {
  if (_deviceSyncLock) return;
  _deviceSyncLock = true;
  try {
    const idx = buildDeviceIndex();
    const rows = loadUnifiedRows();
    let changed = false;
    rows.forEach(r => {
      const before = JSON.stringify([r['구매/렌탈'], r['기종'], r['에러횟수'], r['제품']]);
      applyAutoToRowInPlace(r, idx); // 안내분류/상태도 함께 방어적으로 갱신
      const after  = JSON.stringify([r['구매/렌탈'], r['기종'], r['에러횟수'], r['제품']]);
      if (before !== after) changed = true;
    });
    if (changed) {
      localStorage.setItem(LS_UNIFIED_ROWS, JSON.stringify(rows));
      window.dispatchEvent(new Event('unified_rows_updated'));
    }
  } finally {
    _deviceSyncLock = false;
  }
}

// ---- 자동 재계산 트리거: 저장/스토리지변경/주기적 ----
if (typeof window !== 'undefined') {
  const tickStatus = () => recomputeStatusesNow();
  const tickDevice = () => syncDeviceMetaToUnifiedNow();

  window.addEventListener('unified_rows_updated', tickStatus);
  window.addEventListener('device_rows_updated', tickDevice);

  window.addEventListener('storage', (e: StorageEvent) => {
    if (!e.key) { tickStatus(); tickDevice(); return; }
    if (e.key === LS_UNIFIED_ROWS) tickStatus();
    if (e.key.startsWith('device_rows:')) tickDevice();
  });

  // 주기적 재계산(30분마다) → 날짜 바뀌거나 외부수정 시 자동 반영
  setInterval(() => { tickStatus(); tickDevice(); }, 30 * 60 * 1000);

  // 초기 1회
  setTimeout(() => { tickStatus(); tickDevice(); }, 0);
}

