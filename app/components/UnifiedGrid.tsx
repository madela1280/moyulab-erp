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
import FindPanel from './FindPanel';
import ExtensionModal from './ExtensionModal';
import ErrorCheckMenu from './ErrorCheckMenu';
import { apiFetch } from "@/app/lib/fetcher";

type Row = Record<string, string>;

const FALLBACK_COLUMNS: string[] = [
  '거래처분류','상태','안내분류','구매/렌탈','기기번호','기종','에러횟수','제품',
  '수취인명','연락처1','연락처2','계약자주소','택배발송일','시작일','종료일',
  '반납요청일','반납완료일','특이사항1','특이사항2','총연장횟수','신청일',
  '0차연장','1차연장','2차연장','3차연장','4차연장','5차연장',
];

const LS_UNIFIED_COLUMNS = 'unified_columns';
const LS_UNIFIED_ROWS    = 'unified_rows';

const CAT_PREFIX         = 'cat_rows:';
const COLW_GLOBAL_KEY    = 'col_widths:GLOBAL';
const CELLSTYLE_PREFIX   = 'cell_styles:';

const LABELS: Record<string, string> = { 계약자주소: '주소', 특이사항1: '특이사항' };
const label = (k: string) => LABELS[k] ?? k;

const DEFAULT_W = 120;
const BASE_WIDTHS: Record<string, number> = { 계약자주소: 360 };
const BLANK_ROWS = 20;

const CHECKBOX_W = 28;

/* ▼ 날짜 필터 지원 */
const DATE_COLS = new Set(['택배발송일','시작일','종료일','반납요청일','반납완료일','신청일']);
const isYMD = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

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

// 전역 폭 로드/머지
function mergeWidths(cols: string[], saved: Record<string, number>|null): Record<string, number> {
  const base = saved && typeof saved === 'object' ? saved : {};
  const merged: Record<string, number> = {};
  cols.forEach(c => { merged[c] = base[c] ?? BASE_WIDTHS[c] ?? DEFAULT_W; });
  return merged;
}

