'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { rebuildCategoryViewsFromRules, lookupDeviceMeta } from '../lib/rules';

type Row = Record<string, string>;

/** 통합관리 기본 컬럼 */
const FALLBACK_COLUMNS: string[] = [
  '거래처분류','상태','안내분류','구매/렌탈','기기번호','기종','에러횟수','제품',
  '수취인명','연락처1','연락처2','계약자주소','택배발송일','시작일','종료일',
  '반납요청일','반납완료일','특이사항1','특이사항2','총연장횟수','신청일',
  '0차연장','1차연장','2차연장','3차연장','4차연장','5차연장',
];

const LS_UNIFIED_COLUMNS = 'unified_columns';
const LS_UNIFIED_ROWS    = 'unified_rows';
const LS_VENDORS         = 'vendors';
const LS_FORM_VISIBLE    = 'new_signup_visible_fields';
const LS_DRAFT           = 'new_signup_draft';
const LS_GUIDE_RULES     = 'guide_rules'; // 거래처 → 안내분류 규칙 저장 키

const LABELS: Record<string, string> = { 계약자주소: '주소', 특이사항1: '특이사항' };
const label = (k: string) => LABELS[k] ?? k;

const COL_WIDTH: Record<string, number> = { 계약자주소: 360 };
const DEFAULT_COL_W = 120;
const BLANK_ROWS = 17;

/** 통합관리 양식(컬럼) 로드 */
function loadUnifiedColumns(): string[] {
  try {
    const raw = localStorage.getItem(LS_UNIFIED_COLUMNS);
    const arr = raw ? JSON.parse(raw) : null;
    return Array.isArray(arr) && arr.length ? arr : FALLBACK_COLUMNS;
  } catch { return FALLBACK_COLUMNS; }
}

/** 신규가입 보이는 칼럼 로드/저장 */
function loadVisible(columns: string[]): string[] {
  try {
    const raw = localStorage.getItem(LS_FORM_VISIBLE);
    const arr = raw ? JSON.parse(raw) : null;
    const base = Array.isArray(arr) ? arr.filter((c: string) => columns.includes(c)) : columns.slice();
    return base.length <= 1 ? columns.slice() : base;
  } catch { return columns.slice(); }
}
function saveVisible(list: string[]) {
  localStorage.setItem(LS_FORM_VISIBLE, JSON.stringify(list));
}

