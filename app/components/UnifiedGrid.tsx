'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  applyAutoToRowInPlace,
  buildDeviceIndex,
  rebuildCategoryViewsFromRules,
  updateCategoryForVendors,
  type Category,
} from '../lib/rules';
import { GuideRuleModal, CategoryRuleModal } from './RuleModals';

type Row = Record<string, string>;

const FALLBACK_COLUMNS: string[] = [
  '거래처분류','상태','안내분류','구매/렌탈','기기번호','기종','에러횟수','제품',
  '수취인명','연락처1','연락처2','계약자주소','택배발송일','시작일','종료일',
  '반납요청일','반납완료일','특이사항1','특이사항2','총연장횟수','신청일',
  '0차연장','1차연장','2차연장','3차연장','4차연장','5차연장',
];

const LS_UNIFIED_COLUMNS = 'unified_columns';
const LS_UNIFIED_ROWS    = 'unified_rows';

const CAT_PREFIX         = 'cat_rows:';          // cat_rows:온라인 / cat_rows:보건소 / cat_rows:조리원
const COLW_PREFIX        = 'col_widths:';        // col_widths:통합관리 / ...
const CELLSTYLE_PREFIX   = 'cell_styles:';       // 색상 저장

const LABELS: Record<string, string> = { 계약자주소: '주소', 특이사항1: '특이사항' };
const label = (k: string) => LABELS[k] ?? k;

const DEFAULT_W = 120;
const BASE_WIDTHS: Record<string, number> = { 계약자주소: 360 };
const BLANK_ROWS = 20;

const CHECKBOX_W = 28;

const BG_COLORS = ['#FDE68A','#BBF7D0','#BFDBFE','#FCA5A5','#F5D0FE','#DDD6FE','#FECACA','#D1FAE5'];
const TEXT_COLORS = ['#111827','#EF4444','#2563EB','#16A34A','#F97316','#7C3AED','#6B7280','#8B5E3C'];

function storageKeyFor(viewId: string) {
  return viewId === '통합관리' ? LS_UNIFIED_ROWS : CAT_PREFIX + viewId;
}
function cellStyleKey(viewId: string) { return CELLSTYLE_PREFIX + viewId; }

function loadColumns(): string[] {
  try {
    const raw = localStorage.getItem(LS_UNIFIED_COLUMNS);
    const arr = raw ? JSON.parse(raw) : null;
    return Array.isArray(arr) && arr.length ? arr : FALLBACK_COLUMNS;
  } catch {
    return FALLBACK_COLUMNS;
  }
}

