'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { applyAutoToRowInPlace, buildDeviceIndex, rebuildCategoryViewsFromRules, updateCategoryForVendors, type Category } from '../lib/rules';
import { GuideRuleModal, CategoryRuleModal } from './RuleModals';
import FindPanel from './FindPanel';
import ExtensionModal from './ExtensionModal';

const socket = io();

type Row = Record<string, string>;

const FALLBACK_COLUMNS: string[] = [
  '거래처분류','상태','안내분류','구매/렌탈','기기번호','기종','에러횟수','제품',
  '수취인명','연락처1','연락처2','계약자주소','택배발송일','시작일','종료일',
  '반납요청일','반납완료일','특이사항1','특이사항2','총연장횟수','신청일',
  '0차연장','1차연장','2차연장','3차연장','4차연장','5차연장'
];

const LS_UNIFIED_COLUMNS = 'unified_columns';
const LS_UNIFIED_ROWS = 'unified_rows';
const CAT_PREFIX = 'cat_rows:';
const COLW_GLOBAL_KEY = 'col_widths:GLOBAL';
const CELLSTYLE_PREFIX = 'cell_styles:';
const LABELS: Record<string, string> = { 계약자주소: '주소', 특이사항1: '특이사항' };
const label = (k: string) => LABELS[k] ?? k;
const DEFAULT_W = 120;
const BASE_WIDTHS: Record<string, number> = { 계약자주소: 360 };
const BLANK_ROWS = 20;
const CHECKBOX_W = 28;
const DATE_COLS = new Set(['택배발송일','시작일','종료일','반납요청일','반납완료일','신청일']);
const isYMD = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

function storageKeyFor(viewId: string) {
  return viewId === '통합관리' ? LS_UNIFIED_ROWS : CAT_PREFIX + viewId;
}
function cellStyleKey(viewId: string) {
  return CELLSTYLE_PREFIX + viewId;
}
function loadColumns(): string[] {
  try {
    const raw = localStorage.getItem(LS_UNIFIED_COLUMNS);
    const arr = raw ? JSON.parse(raw) : null;
    return Array.isArray(arr) && arr.length ? arr : FALLBACK_COLUMNS;
  } catch {
    return FALLBACK_COLUMNS;
  }
}
function mergeWidths(cols: string[], saved: Record<string, number>|null): Record<string, number> {
  const base = saved && typeof saved === 'object' ? saved : {};
  const merged: Record<string, number> = {};
  cols.forEach(c => {
    merged[c] = base[c] ?? BASE_WIDTHS[c] ?? DEFAULT_W;
  });
  return merged;
}