export default function UnifiedGrid({ viewId }: { viewId: '통합관리'|'온라인'|'보건소'|'조리원' }) {
  const isUnified = viewId === '통합관리';
  const isChildView = !isUnified;

  /** columns */
  const [columns, setColumns] = useState<string[]>([]);
  const colsRender = columns.length ? columns : FALLBACK_COLUMNS;
  useEffect(() => { setColumns(loadColumns()); }, [viewId]);

  /** 전역 컬럼 폭(저장용) + 화면 표시용 */
  const [globalColW, setGlobalColW] = useState<Record<string, number>>({});
  const [displayColW, setDisplayColW] = useState<Record<string, number>>({});
  useEffect(() => {
    try {
      const raw = localStorage.getItem(COLW_GLOBAL_KEY);
      const saved = raw ? JSON.parse(raw) : null;
      const merged = mergeWidths(colsRender, saved);
      setGlobalColW(merged);
      setDisplayColW(merged);
    } catch {
      const merged = mergeWidths(colsRender, null);
      setGlobalColW(merged);
      setDisplayColW(merged);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewId, colsRender.join('|')]);

  const saveGlobalWidths = (map: Record<string, number>) => {
    localStorage.setItem(COLW_GLOBAL_KEY, JSON.stringify(map));
    setGlobalColW(map);
    window.dispatchEvent(new Event('unified_columns_width_updated'));
  };

 // ✅ saveRows — 단 한 번만 존재해야 함
const saveRows = async (next: Row[]) => {
  setRows(next);
  localStorage.setItem(storageKeyFor(viewId), JSON.stringify(next));
  window.dispatchEvent(new Event('unified_rows_updated'));

  try {
    // 서버에 저장 요청 (1초 지연)
    await new Promise((r) => setTimeout(r, 1000));
    const res = await fetch("/api/unified/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: next }),
    });
    const data = await res.json();
    if (!data.ok) {
      console.error("❌ DB 저장 실패:", data.error);
    } else {
      console.log("✅ DB 저장 완료");
    }
  } catch (err) {
    console.error("saveRows error:", err);
  }
};

  /** 삭제/체크 (체크된 행 제거) */
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

      // 붙여넣기 후 0차연장은 '비어 있을 때만' 최초 1회 자동 셋팅 + 총연장횟수 보정
      const ymd = /^\d{4}-\d{2}-\d{2}$/;
      for (let r = ri; r < Math.min(ri + lines.length, next.length); r++) {
        const already = (next[r]['0차연장'] ?? '').toString().trim();
        if (!already) {
          const s = (next[r]['시작일'] ?? '').toString().trim();
          const e2 = (next[r]['종료일'] ?? '').toString().trim();
          if (ymd.test(s) && ymd.test(e2)) {
            const diff = Math.floor((new Date(e2).getTime() - new Date(s).getTime()) / 86400000);
            if (Number.isFinite(diff)) next[r]['0차연장'] = `${diff}일`;
          }
        }
        next[r]['총연장횟수'] = `${countExt(next[r])}회`;
      }

      return next;
    });
  };

  /** 열 이동 / 열 추가 / 열 삭제 */
  const [reorderMode, setReorderMode] = useState(false);

  // 열 폭 숫자 입력 (reorderMode에서만 동작, 화면 반영은 모드 종료 시)
  const handleHeaderClickForWidth = (colName: string) => {
    if (!reorderMode) return;
    const cur = globalColW[colName] ?? BASE_WIDTHS[colName] ?? DEFAULT_W;
    const v = prompt(`"${label(colName)}" 열 너비(px)를 입력하세요. (정수 px, 최소 24)`, String(Math.round(cur)));
    if (v == null) return;
    const num = Number(v);
    if (!Number.isFinite(num)) return alert('숫자를 입력하세요.');
    const px = Math.max(24, Math.round(num));
    const next = { ...globalColW, [colName]: px };
    saveGlobalWidths(next);
  };

  // 모드 토글 시 화면 반영 규칙: 종료(false)로 바뀌면 전역폭을 화면에 반영
  useEffect(() => {
    if (!reorderMode) {
      const raw = localStorage.getItem(COLW_GLOBAL_KEY);
      const saved = raw ? JSON.parse(raw) : null;
      setDisplayColW(mergeWidths(colsRender, saved));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reorderMode]);

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

    // 전역 폭에서도 제거
    try {
      const raw = localStorage.getItem(COLW_GLOBAL_KEY);
      const prev = raw ? JSON.parse(raw) : {};
      if (prev && typeof prev === 'object') {
        delete prev[colName];
        localStorage.setItem(COLW_GLOBAL_KEY, JSON.stringify(prev));
        setGlobalColW(mergeWidths(newCols, prev));
        if (!reorderMode) setDisplayColW(mergeWidths(newCols, prev));
      }
    } catch {}

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

    // 새 컬럼 전역 폭 기본값 채움
    const raw = localStorage.getItem(COLW_GLOBAL_KEY);
    const saved = raw ? JSON.parse(raw) : {};
    saved[name] = BASE_WIDTHS[name] ?? DEFAULT_W;
    localStorage.setItem(COLW_GLOBAL_KEY, JSON.stringify(saved));
    setGlobalColW(mergeWidths(cols, saved));
    if (!reorderMode) setDisplayColW(mergeWidths(cols, saved));

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
    if (DATE_COLS.has(col)) {
      rows.forEach(r => {
        const v = (r[col] ?? '').toString();
        if (isYMD(v)) {
          vals.add(v.slice(0, 4));
          vals.add(v.slice(0, 7));
        } else if (v) {
          vals.add(v);
        }
      });
    } else {
      rows.forEach(r => vals.add((r[col] ?? '').toString()));
    }
    return Array.from(vals).sort();
  };

  const filteredRows = useMemo(() => {
    const activeCols = Object.keys(filters).filter(c => (filters[c]?.size ?? 0) > 0);
    let base = rows.filter(r => activeCols.every(c => {
      const val = (r[c] ?? '').toString();
      const set = filters[c]!;
      if (DATE_COLS.has(c) && isYMD(val)) {
        for (const tok of set) { if (val.startsWith(tok)) return true; }
        return false;
      }
      return set.has(val);
    }));
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

  /** 드래그 선택 & 복사/삭제 */
  const tableHostRef = useRef<HTMLDivElement>(null);

  const [sel, setSel] = useState<{ r1: number; c1: number; r2: number; c2: number } | null>(null);
  const [draggingSel, setDraggingSel] = useState(false);
  const [hl, setHl] = useState<{ r: number; c: number } | null>(null);
  const [showFind, setShowFind] = useState(false);

  const [checkedCols, setCheckedCols] = useState<string[]>(() => {
    const saved = localStorage.getItem('find_checkedCols');
    return saved ? JSON.parse(saved) : ['수취인명','연락처1','연락처2','계약자주소','기기번호'];
  });
  useEffect(() => {
    localStorage.setItem('find_checkedCols', JSON.stringify(checkedCols));
  }, [checkedCols]);

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

  // ▼ 선택된 뷰 인덱스를 실제 rows 인덱스로 변환
  const viewToBaseRowIndex = (viewRow: Row): number => {
    let baseIdx = rows.indexOf(viewRow);
    if (baseIdx >= 0) return baseIdx;
    baseIdx = rows.findIndex(r => r === viewRow || colsRender.every(k => (r?.[k] ?? '') === (viewRow?.[k] ?? '')));
    return baseIdx;
  };

  // ▼ 선택 영역의 실제 (행,열키) 목록 계산
  const selectedCellsInBase = (): Array<{rowIndex:number; colKey:string}> => {
    if (!sel) return [];
    const [r1, r2] = [Math.min(sel.r1, sel.r2), Math.max(sel.r1, sel.r2)];
    const [c1, c2] = [Math.min(sel.c1, sel.c2), Math.max(sel.c1, sel.c2)];
    const out: Array<{rowIndex:number; colKey:string}> = [];
    for (let vr = r1; vr <= r2; vr++) {
      if (vr >= filteredRows.length) break;
      const viewRow = filteredRows[vr];
      const baseIdx = viewToBaseRowIndex(viewRow);
      if (baseIdx < 0) continue;
      for (let vc = c1; vc <= c2; vc++) {
        const key = colsRender[vc];
        if (!key) continue;
        out.push({ rowIndex: baseIdx, colKey: key });
      }
    }
    return out;
  };

  // ▼ 선택 영역 삭제(공백)
  const clearSelectionCells = () => {
    const cells = selectedCellsInBase();
    if (!cells.length) return;
    const next = rows.map(r => ({ ...r }));
    for (const { rowIndex, colKey } of cells) {
      if (next[rowIndex]) next[rowIndex][colKey] = '';
    }
    saveRows(next);
  };

  useEffect(() => {
    const host = tableHostRef.current;
    if (!host) return;
    const onKey = (e: KeyboardEvent) => {
      // 복사
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        e.preventDefault(); copySelection();
      }
      // 잘라내기 (복사 후 삭제)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'x') {
        e.preventDefault(); copySelection(); clearSelectionCells();
      }
      // 선택 영역 삭제
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault(); clearSelectionCells();
      }
    };
    host.addEventListener('keydown', onKey);
    return () => host.removeEventListener('keydown', onKey);
  }, [sel, filteredRows, colsRender, rows]);

  const jumpTo = (r: number, c: number) => {
    setSel({ r1: r, c1: c, r2: r, c2: c });
    const host = tableHostRef.current;
    if (host) {
      const rowHeight = 28;
      const y = Math.max(0, r * rowHeight - 60);
      host.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  /** 셀 색상 저장 + 적용 함수 */
  type Style = { bg?: string; color?: string };
  const [cellStyles, setCellStyles] = useState<Record<string, Style>>(() => {
    try { return JSON.parse(localStorage.getItem(cellStyleKey(viewId)) || '{}'); } catch { return {}; }
  });
  useEffect(() => {
    localStorage.setItem(cellStyleKey(viewId), JSON.stringify(cellStyles));
  }, [cellStyles, viewId]);
  function keyOf(r:number,c:number){ return `${r}:${c}`; }
  const applyColor = (mode: 'bg'|'text', color?:string) => {
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
    window.addEventListener('unified_columns_width_updated', h);
    window.addEventListener('storage', h as any);
    return () => {
      window.removeEventListener('unified_rows_updated', h);
      window.removeEventListener('rules:category_rebuilt', h);
      window.removeEventListener('unified_columns_width_updated', h);
      window.removeEventListener('storage', h as any);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewId, colsRender.join('|')]);

  /* ▼ 렌더 데이터: 필터 후에도 표 높이 유지(빈 행 보충) */
  const data = useMemo(() => {
    const minTarget = Math.max(rows.length, BLANK_ROWS);
    if (filteredRows.length >= minTarget) return filteredRows;
    const extra = Array.from({ length: minTarget - filteredRows.length },
      () => Object.fromEntries(colsRender.map(c => [c, ''])));
    return filteredRows.concat(extra);
  }, [filteredRows, rows.length, colsRender]);

  // ---- 새 버튼/모달 상태 ----
  const [showGuide, setShowGuide] = useState(false);
  const [showCategory, setShowCategory] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveDest, setMoveDest] = useState<Category>('온라인');

  useEffect(() => {
    setShowGuide(false);
    setShowCategory(false);
    setMoveOpen(false);
    if (isChildView) {
      setReorderMode(false);
      setShowAdd(false);
    }
  }, [viewId]);

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

  const deviceIndexRef = useRef<Record<string, any> | null>(null);
  const ensureDeviceIdx = () => { if (!deviceIndexRef.current) deviceIndexRef.current = buildDeviceIndex(); };

  // ====== 연장 관련 ======
  const [showExt, setShowExt] = useState(false);
  const [extRow, setExtRow] = useState<number|null>(null);
  const [extCol, setExtCol] = useState<string|null>(null);
  const [highlightRow, setHighlightRow] = useState<number|null>(null);

  // 모달 대상: 1~5차만 (0차 제외)
  const isExtCol = (c:string) =>
    /^[1-5]차연장$/.test(c) || ['1차연장','2차연장','3차연장','4차연장','5차연장'].includes(c);

  // 총연장횟수: 1~5차만 카운트
  const countExt = (r: Row) =>
    ['1차연장','2차연장','3차연장','4차연장','5차연장']
      .reduce((n, c) => n + (((r[c] ?? '').toString().trim()) ? 1 : 0), 0);

  const isEmptyRow = (row: Row) => colsRender.every(k => ((row?.[k] ?? '') === ''));

  const openExt = (rIdx:number, col:string) => {
    if (col === '0차연장') return;
    if (!isExtCol(col)) return;
    const viewRow = data[rIdx];
    if (!viewRow) return;
    if (rIdx >= filteredRows.length) return;
    if (isEmptyRow(viewRow)) return;

    let baseIdx = rows.indexOf(viewRow);
    if (baseIdx < 0) {
      baseIdx = rows.findIndex(r =>
        r === viewRow || colsRender.every(k => (r?.[k] ?? '') === (viewRow?.[k] ?? ''))
      );
    }
    if (baseIdx < 0) return;

    setExtRow(baseIdx);
    setExtCol(col);
    setShowExt(true);
    setHighlightRow(baseIdx);
  };

  const handleSaveExt = (dataExt:{days:number; reasons:string[]; amount:number; due:string}) => {
    if (extRow==null || !extCol) return;

    const next = rows.map(r=>({...r}));
    const summary = [
      String(Math.max(0, Math.floor(dataExt.days))),
      (dataExt.reasons?.[0] ?? '').trim(),
      String(Math.max(0, Math.floor(dataExt.amount))),
      (dataExt.due ?? '').trim()
    ].join('/');

    next[extRow][extCol] = summary;

    next[extRow]['총연장횟수'] = `${countExt(next[extRow])}회`;

    if ((dataExt.due || '').trim()) {
      next[extRow]['종료일'] = dataExt.due.trim();
    }

    saveRows(next);
    setShowExt(false); setExtRow(null); setExtCol(null);
    setHighlightRow(null);
  };

  // 시작일/종료일 유효 → 0차연장 자동/총연장횟수 보정
  useEffect(() => {
    if (!rows.length) return;
    const ymd = /^\d{4}-\d{2}-\d{2}$/;
    let changed = false;
    const next = rows.map(r => {
      const cur = { ...r };
      const zero = (cur['0차연장'] ?? '').toString().trim();
      if (!zero) {
        const s = (cur['시작일'] ?? '').toString().trim();
        const e2 = (cur['종료일'] ?? '').toString().trim();
        if (ymd.test(s) && ymd.test(e2)) {
          const diff = Math.floor((new Date(e2).getTime() - new Date(s).getTime()) / 86400000);
          if (Number.isFinite(diff)) {
            cur['0차연장'] = `${diff}일`;
            changed = true;
          }
        }
      }
      const beforeCount = (cur['총연장횟수'] ?? '').toString();
      const cnt = `${countExt(cur)}회`;
      if (beforeCount !== cnt) { cur['총연장횟수'] = cnt; changed = true; }
      return cur;
    });
    if (changed) saveRows(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  return (
    <div
      className="bg-white border rounded shadow-sm subpixel-antialiased"
      style={{ WebkitFontSmoothing: 'auto', MozOsxFontSmoothing: 'auto' }}
    >
      {/* 헤더 바 */}
      <div className="px-4 py-3 font-semibold border-b flex items-center gap-2 text-gray-900">
        {/* 제목 */}
        <span className={isUnified ? 'text-blue-700' : ''}>{viewId}</span>

        {/* 좌측: 안내/분류 or 이동 */}
        {isUnified ? (
          <>
            <button
              className="ml-3 px-2 py-1 text-xs border rounded hover:bg-gray-50"
              onClick={()=>setShowGuide(true)}
              title="거래처→안내분류 규칙 관리"
            >안내분류</button>
            <button
              className="px-2 py-1 text-xs border rounded hover:bg-gray-50"
              onClick={()=>setShowCategory(true)}
              title="거래처→온라인/보건소/조리원 규칙 관리"
            >분류</button>
          </>
        ) : (
          <div className="relative ml-3">
            <button
              className="px-2 py-1 text-xs border rounded hover:bg-gray-50"
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
                 <div className="text-[11px] text-gray-500 mt-2">
                    * 규칙으로 저장되며 뷰가 재구성됩니다.
                </div>
                {/* 좌측: 필터/검색/다운로드/칼라/오류검사 */}
        <div className="ml-3 flex items-center gap-2">
          <button
            className={`px-2 py-1 text-xs border rounded ${filterMode ? 'bg-blue-50 border-blue-300 text-blue-700' : 'hover:bg-gray-50'}`}
            onClick={() => {
              setFilterMode(v => {
                const next = !v;
                if (!next) { setFilters({}); setSortMap({}); setOpenFilterCol(null); }
                return next;
              });
            }}
          >필터</button>

          <button
            className="px-2 py-1 text-xs border rounded hover:bg-gray-50"
            onClick={() => setShowFind(true)}
            title="데이터 찾기"
          >검색</button>

          <button
            className="px-2 py-1 text-xs border rounded hover:bg-gray-50"
            onClick={() => {
              const BOM = '\uFEFF';
              const src = (filteredRows && filteredRows.length ? filteredRows : rows).filter(r => !isEmptyRow(r));
              const header = colsRender.join(',');
              const body = src.map(r =>
                colsRender.map(c => {
                  const v = (r[c] ?? '').toString();
                  const s = v.replace(/"/g, '""');
                  return /[",\n]/.test(s) ? `"${s}"` : s;
                }).join(',')
              ).join('\n');

              const csv = BOM + header + '\n' + body;
              const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `${viewId}_export.csv`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            }}
          >다운로드(엑셀)</button>

          <ColorMenu onApply={applyColor} />
          <ErrorCheckMenu rows={rows} />
        </div>

        {/* 우측: 열 이동/폭/행 추가/양식 추가/선택 삭제 */}
        <div className="ml-auto flex items-center gap-2">
          {isUnified && (
            <>
              <button
                className={`px-2 py-1 text-xs border rounded ${reorderMode ? 'bg-blue-50 border-blue-300' : 'hover:bg-gray-50'}`}
                title="열 이동 모드 (제목 클릭 시 폭(px) 입력 가능)"
                onClick={() => setReorderMode(v => !v)}
              >
                열 이동 모드
              </button>
              <button
                className="px-2 py-1 text-xs border rounded hover:bg-gray-50"
                onClick={() => {
                  const next = rows.concat(
                    Array.from({ length: 10 }, () => Object.fromEntries(colsRender.map(c => [c, ''])))
                  );
                  saveRows(next);
                }}
              >행 10 추가</button>
              <button className="px-2 py-1 text-xs border rounded hover:bg-gray-50" onClick={() => setShowAdd(true)}>양식 추가(열)</button>
              <button className="px-2 py-1 text-xs border rounded hover:bg-gray-50" onClick={deleteSelected}>선택 삭제</button>
            </>
          )}
        </div>
      
      {/* 표 */}
      <div className="p-2">
        <div
          ref={tableHostRef}
          tabIndex={0}
          className="w-full max-h=[calc(100vh-155px)] max-h-[calc(100vh-155px)] overflow-auto border rounded outline-none"
        >
          <table className="min-w-[3200px] text-sm border-collapse table-fixed">
            <colgroup>
              <col style={{ width: CHECKBOX_W }} />
              {colsRender.map(c => {
                const w = Math.round(displayColW[c] ?? DEFAULT_W);
                return <col key={c} style={{ width: w + 'px' }} />;
              })}
            </colgroup>

            <thead className="bg-gray-200 sticky top-0 z-10 text-gray-900">
              <tr>
                <th className="border px-2 py-[0.28rem] w-[28px] min-w-[28px] max-w-[28px] text-center">✔</th>

                {colsRender.map((c, idx) => {
                  const activeFilter = (filters[c]?.size ?? 0) > 0 || !!sortMap[c];
                  const allowFilter = true;
                  return (
                    <th
                      key={c}
                      className="border px-2 py-[0.16rem] text-[0.74rem] relative select-none"
                    >
                      <div
                        className={`flex items-center gap-2 ${c==='계약자주소'?'justify-center':'justify-start'}`}
                      >
                        <button
                          type="button"
                          className={`whitespace-nowrap ${reorderMode ? 'underline decoration-dotted' : ''} text-gray-900`}
                          title={reorderMode ? '클릭하여 폭(px) 입력' : ''}
                          onClick={() => handleHeaderClickForWidth(c)}
                        >
                          {label(c)}
                        </button>

                        {filterMode && allowFilter && (
                          <button
                            className={`px-1 text-[0.7rem] leading-none ${activeFilter ? 'text-blue-600' : 'text-blue-500'} hover:bg-blue-50 rounded`}
                            title="필터"
                            onClick={() => setOpenFilterCol(openFilterCol === c ? null : c)}
                          >▼</button>
                        )}

                        {isUnified && reorderMode && (
                          <span className="flex gap-1">
                            <button className="px-1 text-xs border rounded hover:bg-gray-50" onClick={() => moveCol(idx, -1)} title="왼쪽으로">◀</button>
                            <button className="px-1 text-xs border rounded hover:bg-gray-50" onClick={() => moveCol(idx, 1)} title="오른쪽으로">▶</button>
                            <button className="px-1 text-xs border rounded hover:bg-red-50 text-red-600" onClick={() => deleteCol(idx)} title="열 삭제">✕</button>
                          </span>
                        )}
                      </div>

                      {/* ▼▼▼ 필터 팝오버 실제 렌더링 ▼▼▼ */}
                      {filterMode && openFilterCol === c && (
                        <ExcelFilterPopover
                          title={`${label(c)} 필터`}
                          allValues={uniqueValues(c)}
                          currentSet={filters[c] ?? new Set<string>()}
                          currentSort={sortMap[c] ?? null}
                          onApply={(selSet, sort) => {
                            setFilters(prev => ({ ...prev, [c]: new Set(selSet) }));
                            setSortMap(prev => ({ ...prev, [c]: sort }));
                            setOpenFilterCol(null);
                          }}
                          onClose={() => setOpenFilterCol(null)}
                        />
                      )}
                      {/* ▲▲▲ 필터 팝오버 렌더링 끝 ▲▲▲ */}
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody className="text-gray-900">
              {data.map((row, rIdx) => (
                <tr
                   key={rIdx}
                   className={hl && rIdx === hl.r ? 'bg-blue-100' : (highlightRow === rIdx ? 'bg-red-100' : undefined)}
                >
                  <td className="border text-center w-[28px] min-w-[28px] max-w-[28px]">
                    <input
                      type="checkbox"
                      checked={!!checked[rIdx]}
                      onChange={(e) => setChecked(prev => ({ ...prev, [rIdx]: e.target.checked }))}
                    />
                  </td>

                  {colsRender.map((c, ci) => {
  // 기존 값
  const rawVal = row[c] ?? '';

  // 핵심 필드(수취인명/연락처1/계약자주소)가 비어 있으면 총연장횟수의 '0회'는 표시만 숨김
  const val =
    c === '총연장횟수'
      ? (() => {
          const name = (row['수취인명'] ?? '').toString().trim();
          const phone = (row['연락처1'] ?? '').toString().trim();
          const addr = (row['계약자주소'] ?? '').toString().trim();
          const v = (rawVal ?? '').toString();

          // 핵심 정보가 하나라도 비어 있고, 값이 비었거나 '0회'라면 화면 표시만 공란으로
          if ((!name || !phone || !addr) && (v === '' || v === '0회')) {
            return '';
          }
          return v;
        })()
      : rawVal;

                    const handleCellClick = () => {
                      if (isExtCol(c)) openExt(rIdx, c);
                    };

                   return (
  <td
    key={ci}
    className={`border px-[0.4rem] py-[0.128rem] whitespace-nowrap overflow-hidden text-ellipsis
      ${isSelected(rIdx, ci) ? 'bg-blue-50' : ''}`}
    onClick={handleCellClick}
    onMouseDown={() => startSel(rIdx, ci)}
    onMouseEnter={() => extendSel(rIdx, ci)}
    title={typeof val === 'string' ? val : ''}
    style={{
      background: (cellStyles[`${rIdx}:${ci}`]?.bg) ?? undefined,
      color: (cellStyles[`${rIdx}:${ci}`]?.color) ?? undefined,
    }}
  >
    <input
      className="w-full min-w-0 px-[0.2rem] py-[0.096rem] text-[0.62rem] bg-transparent border-0 outline-none focus:ring-0 truncate text-gray-900"
      style={{ color: (cellStyles[`${rIdx}:${ci}`]?.color) ?? undefined }}
      value={val}
      onChange={(e) => {
        const v = e.target.value;
        setRows(prev => {
          const next = prev.map(r => ({ ...r }));
          next[rIdx][c] = v;

          // 0차연장 자동 설정 (비어있을 때만 1회)
          if ((c === '시작일' || c === '종료일') && !((next[rIdx]['0차연장'] ?? '').toString().trim())) {
            const s = (next[rIdx]['시작일'] ?? '').toString().trim();
            const e2 = (next[rIdx]['종료일'] ?? '').toString().trim();
            const ymd = /^\d{4}-\d{2}-\d{2}$/;
            if (ymd.test(s) && ymd.test(e2)) {
              const diff = Math.floor((new Date(e2).getTime() - new Date(s).getTime()) / 86400000);
              if (Number.isFinite(diff)) next[rIdx]['0차연장'] = `${diff}일`;
            }
          }

          // 1~5차 연장 편집 시 총연장횟수 즉시 반영
          if (/^[1-5]차연장$/.test(c)) {
            next[rIdx]['총연장횟수'] = `${countExt(next[rIdx])}회`;
          }

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

      {/* 양식 추가 모달: 소카테고리에서는 뜨지 않도록 */}
      {isUnified && showAdd && (
        <div className="fixed inset-0 z-40 bg-black/30 flex items-center justify-center">
          <div className="bg-white w-[520px] max-w-[95vw] rounded shadow">
            <div className="px-4 py-3 border-b font-semibold text-gray-900">양식 추가(열)</div>
            <div className="p-4 space-y-3 text-sm text-gray-900">
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

      {isUnified && <GuideRuleModal open={showGuide} onClose={()=>setShowGuide(false)} />}
      {isUnified && <CategoryRuleModal open={showCategory} onClose={()=>setShowCategory(false)} />}

      {showFind && (
        <FindPanel
          rows={rows}
          columns={colsRender}
          checked={checked}
          checkedCols={checkedCols}
          onChangeCheckedCols={setCheckedCols}
          onJump={jumpTo}
          onHighlight={(r, c) => setHl({ r, c })}
          onClose={() => { setShowFind(false); setHl(null); }}
        />
      )}

      {/* ★ 연장 입력 모달 (0차 제외하고 1~5차에서만 open) */}
      <ExtensionModal
        key={showExt && extRow!=null && extCol ? `${extRow}-${extCol}` : 'closed'}
        open={!!showExt && extRow!=null && !!extCol && isExtCol(extCol) && !!rows[extRow]}
        initial={
          (extRow!=null && extCol && rows[extRow]) ? (()=>{ 
            const str = ((rows[extRow] ?? {})[extCol] ?? '').toString();
            const [daysStr='',reason='',amountStr='',endDate=''] = str.split('/');
            const days = Number.isFinite(Number(daysStr)) ? Number(daysStr) : 0;
            const amountNum = Number((amountStr || '').replace(/[^\d.-]/g, ''));
            const amount = Number.isFinite(amountNum) ? Math.max(0, Math.floor(amountNum)) : 0;
            const due = /^\d{4}-\d{2}-\d{2}$/.test((endDate || '').trim()) ? (endDate || '').trim() : '';
            return { days, reasons: reason ? [reason] : [''], amount, due };
          })(): undefined
        }
     onSave={handleSaveExt}
onClose={()=>{ setShowExt(false); setHighlightRow(null); }}
/>
    </div>
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
    <div className="absolute z-40 mt-1 w-[260px] bg-white border rounded shadow text-gray-900">
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
      <button className="px-2 py-1 text-xs border rounded hover:bg-gray-50" onClick={()=>setOpen(v=>!v)}>칼라</button>
      {open && (
        <div className="absolute z-40 mt-2 w-[220px] bg-white border rounded shadow p-3 text-gray-900">
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




