/** 거래처 목록 */
function loadVendors(): string[] {
  try {
    const raw = localStorage.getItem(LS_VENDORS);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}
function saveVendors(list: string[]) {
  localStorage.setItem(LS_VENDORS, JSON.stringify(Array.from(new Set(list))));
}

/** 안내분류 규칙 조회: 거래처명 -> 안내분류 문자열 */
function getGuideByVendor(vendor?: string): string {
  const v = (vendor ?? '').toString().trim();
  if (!v) return '';
  try {
    const raw = localStorage.getItem(LS_GUIDE_RULES);
    if (!raw) return '';
    const map = JSON.parse(raw);
    if (map && typeof map === 'object' && !Array.isArray(map)) {
      const val = map[v] ?? map[v.trim()];
      return (val ?? '').toString().trim();
    }
    if (Array.isArray(map)) {
      const hit = map.find((x: any) => (x?.vendor ?? '').toString().trim() === v);
      return (hit?.guide ?? '').toString().trim();
    }
  } catch {}
  return '';
}

export default function NewSignup() {
  /** ====== 상태 ====== */
  const [columns, setColumns] = useState<string[]>([]);
  const [visible, setVisible] = useState<string[]>([]);
  const [grid, setGrid] = useState<string[][]>([]);
  const [showEditor, setShowEditor] = useState(false);

  const [vendors, setVendors] = useState<string[]>([]);
  const [vendorOpen, setVendorOpen] = useState<{ r: number; c: number } | null>(null);
  const [vendorQuery, setVendorQuery] = useState('');

  // 거래처 삭제 모드
  const [vendorDeleteMode, setVendorDeleteMode] = useState(false);
  const [vendorDeleteSel, setVendorDeleteSel] = useState<Set<string>>(new Set());

  // 팝오버 바깥 클릭 감지
  const vendorPopoverRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!vendorOpen) return;
      if (vendorPopoverRef.current?.contains(e.target as Node)) return;
      setVendorOpen(null);
      setVendorDeleteMode(false);
      setVendorDeleteSel(new Set());
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [vendorOpen]);

  // 드래그 선택/삭제용
  const tableHostRef = useRef<HTMLDivElement | null>(null);
  const [dragSel, setDragSel] = useState<{ r1:number; c1:number; r2:number; c2:number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const startSel = (r:number, vc:number) => { setDragSel({ r1:r, c1:vc, r2:r, c2:vc }); setDragging(true); };
  const extendSel = (r:number, vc:number) => { if (dragging) setDragSel(s => (s ? { ...s, r2:r, c2:vc } : s)); };
  useEffect(() => {
    const up = () => setDragging(false);
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, []);
  const isSelected = (r:number, vc:number) => {
    if (!dragSel) return false;
    const r1 = Math.min(dragSel.r1, dragSel.r2);
    const r2 = Math.max(dragSel.r1, dragSel.r2);
    const c1 = Math.min(dragSel.c1, dragSel.c2);
    const c2 = Math.max(dragSel.c1, dragSel.c2);
    return r>=r1 && r<=r2 && vc>=c1 && vc<=c2;
  };
  const focusHost = () => tableHostRef.current?.focus();

  /** draft 자동 저장 */
  useEffect(() => {
    if (!grid.length) return;
    try { localStorage.setItem(LS_DRAFT, JSON.stringify(grid)); } catch {}
  }, [grid]);

  /** 가시 컬럼 인덱스 (반드시 이 아래에서 참조) */
  const visibleIdx = useMemo(
    () => visible.map(v => columns.indexOf(v)).filter(i => i >= 0),
    [visible, columns]
  );

  /** 삭제키로 선택영역 비우기 */
  useEffect(() => {
    const el = tableHostRef.current;
    if (!el) return;

    const onKey = (e: KeyboardEvent) => {
      if (!dragSel) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        setGrid(prev => {
          const next = prev.map(r => r.slice());
          const r1 = Math.min(dragSel.r1, dragSel.r2);
          const r2 = Math.max(dragSel.r1, dragSel.r2);
          const c1 = Math.min(dragSel.c1, dragSel.c2);
          const c2 = Math.max(dragSel.c1, dragSel.c2);
          for (let r = r1; r <= r2; r++) {
            for (let vc = c1; vc <= c2; vc++) {
              const ci = visibleIdx[vc];
              if (ci != null) next[r][ci] = '';
            }
          }
          return next;
        });
      }
    };

    el.addEventListener('keydown', onKey);
    return () => el.removeEventListener('keydown', onKey);
  }, [dragSel, visibleIdx]);

  /** ====== 초기 로드 ====== */
  useEffect(() => {
    const cols = loadUnifiedColumns();
    setColumns(cols);
    setVisible(loadVisible(cols));

    // 초안 복구 or 초기화
    try {
      const raw = localStorage.getItem(LS_DRAFT);
      const draft = raw ? JSON.parse(raw) : null;
      if (Array.isArray(draft) && draft.every((r: any) => Array.isArray(r) && r.length === cols.length)) {
        setGrid(draft);
      } else {
        setGrid(Array.from({ length: BLANK_ROWS }, () => cols.map(() => '')));
      }
    } catch {
      setGrid(Array.from({ length: BLANK_ROWS }, () => cols.map(() => '')));
    }

    setVendors(loadVendors());

    const onStorage = (e: StorageEvent) => {
      if (e.key === LS_UNIFIED_COLUMNS) {
        const next = loadUnifiedColumns();
        setColumns(next);
        setVisible(loadVisible(next));
        setGrid(g => {
          if (g.length && g[0]?.length === next.length) return g;
          return Array.from({ length: BLANK_ROWS }, () => next.map(() => ''));
        });
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  /** ====== 유틸 ====== */
  const ensureRows = (need: number) => {
    setGrid(prev => {
      const add = Math.max(0, need - prev.length);
      if (add === 0) return prev;
      const extra = Array.from({ length: add }, () => columns.map(() => ''));
      return prev.concat(extra);
    });
  };
  const addRows = (n: number) => ensureRows(grid.length + n);

  const setCell = (r: number, c: number, val: string) => {
    setGrid(prev => {
      const next = prev.map(row => row.slice());
      next[r][c] = val;
      return next;
    });
  };

  const handlePaste = (r: number, c: number, e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData?.getData('text/plain') ?? '';
    if (!text) return;
    e.preventDefault();
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.length > 0);
    ensureRows(r + lines.length);
    setGrid(prev => {
      const next = prev.map(row => row.slice());
      lines.forEach((line, ri) => {
        const cells = line.split('\t');
        cells.forEach((v, ci) => {
          const col = c + ci;
          if (col < columns.length && r + ri < next.length) next[r + ri][col] = v;
        });
      });
      return next;
    });
  };

  /** ====== 저장 공통 로직 ====== */
  const doSubmit = (force: boolean) => {
    const payload: Row[] = [];
    const norm = (s:any) => (s ?? '').toString().trim();

    // 1) 입력 → 객체화 + 신규행 자동 메타 주입(기기관리/안내분류)
    grid.forEach(row => {
      if (row.some(v => (v ?? '').toString().trim() !== '')) {
        const obj: Row = {};
        columns.forEach((col, i) => { obj[col] = row[i] ?? ''; });

        // 안내분류 자동 주입 (빈칸일 때만)
        const vendor = norm(obj['거래처분류']);
        if (!norm(obj['안내분류'])) {
          const guide = getGuideByVendor(vendor);
          if (guide) obj['안내분류'] = guide;
        }

        // 기기관리 메타 자동 주입 (빈칸일 때만 덮기)
        const devId = norm(obj['기기번호']);
        if (devId) {
          const meta = lookupDeviceMeta(devId); // { '구매/렌탈','기종','에러횟수','제품' } | null
          if (meta) {
            if (!norm(obj['구매/렌탈'])) obj['구매/렌탈'] = norm(meta['구매/렌탈']);
            if (!norm(obj['기종']))       obj['기종']       = norm(meta['기종']);
            if (!norm(obj['에러횟수']))   obj['에러횟수']   = norm(meta['에러횟수']);
            if (!norm(obj['제품']))       obj['제품']       = norm(meta['제품']);
          }
        }

        payload.push(obj);
      }
    });
    if (!payload.length) { alert('전송할 데이터가 없습니다.'); return; }

    // 2) 검증 (force가 아니면 막기)
    let missing: string[] = [];
    let conflicts: string[] = [];

    if (!force) {
      // 등록되지 않는 기기(기기관리 7개에 없음) → lookup 실패 기준
      missing = Array.from(new Set(
        payload
          .map(r => norm(r['기기번호']))
          .filter(id => !!id && !lookupDeviceMeta(id))
      ));

      // 통합관리에서 대여중(반납완료일 빈칸)과 충돌
      try {
        const raw = localStorage.getItem(LS_UNIFIED_ROWS);
        const existing: Row[] = raw ? JSON.parse(raw) : [];
        const inUse = new Set(
          (Array.isArray(existing) ? existing : [])
            .filter(r => {
              const dev = norm(r['기기번호']);
              if (!dev) return false;
              const returned = norm(r['반납완료일']) || norm(r['반납완료']);
              return returned === '';
            })
            .map(r => norm(r['기기번호']))
        );
        conflicts = Array.from(new Set(
          payload.map(r => norm(r['기기번호'])).filter(dev => !!dev && inUse.has(dev))
        ));
      } catch { conflicts = []; }

      if (missing.length || conflicts.length) {
        const lines: string[] = [];
        if (missing.length)   lines.push(`등록되지 않는 기기 ---> ${missing.join(', ')}`);
        if (conflicts.length) lines.push(`대여중인 기기 ---> ${conflicts.join(', ')}`);
        alert(lines.join('\n'));
        return; // 입력값 유지
      }
    }

    // 3) 저장 (통합관리는 변경/삭제 금지: 첫 빈행부터 치환 삽입)
    try {
      let existing: Row[] = [];
      try {
        const raw = localStorage.getItem(LS_UNIFIED_ROWS);
        existing = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(existing)) existing = [];
      } catch { existing = []; }

      const cur: Row[] = existing.slice();
      const cols = (columns && columns.length ? columns : FALLBACK_COLUMNS);
      const isEmptyRow = (r: Row) => cols.every(col => ((r?.[col] ?? '').toString().trim() === ''));

      let insertAt = cur.findIndex(isEmptyRow);
      if (insertAt === -1) insertAt = cur.length;

      let removeCount = 0;
      while (
        removeCount < payload.length &&
        insertAt + removeCount < cur.length &&
        isEmptyRow(cur[insertAt + removeCount])
      ) {
        removeCount++;
      }

      cur.splice(insertAt, removeCount, ...payload);

      localStorage.setItem(LS_UNIFIED_ROWS, JSON.stringify(cur));
      window.dispatchEvent(new Event('unified_rows_updated'));

      // 저장 직후 재분류(온라인/보건소/조리원) 전체 리빌드
      rebuildCategoryViewsFromRules();

      alert(`${force ? '강제 전송 완료' : '전송 완료'}: ${payload.length}건 추가되었습니다.`);

      // draft 초기화
      localStorage.removeItem(LS_DRAFT);
      setGrid(Array.from({ length: BLANK_ROWS }, () => columns.map(() => '')));
      setDragSel(null);
    } catch {
      alert('저장 중 오류가 발생했습니다.');
    }
  };

  const handleSubmit = () => doSubmit(false);
  const handleForceSubmit = () => doSubmit(true);

  /** 거래처 드롭다운 필터링 */
  const filteredVendors = useMemo(() => {
    const q = vendorQuery.trim();
    return q ? vendors.filter(v => v.includes(q)) : vendors;
  }, [vendorQuery, vendors]);

  const addVendor = () => {
    const name = (prompt('새 거래처명을 입력하세요.') || '').trim();
    if (!name) return;
    const next = Array.from(new Set([name, ...vendors]));
    setVendors(next);
    saveVendors(next);
    if (vendorOpen) {
      setCell(vendorOpen.r, vendorOpen.c, name);
      setVendorOpen(null);
    }
  };

  /** ====== 렌더 ====== */
  const tableBoxCls =
    'overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)] min-h-[260px] pb-2';

  return (
    <div className="bg-white border rounded shadow-sm mt-8">
      {/* 헤더 */}
      <div className="px-4 py-3 font-semibold border-b flex items-center justify-between">
        <span>신규가입</span>
        <div className="flex items-center gap-2">
          <button
            className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50"
            onClick={() => addRows(10)}
            title="빈 행 10개 추가"
          >
            행 10 추가
          </button>
          <button
            className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50"
            onClick={() => setShowEditor(true)}
          >
            양식 수정
          </button>
        </div>
      </div>

      {/* 본문 */}
      <div className="p-4 space-y-4">
        <div
          ref={tableHostRef}
          tabIndex={0}
          className={tableBoxCls + ' outline-none'}
          onMouseDown={() => tableHostRef.current?.focus()}
        >
          <table className="min-w-[1600px] w-full text-sm border-collapse">
            <colgroup>
              {visible.map(h => (
                <col key={h} style={{ width: (COL_WIDTH[h] ?? DEFAULT_COL_W) + 'px' }} />
              ))}
            </colgroup>

            <thead className="bg-gray-100 sticky top-0 z-10">
              <tr>
                {visible.map(h => (
                  <th key={h} className="border px-2 py-[0.35rem] whitespace-nowrap text-center text-[0.7rem]">
                    {label(h)}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {grid.map((row, r) => (
                <tr key={r}>
                  {visibleIdx.map((ciVisible, vc) => {
                    const colName = columns[ciVisible];
                    const val = row[ciVisible] ?? '';
                    const isVendor = colName === '거래처분류';
                    const selected = isSelected(r, vc);
                    return (
                      <td
                        key={ciVisible}
                        className={`border px-1 py-[0.25rem] ${selected ? 'bg-blue-50' : ''}`}
                        onMouseDown={() => startSel(r, vc)}
                        onMouseEnter={() => extendSel(r, vc)}
                      >
                        <div className="relative">
                          <input
                            className={`w-full px-1 py-[0.2rem] text-[0.7rem] bg-transparent outline-none focus:outline-none focus:ring-0 border-0 ${isVendor ? 'pr-8' : ''}`}
                            value={val}
                            onChange={(e) => setCell(r, ciVisible, e.target.value)}
                            onPaste={(e) => handlePaste(r, ciVisible, e)}
                            onFocus={() => {
                              if (isVendor) {
                                setVendorQuery('');
                                setVendorDeleteMode(false);
                                setVendorDeleteSel(new Set());
                                setVendorOpen({ r, c: ciVisible });
                              } else {
                                if (vendorOpen) {
                                  setVendorOpen(null);
                                  setVendorDeleteMode(false);
                                  setVendorDeleteSel(new Set());
                                }
                              }
                            }}
                          />

                          {/* 거래처 선택/삭제 팝오버 */}
                          {isVendor && vendorOpen && vendorOpen.r === r && vendorOpen.c === ciVisible && (
                            <div
                              ref={vendorPopoverRef}
                              className="absolute z-30 mt-1 w-[240px] bg-white border rounded shadow"
                              onMouseDown={(e) => e.stopPropagation()}
                            >
                              {/* 상단: 검색 + 삭제모드 토글/동작 */}
                              <div className="p-2 border-b space-y-2">
                                <input
                                  className="w-full border rounded px-2 py-1 text-xs"
                                  placeholder="검색"
                                  value={vendorQuery}
                                  onChange={(e) => setVendorQuery(e.target.value)}
                                />
                                <div className="flex gap-2">
                                  {!vendorDeleteMode ? (
                                    <button
                                      className="px-2 py-1 text-xs border rounded hover:bg-gray-50"
                                      onClick={() => { setVendorDeleteMode(true); setVendorDeleteSel(new Set()); }}
                                    >
                                      삭제모드
                                    </button>
                                  ) : (
                                    <>
                                      <button
                                        className="px-2 py-1 text-xs border rounded text-red-600 hover:bg-red-50"
                                        onClick={() => {
                                          if (vendorDeleteSel.size === 0) { alert('삭제할 거래처를 선택하세요.'); return; }
                                          if (!confirm('선택한 거래처를 삭제할까요?')) return;
                                          const next = vendors.filter(v => !vendorDeleteSel.has(v));
                                          setVendors(next);
                                          saveVendors(next);
                                          setVendorDeleteMode(false);
                                          setVendorDeleteSel(new Set());
                                        }}
                                      >
                                        선택삭제
                                      </button>
                                      <button
                                        className="px-2 py-1 text-xs border rounded hover:bg-gray-50"
                                        onClick={() => { setVendorDeleteMode(false); setVendorDeleteSel(new Set()); }}
                                      >
                                        취소
                                      </button>
                                    </>
                                  )}
                                  {!vendorDeleteMode && (
                                    <button
                                      className="ml-auto px-2 py-1 text-xs border rounded hover:bg-blue-50 text-blue-600"
                                      onClick={addVendor}
                                    >
                                      + 신규입력
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* 목록 */}
                              <div className="max-h-44 overflow-auto">
                                {filteredVendors.map(v => (
                                  <div
                                    key={v}
                                    className={`px-3 py-1 text-xs ${vendorDeleteMode ? '' : 'hover:bg-gray-100 cursor-pointer'}`}
                                    onClick={() => {
                                      if (vendorDeleteMode) return;
                                      setCell(r, ciVisible, v);
                                      setVendorOpen(null);
                                      // 안내분류 미리 채움(저장은 doSubmit에서 다시 주입)
                                      const guide = getGuideByVendor(v);
                                      if (guide) {
                                        const gi = columns.indexOf('안내분류');
                                        if (gi >= 0 && !(row[gi] ?? '').trim()) {
                                          setCell(r, gi, guide);
                                        }
                                      }
                                    }}
                                  >
                                    {vendorDeleteMode ? (
                                      <label className="flex items-center gap-2">
                                        <input
                                          type="checkbox"
                                          className="scale-90"
                                          checked={vendorDeleteSel.has(v)}
                                          onChange={(e) => {
                                            setVendorDeleteSel(prev => {
                                              const n = new Set(prev);
                                              if (e.target.checked) n.add(v); else n.delete(v);
                                              return n;
                                            });
                                          }}
                                        />
                                        <span className="truncate" title={v}>{v}</span>
                                      </label>
                                    ) : (
                                      <span className="truncate" title={v}>{v}</span>
                                    )}
                                  </div>
                                ))}
                                {filteredVendors.length === 0 && (
                                  <div className="px-3 py-2 text-[11px] text-gray-500">검색 결과 없음</div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 액션 버튼 */}
        <div className="flex justify-end gap-2">
          <button
            className="px-3 py-1.5 text-sm rounded border border-red-600 text-red-600 hover:bg-red-50"
            onClick={handleForceSubmit}
            title="검증을 무시하고 강제로 저장합니다"
          >
            강제전송
          </button>
          <button
            className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
            onClick={handleSubmit}
          >
            전송
          </button>
        </div>
      </div>

      {/* 양식 수정 모달 */}
      {showEditor && (
        <div className="fixed inset-0 bg-black/30 z-40 flex items-center justify-center">
          <div className="bg-white w-[504px] max-w-[95vw] rounded shadow-lg">
            <div className="px-4 py-3 border-b font-semibold flex items-center justify-between">
              <span>양식 수정</span>
              <button
                className="text-sm px-2 py-1 border rounded hover:bg-gray-50"
                onClick={() => setShowEditor(false)}
              >
                닫기
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="text-sm text-gray-600">표시할 항목을 선택하세요. (순서는 통합관리 순서를 따릅니다)</div>
              <div className="max-h-[50vh] overflow-auto grid grid-cols-2 gap-2">
                {columns.map(col => {
                  const checked = visible.includes(col);
                  return (
                    <label key={col} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="scale-110"
                        checked={checked}
                        onChange={(e) => {
                          setVisible(prev => {
                            if (e.target.checked) {
                              const set = new Set(prev);
                              set.add(col);
                              return columns.filter(c => (set as any).has(c));
                            }
                            return prev.filter(x => x !== col);
                          });
                        }}
                      />
                      <span>{label(col)}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="px-4 py-3 border-t flex justify-end gap-2">
              <button
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                onClick={() => { saveVisible(visible); setShowEditor(false); }}
              >
                적용
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}