export default function UnifiedGrid({ viewId = '통합관리' }: { viewId?: '통합관리'|'온라인'|'보건소'|'조리원' }) {
  const isUnified = viewId === '통합관리';
  const isChildView = !isUnified;

  const [columns, setColumns] = useState<string[]>([]);
  const colsRender = columns.length ? columns : FALLBACK_COLUMNS;
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  /** 🔹 DB 데이터 불러오기 + 실시간 소켓 업데이트 */
useEffect(() => {
  const fetchRows = async () => {
    try {
      const res = await fetch('/api/unified');
      const data = await res.json();

      if (Array.isArray(data) && data.length > 0) {
        setRows(data);
      } else {
        // 빈 행 기본 세팅
        setRows(
          Array.from({ length: BLANK_ROWS }, () =>
            Object.fromEntries(colsRender.map((c) => [c, '']))
          )
        );
      }
      setLoading(false);
    } catch (err) {
      console.error('❌ 데이터 불러오기 실패:', err);
      setLoading(false);
    }
  };

  // ✅ 데이터 최초 로드
  fetchRows();

  // ✅ 소켓 연결 및 이벤트 리스너 등록
  socket.on('update', (data: Row[]) => {
    setRows(data);
  });

  // ✅ cleanup (정상 타입)
  return () => {
    socket.off('update');
    socket.disconnect();
  };
}, [viewId]);

  /** 🔹 자동 저장 */
  const autoSave = async (next: Row[]) => {
    try {
      await fetch('/api/unified', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: next }),
      });
      socket.emit('update', next);
      console.log('✅ DB 자동저장 완료');
    } catch (err) {
      console.error('❌ 자동저장 실패:', err);
    }
  };

  /** 🔹 입력 변경 시 즉시 반영 + 자동저장 */
  const handleChange = (rIdx: number, key: string, value: string) => {
    setRows(prev => {
      const next = [...prev];
      next[rIdx] = { ...next[rIdx], [key]: value };
      autoSave(next);
      return next;
    });
  };

  /** 🔹 행 추가 */
  const addRow = () => {
    setRows(prev => {
      const next = [...prev, Object.fromEntries(colsRender.map(c => [c, '']))];
      autoSave(next);
      return next;
    });
  };

  /** 🔹 컬럼 폭 관리 */
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
  }, [colsRender.join('|')]);

  /** 🔹 행 선택/삭제 */
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const deleteSelected = () => {
    const next = rows.filter((_, i) => !checked[i]);
    const safe = next.length ? next : Array.from({ length: BLANK_ROWS }, () => Object.fromEntries(colsRender.map(c => [c, ''])));
    setRows(safe);
    autoSave(safe);
    setChecked({});
  };

  /** 🔹 셀 색상 */
  type Style = { bg?: string; color?: string };
  const [cellStyles, setCellStyles] = useState<Record<string, Style>>(() => {
    try {
      return JSON.parse(localStorage.getItem(cellStyleKey(viewId)) || '{}');
    } catch {
      return {};
    }
  });
  useEffect(() => {
    localStorage.setItem(cellStyleKey(viewId), JSON.stringify(cellStyles));
  }, [cellStyles, viewId]);
  function keyOf(r:number,c:number){ return `${r}:${c}`; }

  const applyColor = (mode: 'bg'|'text', color?:string) => {
    setCellStyles(prev => {
      const next = { ...prev };
      Object.keys(checked).forEach(k => {
        if (!checked[+k]) return;
        for (let c = 0; c < colsRender.length; c++) {
          const key = keyOf(+k, c);
          const cur = { ...(next[key] || {}) };
          if (mode === 'bg') {
            if (color) cur.bg = color; else delete cur.bg;
          } else {
            if (color) cur.color = color; else delete cur.color;
          }
          if (!cur.bg && !cur.color) delete next[key]; else next[key] = cur;
        }
      });
      return next;
    });
  };

  /** 🔹 UI 렌더 */
  if (loading) {
    return <div className="p-6 text-gray-500">데이터 불러오는 중...</div>;
  }

  return (
    <div className="bg-white border rounded shadow-sm subpixel-antialiased p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-2">
          <button className="px-2 py-1 text-xs border rounded hover:bg-gray-50" onClick={addRow}>행 추가</button>
          <button className="px-2 py-1 text-xs border rounded hover:bg-gray-50" onClick={deleteSelected}>선택 삭제</button>
          <ColorMenu onApply={applyColor} />
        </div>
        <div className="text-sm text-gray-600">
          총 {rows.length}행
        </div>
      </div>

      <div className="overflow-auto max-h-[calc(100vh-180px)]">
        <table className="min-w-[2400px] text-[12px] border-collapse">
          <colgroup>
            <col style={{ width: CHECKBOX_W }} />
            {colsRender.map(c => {
              const w = Math.round(displayColW[c] ?? DEFAULT_W);
              return <col key={c} style={{ width: w + 'px' }} />;
            })}
          </colgroup>
          <thead className="bg-gray-100 sticky top-0 z-10">
            <tr>
              <th className="border w-[28px] text-center">✔</th>
              {colsRender.map((c) => (
                <th key={c} className="border px-1 py-1 text-left">{label(c)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={ri}>
                <td className="border text-center">
                  <input type="checkbox" checked={!!checked[ri]} onChange={(e) => setChecked(prev => ({ ...prev, [ri]: e.target.checked }))} />
                </td>
                {colsRender.map((c, ci) => {
                  const v = r[c] ?? '';
                  const style = cellStyles[keyOf(ri, ci)] || {};
                  return (
                    <td key={ci} className="border px-1 py-[2px]" style={{ background: style.bg, color: style.color }}>
                      <input
                        value={v}
                        onChange={(e) => handleChange(ri, c, e.target.value)}
                        className="w-full bg-transparent border-0 outline-none text-[11px]"
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
  );
}

/**
 * ✅ 색상 메뉴 (셀 색상/글자색 지정)
 */
function ColorMenu({ onApply }: { onApply: (mode: 'bg' | 'text', color?: string) => void }) {
  const [open, setOpen] = useState(false);
  const colors = ['#fef08a','#fca5a5','#86efac','#93c5fd','#c7d2fe','#f9a8d4','#f5f5f5','#ffffff'];

  return (
    <div className="relative inline-block">
      <button
        className="px-2 py-1 text-xs border rounded hover:bg-gray-50"
        onClick={() => setOpen(o => !o)}
      >
        색상
      </button>
      {open && (
        <div className="absolute left-0 mt-1 bg-white border rounded shadow p-2 z-30">
          <div className="grid grid-cols-4 gap-1 mb-2">
            {colors.map(c => (
              <button
                key={c}
                className="w-5 h-5 border rounded"
                style={{ background: c }}
                onClick={() => { onApply('bg', c); setOpen(false); }}
              />
            ))}
          </div>
          <div className="flex gap-1">
            <button className="px-2 py-1 border rounded text-xs" onClick={() => onApply('bg')}>배경지우기</button>
            <button className="px-2 py-1 border rounded text-xs" onClick={() => onApply('text','red')}>빨강글씨</button>
            <button className="px-2 py-1 border rounded text-xs" onClick={() => onApply('text')}>글자색지우기</button>
          </div>
        </div>
      )}
    </div>
  );
}