export default function UnifiedGrid({ viewId }: { viewId: '통합관리'|'온라인'|'보건소'|'조리원' }) {
  // ▼ 화면 플래그
  const isUnified = viewId === '통합관리';
  const isChildView = !isUnified;

  /** columns */
  const [columns, setColumns] = useState<string[]>([]);
  const colsRender = columns.length ? columns : FALLBACK_COLUMNS;
  useEffect(() => { setColumns(loadColumns()); }, [viewId]);

  /** rows */
  const [rows, setRows] = useState<Row[]>([]);
  const loadRows = () => {
    try {
      const raw = localStorage.getItem(storageKeyFor(viewId));
      const list = raw ? JSON.parse(raw) : [];
      if (Array.isArray(list) && list.length) setRows(list);
      else {
        setRows(Array.from({ length: BLANK_ROWS }, () => Object.fromEntries(colsRender.map(c => [c, '']))));
      }
    } catch {
      setRows(Array.from({ length: BLANK_ROWS }, () => Object.fromEntries(colsRender.map(c => [c, '']))));
    }
  };
  const saveRows = (next: Row[]) => {
    localStorage.setItem(storageKeyFor(viewId), JSON.stringify(next));
    setRows(next);
    window.dispatchEvent(new Event('unified_rows_updated'));
  };

  /** column widths (저장/복구) + 드래그 리사이즈 */
  const COLW_KEY = COLW_PREFIX + viewId;
  const [colW, setColW] = useState<Record<string, number>>({});
  useEffect(() => {
    const raw = localStorage.getItem(COLW_KEY);
    const base: Record<string, number> = raw ? JSON.parse(raw) : {};
    const merged: Record<string, number> = {};
    colsRender.forEach(c => { merged[c] = base[c] ?? BASE_WIDTHS[c] ?? DEFAULT_W; });
    setColW(merged);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewId, colsRender.join('|')]);

  const dragInfo = useRef<{ col: string; startX: number; startW: number } | null>(null);
  useEffect(() => {
    const mm = (e: MouseEvent) => {
      if (!dragInfo.current) return;
      const { col, startX, startW } = dragInfo.current;
      const w = Math.max(60, startW + (e.clientX - startX));
      setColW(prev => ({ ...prev, [col]: w }));
    };
    const mu = () => {
      if (!dragInfo.current) return;
      dragInfo.current = null;
      localStorage.setItem(COLW_KEY, JSON.stringify(colW));
    };
    window.addEventListener('mousemove', mm);
    window.addEventListener('mouseup', mu);
    return () => {
      window.removeEventListener('mousemove', mm);
      window.removeEventListener('mouseup', mu);
    };
  }, [COLW_KEY, colW]);

  /** 삭제/체크 */
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const deleteSelected = () => {
    const next = rows.filter((_, i) => !checked[i]);
    const safe = next.length ? next : Array.from({ length: BLANK_ROWS }, () => Object.fromEntries(colsRender.map(c => [c, ''])));
    saveRows(safe);
    setChecked({});
  };

  /** 붙여넣기 + 자동행확장 */
  const ensureRows = (need: number) => {
    if (rows.length >= need) return;
    const extra = Array.from({ length: need - rows.length }, () => Object.fromEntries(colsRender.map(c => [c, ''])));
    setRows(prev => prev.concat(extra));
  };
  const onPaste = (ri: number, col: string, e: React.ClipboardEvent<HTMLInputElement|HTMLDivElement>) => {
    const text = (e as any).clipboardData?.getData('text/plain') ?? '';
    if (!text) return;
    e.preventDefault();
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(Boolean);
    ensureRows(ri + lines.length);
    setRows(prev => {
      const next = prev.map(r => ({ ...r }));
      const baseIdx = colsRender.indexOf(col);
      lines.forEach((ln, rdx) => {
        const cells = ln.split('\t');
        cells.forEach((v, cdx) => {
          const ci = baseIdx + cdx;
          if (ci < colsRender.length && ri + rdx < next.length) next[ri + rdx][colsRender[ci]] = v;
        });
      });
      return next;
    });
  };

  /** 열 이동 / 열 추가 / 열 삭제 */
  const [reorderMode, setReorderMode] = useState(false);
  const moveCol = (idx: number, dir: -1 | 1) => {
    const cols = columns.slice();
    const ni = idx + dir;
    if (ni < 0 || ni >= cols.length) return;
    const [it] = cols.splice(idx, 1);
    cols.splice(ni, 0, it);
    localStorage.setItem(LS_UNIFIED_COLUMNS, JSON.stringify(cols));
    setColumns(cols);
    window.dispatchEvent(new Event('unified_columns_updated'));
  };
  const deleteCol = (idx: number) => {
    const colName = columns[idx];
    if (!colName) return;
    if (!confirm(`"${colName}" 열을 삭제할까요? (해당 열의 데이터도 함께 제거됩니다)`)) return;
    const newCols = columns.filter((_, i) => i !== idx);
    localStorage.setItem(LS_UNIFIED_COLUMNS, JSON.stringify(newCols));
    setColumns(newCols);
    const nextRows = rows.map(r => { const nr = { ...r }; delete nr[colName]; return nr; });
    saveRows(nextRows);
    try {
      const raw = localStorage.getItem(COLW_KEY);
      const prev = raw ? JSON.parse(raw) : {};
      if (prev && typeof prev === 'object') {
        delete prev[colName];
        localStorage.setItem(COLW_KEY, JSON.stringify(prev));
      }
    } catch {}
    setColW(prev => { const n = { ...prev }; delete n[colName]; return n; });
    window.dispatchEvent(new Event('unified_columns_updated'));
  };

  const [showAdd, setShowAdd] = useState(false);
  const [newColName, setNewColName] = useState('');
  const [insertTarget, setInsertTarget] = useState<string>('(끝)');
  const [insertAfter, setInsertAfter] = useState<boolean>(true);
  const doAddColumn = () => {
    const name = newColName.trim();
    if (!name) { alert('새 항목명을 입력하세요.'); return; }
    const cols = colsRender.slice();
    if (cols.includes(name)) { alert('이미 존재하는 항목명입니다.'); return; }
    if (insertTarget === '(끝)') cols.push(name);
    else {
      const idx = cols.indexOf(insertTarget);
      const pos = insertAfter ? idx + 1 : idx;
      cols.splice(pos, 0, name);
    }
    localStorage.setItem(LS_UNIFIED_COLUMNS, JSON.stringify(cols));
    setColumns(cols);
    setShowAdd(false);
    setNewColName('');
    window.dispatchEvent(new Event('unified_columns_updated'));
  };

  /** 필터(엑셀형 팝업) */
  const [filterMode, setFilterMode] = useState(false);
  const [filters, setFilters] = useState<Record<string, Set<string>>>({});
  const [sortMap, setSortMap] = useState<Record<string, 'asc'|'desc'|null>>({});
  const [openFilterCol, setOpenFilterCol] = useState<string | null>(null);

  const uniqueValues = (col: string) => {
    const vals = new Set<string>();
    rows.forEach(r => vals.add((r[col] ?? '').toString()));
    return Array.from(vals).sort();
  };

  const filteredRows = useMemo(() => {
    const activeCols = Object.keys(filters).filter(c => (filters[c]?.size ?? 0) > 0);
    let base = rows.filter(r => activeCols.every(c => filters[c]!.has((r[c] ?? '').toString())));
    const lastSortedCol = Object.keys(sortMap).find(c => !!sortMap[c]);
    if (lastSortedCol) {
      const dir = sortMap[lastSortedCol];
      base = base.slice().sort((a,b)=>{
        const av = (a[lastSortedCol] ?? '').toString();
        const bv = (b[lastSortedCol] ?? '').toString();
        return dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      });
    }
    return base;
  }, [rows, filters, sortMap]);

  /** 드래그 선택 & 복사 */
  const tableHostRef = useRef<HTMLDivElement>(null);
  const [sel, setSel] = useState<{ r1: number; c1: number; r2: number; c2: number } | null>(null);
  const [draggingSel, setDraggingSel] = useState(false);
  const isSelected = (r: number, c: number) => {
    if (!sel) return false;
    const [r1, r2] = [Math.min(sel.r1, sel.r2), Math.max(sel.r1, sel.r2)];
    const [c1, c2] = [Math.min(sel.c1, sel.c2), Math.max(sel.c1, sel.c2)];
    return r >= r1 && r <= r2 && c >= c1 && c <= c2;
  };
  const startSel = (r: number, c: number) => { setSel({ r1: r, c1: c, r2: r, c2: c }); setDraggingSel(true); };
  const extendSel = (r: number, c: number) => { if (draggingSel) setSel(s => (s ? { ...s, r2: r, c2: c } : s)); };
  useEffect(() => {
    const up = () => setDraggingSel(false);
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, []);
  const copySelection = async () => {
    if (!sel) return;
    const [r1, r2] = [Math.min(sel.r1, sel.r2), Math.max(sel.r1, sel.r2)];
    const [c1, c2] = [Math.min(sel.c1, sel.c2), Math.max(sel.c1, sel.c2)];
    const body = filteredRows.slice(r1, r2 + 1).map(r =>
      colsRender.slice(c1, c2 + 1).map(c => (r[c] ?? '').toString()).join('\t')
    ).join('\n');
    try { await navigator.clipboard.writeText(body); } catch {
      const ta = document.createElement('textarea');
      ta.value = body; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
    }
  };
  useEffect(() => {
    const host = tableHostRef.current;
    if (!host) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        e.preventDefault(); copySelection();
      }
    };
    host.addEventListener('keydown', onKey);
    return () => host.removeEventListener('keydown', onKey);
  }, [sel, filteredRows, colsRender]);

  /** 셀 색상 저장 */
  type Style = { bg?: string; color?: string };
  const [cellStyles, setCellStyles] = useState<Record<string, Style>>(() => {
    try { return JSON.parse(localStorage.getItem(cellStyleKey(viewId)) || '{}'); } catch { return {}; }
  });
  useEffect(() => {
    localStorage.setItem(cellStyleKey(viewId), JSON.stringify(cellStyles));
  }, [cellStyles, viewId]);

  const keyOf = (r:number,c:number) => `${r}:${c}`;
  const applyColor = (mode: 'bg'|'text', color?: string) => {
    setCellStyles(prev => {
      const next = { ...prev };
      if (sel) {
        const [r1, r2] = [Math.min(sel.r1, sel.r2), Math.max(sel.r1, sel.r2)];
        const [c1, c2] = [Math.min(sel.c1, sel.c2), Math.max(sel.c1, sel.c2)];
        for (let r=r1; r<=r2; r++) {
          for (let c=c1; c<=c2; c++) {
            const k = keyOf(r,c);
            const cur = { ...(next[k] || {}) };
            if (mode==='bg') { if (color) cur.bg = color; else delete cur.bg; }
            else { if (color) cur.color = color; else delete cur.color; }
            if (!cur.bg && !cur.color) delete next[k]; else next[k] = cur;
          }
        }
      }
      const checkedRows = Object.keys(checked).filter(k => checked[+k]).map(Number);
      if (checkedRows.length) {
        checkedRows.forEach(r => {
          for (let c=0; c<colsRender.length; c++) {
            const k = keyOf(r,c);
            const cur = { ...(next[k] || {}) };
            if (mode==='bg') { if (color) cur.bg = color; else delete cur.bg; }
            else { if (color) cur.color = color; else delete cur.color; }
            if (!cur.bg && !cur.color) delete next[k]; else next[k] = cur;
          }
        });
      }
      return next;
    });
  };

  /** 초기 로드 & 규칙 이벤트 수신 */
  useEffect(() => {
    loadRows();
    const h = () => loadRows();
    window.addEventListener('unified_rows_updated', h);
    window.addEventListener('rules:category_rebuilt', h);
    window.addEventListener('storage', h as any);
    return () => {
      window.removeEventListener('unified_rows_updated', h);
      window.removeEventListener('rules:category_rebuilt', h);
      window.removeEventListener('storage', h as any);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewId, colsRender.join('|')]);

  const data = filteredRows;

  // ---- 새 버튼/모달 상태 ----
  const [showGuide, setShowGuide] = useState(false);
  const [showCategory, setShowCategory] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveDest, setMoveDest] = useState<Category>('온라인');

  // 화면 바뀌면 모달/팝오버 닫기
  useEffect(() => {
    setShowGuide(false);
    setShowCategory(false);
    setMoveOpen(false);
  }, [viewId]);

  // 이동 실행: 선택된 행들의 거래처 기준으로 규칙 갱신 후 카테고리 뷰 재구성
  const doMove = () => {
    const vendors = Object.keys(checked)
      .filter(k => checked[+k])
      .map(k => (data[+k]?.['거래처분류'] ?? '').toString().trim())
      .filter(Boolean);
    if (vendors.length === 0) { alert('이동할 행을 체크하세요.'); return; }

    updateCategoryForVendors(Array.from(new Set(vendors)), moveDest);
    setMoveOpen(false);
    setChecked({});
    if (viewId !== '통합관리') {
      rebuildCategoryViewsFromRules();
    }
  };

  // 행 값 변경시 자동 적용(거래처→안내분류, 기기번호→기기정보)
  const deviceIndexRef = useRef<Record<string, any> | null>(null);
  const ensureDeviceIdx = () => { if (!deviceIndexRef.current) deviceIndexRef.current = buildDeviceIndex(); };

  return (
    <div className="bg-white border rounded shadow-sm">
      {/* 헤더 바 */}
      <div className="px-4 py-3 font-semibold border-b flex items-center gap-2">
        <span className={isUnified ? 'text-blue-700' : ''}>{viewId}</span>

        {/* ▼ 버튼들 (조건부 렌더링) */}
        {isUnified && (
          <>
            <button
              className="ml-3 px-3 py-1.5 text-sm border rounded hover:bg-gray-50"
              onClick={()=>setShowGuide(true)}
              title="거래처→안내분류 규칙 관리"
            >안내분류</button>

            <button
              className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50"
              onClick={()=>setShowCategory(true)}
              title="거래처→온라인/보건소/조리원 규칙 관리"
            >분류</button>
          </>
        )}

        {isChildView && (
          <div className="relative">
            <button
              className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50"
              onClick={()=>setMoveOpen(v=>!v)}
              title="체크한 행을 선택 카테고리로 이동"
            >이동</button>
            {moveOpen && (
              <div className="absolute z-30 mt-2 bg-white border rounded shadow p-2 w-[180px]">
                <div className="text-xs mb-2">대상 카테고리</div>
                <div className="flex flex-col gap-1 text-sm mb-2">
                  {(['온라인','보건소','조리원'] as Category[]).map(c => (
                    <label key={c} className="flex items-center gap-2">
                      <input type="radio" name="mv" checked={moveDest===c} onChange={()=>setMoveDest(c)} />
                      {c}
                    </label>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button className="px-2 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700" onClick={doMove}>적용</button>
                  <button className="px-2 py-1 text-sm border rounded hover:bg-gray-50" onClick={()=>setMoveOpen(false)}>닫기</button>
                </div>
                <div className="text-[11px] text-gray-500 mt-2">* 규칙으로 저장되며 뷰가 재구성됩니다.</div>
              </div>
            )}
          </div>
        )}

        <div className="ml-3 flex items-center gap-2">
          <button
            className={`px-3 py-1.5 text-sm border rounded ${filterMode ? 'bg-blue-50 border-blue-300 text-blue-700' : 'hover:bg-gray-50'}`}
            onClick={() => setFilterMode(v => !v)}
          >필터</button>

          <button
            className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50"
            onClick={() => {
              const header = colsRender.join(',');
              const body = data.map(r =>
                colsRender.map(c => {
                  const v = (r[c] ?? '').toString().replace(/"/g, '""');
                  return /[",\n]/.test(v) ? `"${v}"` : v;
                }).join(',')
              ).join('\n');
              const csv = header + '\n' + body;
              const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url; a.download = `${viewId}_export.csv`;
              document.body.appendChild(a); a.click();
              document.body.removeChild(a); URL.revokeObjectURL(url);
            }}
          >다운로드(엑셀)</button>

          <ColorMenu onApply={applyColor} />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50"
            onClick={() => {
              const next = rows.concat(
                Array.from({ length: 10 }, () => Object.fromEntries(colsRender.map(c => [c, ''])))
              );
              saveRows(next);
            }}
          >행 10 추가</button>

          <button className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50" onClick={() => setShowAdd(true)}>양식 추가(열)</button>

          <button className={`px-3 py-1.5 text-sm border rounded ${reorderMode ? 'bg-blue-50 border-blue-300' : 'hover:bg-gray-50'}`} onClick={() => setReorderMode(v => !v)}>열 이동 모드</button>

          <button className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50" onClick={deleteSelected}>선택 삭제</button>
        </div>
      </div>

      {/* 표 */}
      <div className="p-2">
        <div
          ref={tableHostRef}
          tabIndex={0}
          className="w-full max-h-[calc(100vh-220px)] overflow-auto border rounded outline-none"
        >
          <table className="min-w-[3200px] w-max text-sm border-collapse">
            <colgroup>
              <col style={{ width: CHECKBOX_W }} />
              {colsRender.map(c => <col key={c} style={{ width: (colW[c] ?? DEFAULT_W) + 'px' }} />)}
            </colgroup>

            <thead className="bg-gray-100 sticky top-0 z-10">
              <tr>
                <th className="border px-2 py-[0.28rem] w-[28px] min-w-[28px] max-w-[28px] text-center">✔</th>

                {colsRender.map((c, idx) => {
                  const activeFilter = (filters[c]?.size ?? 0) > 0 || !!sortMap[c];
                  const allowFilter = c !== '거래처분류'; // 거래처분류: 헤더 필터 아이콘 제거
                  return (
                    <th key={c} className="border px-2 py-[0.28rem] relative select-none">
                      <div className={`flex items-center gap-2 ${c==='계약자주소'?'justify-center':'justify-start'}`}>
                        <span className="whitespace-nowrap">{label(c)}</span>

                        {filterMode && allowFilter && (
                          <button
                            className={`px-1 text-[0.7rem] leading-none ${activeFilter ? 'text-blue-600' : 'text-blue-500'} hover:bg-blue-50 rounded`}
                            title="필터"
                            onClick={() => setOpenFilterCol(openFilterCol === c ? null : c)}
                          >▼</button>
                        )}

                        {reorderMode && (
                          <span className="flex gap-1">
                            <button className="px-1 text-xs border rounded hover:bg-gray-50" onClick={() => moveCol(idx, -1)} title="왼쪽으로">◀</button>
                            <button className="px-1 text-xs border rounded hover:bg-gray-50" onClick={() => moveCol(idx, 1)} title="오른쪽으로">▶</button>
                            <button className="px-1 text-xs border rounded hover:bg-red-50 text-red-600" onClick={() => deleteCol(idx)} title="열 삭제">✕</button>
                          </span>
                        )}
                      </div>

                      {/* 폭 조절 핸들 */}
                      <div
                        className="absolute top-0 -right-2 h-full w-5 cursor-col-resize hover:bg-gray-200/40"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          dragInfo.current = { col: c, startX: e.clientX, startW: colW[c] ?? DEFAULT_W };
                        }}
                      />

                      {/* 필터 팝업 */}
                      {allowFilter && openFilterCol === c && (
                        <ExcelFilterPopover
                          title={label(c)}
                          allValues={uniqueValues(c)}
                          currentSet={filters[c] ?? new Set()}
                          currentSort={sortMap[c] ?? null}
                          onClose={() => setOpenFilterCol(null)}
                          onApply={(set, sort) => {
                            setFilters(prev => {
                              const next = { ...prev };
                              if (set.size === 0) delete next[c]; else next[c] = set;
                              return next;
                            });
                            setSortMap(prev => ({ ...prev, [c]: sort }));
                            setOpenFilterCol(null);
                          }}
                        />
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody>
              {data.map((row, rIdx) => (
                <tr key={rIdx}>
                  <td className="border text-center w-[28px] min-w-[28px] max-w-[28px]">
                    <input
                      type="checkbox"
                      checked={!!checked[rIdx]}
                      onChange={(e) => setChecked(prev => ({ ...prev, [rIdx]: e.target.checked }))}
                    />
                  </td>

                  {colsRender.map((c, ci) => {
                    const style = cellStyles[keyOf(rIdx, ci)] ?? {};
                    const val = row[c] ?? '';
                    return (
                      <td
                        key={ci}
                        className={`border px-1 py-[0.234rem] ${isSelected(rIdx, ci) ? 'bg-blue-50' : ''}`}
                        onMouseDown={() => startSel(rIdx, ci)}
                        onMouseEnter={() => extendSel(rIdx, ci)}
                        onContextMenu={(e) => { e.stopPropagation(); e.preventDefault(); }}
                        style={{ background: style.bg, color: style.color }}
                      >
                        <input
                          className="w-full px-1 py-[0.16rem] text-[0.81rem] bg-transparent border-0 outline-none focus:ring-0"
                          value={val}
                          onChange={(e) => {
                            const v = e.target.value;
                            setRows(prev => {
                              const next = prev.map(r => ({ ...r }));
                              next[rIdx][c] = v;

                              // 자동 적용: 거래처/기기번호 변경 시
                              if (c === '거래처분류' || c === '기기번호') {
                                if (!deviceIndexRef.current) deviceIndexRef.current = buildDeviceIndex();
                                applyAutoToRowInPlace(next[rIdx], deviceIndexRef.current || undefined);
                              }
                              return next;
                            });
                          }}
                          onBlur={() => saveRows(rows)}
                          onPaste={(e) => onPaste(rIdx, c, e)}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 양식 추가 모달 */}
      {showAdd && (
        <div className="fixed inset-0 z-40 bg-black/30 flex items-center justify-center">
          <div className="bg-white w-[520px] max-w-[95vw] rounded shadow">
            <div className="px-4 py-3 border-b font-semibold">양식 추가(열)</div>
            <div className="p-4 space-y-3 text-sm">
              <div>
                <div className="mb-1">새 항목명</div>
                <input className="w-full border rounded px-2 py-1" value={newColName} onChange={(e)=>setNewColName(e.target.value)} placeholder="예: 주소2" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="mb-1">삽입 기준 열</div>
                  <select className="w-full border rounded px-2 py-1" value={insertTarget} onChange={(e)=>setInsertTarget(e.target.value)}>
                    <option>(끝)</option>
                    {colsRender.map(c => <option key={c} value={c}>{label(c)}</option>)}
                  </select>
                </div>
                <div>
                  <div className="mb-1">위치</div>
                  <select className="w-full border rounded px-2 py-1" value={insertAfter ? 'after' : 'before'} onChange={(e)=>setInsertAfter(e.target.value === 'after')} disabled={insertTarget === '(끝)'}>
                    <option value="before">앞</option>
                    <option value="after">뒤</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="px-4 py-3 border-t flex justify-end gap-2">
              <button className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50" onClick={()=>setShowAdd(false)}>취소</button>
              <button className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700" onClick={doAddColumn}>추가</button>
            </div>
          </div>
        </div>
      )}

      {/* 규칙 모달 (통합관리에서만 표시) */}
      {isUnified && <GuideRuleModal open={showGuide} onClose={()=>setShowGuide(false)} />}
      {isUnified && <CategoryRuleModal open={showCategory} onClose={()=>setShowCategory(false)} />}
    </div>
  );
}

/** 엑셀식 필터 팝오버 */
function ExcelFilterPopover({
  title, allValues, currentSet, currentSort,
  onApply, onClose
}:{
  title: string;
  allValues: string[];
  currentSet: Set<string>;
  currentSort: 'asc'|'desc'|null;
  onApply: (sel:Set<string>, sort:'asc'|'desc'|null)=>void;
  onClose: ()=>void;
}) {
  const [search, setSearch] = useState('');
  const [temp, setTemp] = useState<Set<string>>(new Set(currentSet));
  const [sort, setSort] = useState<'asc'|'desc'|null>(currentSort);

  const filtered = useMemo(
    () => allValues.filter(v => v.toLowerCase().includes(search.toLowerCase())),
    [allValues, search]
  );
  const allChecked = filtered.length>0 && filtered.every(v => temp.has(v));
  const toggleAll = (checked:boolean) => {
    const next = new Set(temp);
    if (checked) filtered.forEach(v=>next.add(v)); else filtered.forEach(v=>next.delete(v));
    setTemp(next);
  };
  const toggle = (v:string, checked:boolean) => {
    const next = new Set(temp);
    if (checked) next.add(v); else next.delete(v);
    setTemp(next);
  };

  return (
    <div className="absolute z-40 mt-1 w-[260px] bg-white border rounded shadow">
      <div className="p-2 border-b text-sm font-semibold">{title}</div>

      <div className="p-2 flex gap-2">
        <button className={`px-2 py-1 text-xs border rounded ${sort==='asc'?'bg-blue-50 border-blue-300':''}`} onClick={()=>setSort('asc')}>텍스트 오름차순 정렬</button>
        <button className={`px-2 py-1 text-xs border rounded ${sort==='desc'?'bg-blue-50 border-blue-300':''}`} onClick={()=>setSort('desc')}>텍스트 내림차순 정렬</button>
      </div>

      <div className="px-2">
        <input className="w-full border rounded px-2 py-1 text-sm mb-2" placeholder="검색" value={search} onChange={(e)=>setSearch(e.target.value)} />
      </div>

      <div className="px-2 mb-2">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={allChecked} onChange={(e)=>toggleAll(e.target.checked)} />
          (모두 선택)
        </label>
      </div>

      <div className="max-h-56 overflow-auto px-2 pb-2">
        {filtered.map(v => (
          <label key={v || '(빈 값)'} className="flex items-center gap-2 text-sm py-0.5">
            <input type="checkbox" checked={temp.has(v)} onChange={(e)=>toggle(v,e.target.checked)} />
            <span className="truncate" title={v || '(빈 값)'}>{v || '(빈 값)'}</span>
          </label>
        ))}
        {filtered.length===0 && <div className="text-xs text-gray-400 py-2">검색 결과 없음</div>}
      </div>

      <div className="p-2 border-t flex justify-end gap-2">
        <button className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50" onClick={onClose}>취소</button>
        <button className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700" onClick={()=>onApply(temp, sort)}>확인</button>
      </div>
    </div>
  );
}

/** 칼라 메뉴 */
function ColorMenu({ onApply }:{ onApply:(mode:'bg'|'text', color?:string)=>void }) {
  const [open,setOpen]=useState(false);
  const [mode,setMode]=useState<'bg'|'text'>('bg');
  const BG_COLORS = ['#FDE68A','#BBF7D0','#BFDBFE','#FCA5A5','#F5D0FE','#DDD6FE','#FECACA','#D1FAE5'];
  const TEXT_COLORS = ['#1F2937','#0F766E','#1D4ED8','#B91C1C','#6D28D9','#047857','#DC2626','#111827'];
  return (
    <div className="relative">
      <button className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50" onClick={()=>setOpen(v=>!v)}>칼라</button>
      {open && (
        <div className="absolute z-40 mt-2 w-[220px] bg-white border rounded shadow p-3">
          <div className="flex gap-3 mb-2 text-sm">
            <label className="flex items-center gap-1">
              <input type="radio" checked={mode==='bg'} onChange={()=>setMode('bg')} /> 배경
            </label>
            <label className="flex items-center gap-1">
              <input type="radio" checked={mode==='text'} onChange={()=>setMode('text')} /> 글자
            </label>
          </div>
          <div className="grid grid-cols-8 gap-1 mb-2">
            {(mode==='bg'?BG_COLORS:TEXT_COLORS).map(c=>(
              <button
                key={c}
                className="h-6 rounded border flex items-center justify-center"
                style={{
                  background: mode==='bg'?c:'white',
                  borderColor: mode==='text'?c:undefined
                }}
                title={c}
                onClick={()=>{ onApply(mode, c); setOpen(false); }}
              >
                {mode==='text' && <span style={{color:c,fontSize:12,lineHeight:1}}>가</span>}
              </button>
            ))}
          </div>
          <div className="flex justify-between">
            <button className="text-xs px-2 py-1 border rounded hover:bg-gray-50" onClick={()=>{ onApply(mode, undefined); setOpen(false); }}>지우기</button>
            <button className="text-xs px-2 py-1 border rounded hover:bg-gray-50" onClick={()=>setOpen(false)}>닫기</button>
          </div>
        </div>
      )}
    </div>
  );
}









