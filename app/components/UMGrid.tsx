'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

type Row = Record<string, string>;
type Props = {
  columns: string[];              // 헤더
  rows: Row[];                    // 원본 데이터(부모가 제공)
  onRowsChange?: (rows: Row[]) => void; // 필요 시 부모로 변경 내용 반영 (선택)
  storageKey?: string;            // 칼럼폭/스타일 보관용 키 (화면별로 다르게 주면 독립)
};

/** 기본 칼럼 폭 */
const DEFAULT_W = 140;
const WIDE_COLS = new Set(['계약자주소']);
const WIDE_W = 360;

/** 색상 팔레트 */
const BG_COLORS = ['#FDE68A','#BBF7D0','#BFDBFE','#FCA5A5','#F5D0FE','#DDD6FE','#FECACA','#D1FAE5'];
const TEXT_COLORS = ['#1F2937','#0F766E','#1D4ED8','#B91C1C','#6D28D9','#047857','#DC2626','#111827'];

/** 중앙 정렬 헤더용 클래스 (열넓이와 무관하게 가운데) */
const thCls = 'border px-2 py-[8px] text-center align-middle bg-gray-100 sticky top-0 z-10';

/** 데이터 셀(대여자 정보) 글자 15% 확대, 행 높이 20% 축소 */
const tdCls = 'border px-2 py-[5px] text-[0.92rem]';

/** 헤더 필터 아이콘(작은 삼각형) */
function TinyTri({ active=false }: {active?: boolean}) {
  return (
    <span
      className={`ml-1 inline-block border-l-[5px] border-r-[5px] border-t-[6px]
       border-transparent border-t-current ${active ? 'text-blue-600' : 'text-gray-400'}`}
      style={{ transform: 'translateY(1px)' }}
    />
  );
}

export default function UMGrid({ columns, rows, onRowsChange, storageKey='umgrid' }: Props) {
  /** ---- 칼럼 폭 (드래그로 조절 & 저장) ---- */
  const [widths, setWidths] = useState<number[]>(
    () => {
      try {
        const raw = localStorage.getItem(`${storageKey}:widths`);
        if (raw) {
          const arr = JSON.parse(raw);
          if (Array.isArray(arr) && arr.length === columns.length) return arr;
        }
      } catch {}
      return columns.map(c => (WIDE_COLS.has(c) ? WIDE_W : DEFAULT_W));
    }
  );
  useEffect(() => {
    // 칼럼 구성 바뀌면 길이 맞추기
    setWidths(prev => {
      const next = columns.map((c, i) => prev[i] ?? (WIDE_COLS.has(c) ? WIDE_W : DEFAULT_W));
      localStorage.setItem(`${storageKey}:widths`, JSON.stringify(next));
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns.join('|')]);

  const resizing = useRef<{col:number; startX:number; startW:number} | null>(null);
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!resizing.current) return;
      const { col, startX, startW } = resizing.current;
      const dx = e.clientX - startX;
      setWidths(w => {
        const n = [...w];
        n[col] = Math.max(60, startW + dx);
        return n;
      });
    };
    const onUp = () => {
      if (resizing.current) {
        localStorage.setItem(`${storageKey}:widths`, JSON.stringify(widths));
      }
      resizing.current = null;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [widths, storageKey]);

  /** ---- 필터 상태 ---- */
  // activeFilters[colName] = Set(허용값). 존재하면 해당 값만 표시
  const [activeFilters, setActiveFilters] = useState<Record<string, Set<string>>>({});
  const [filterOpenCol, setFilterOpenCol] = useState<number | null>(null);
  const [filterSearch, setFilterSearch] = useState('');

  // 각 칼럼의 유니크 값
  const uniqueMap = useMemo(() => {
    const m: Record<string, string[]> = {};
    columns.forEach(c => { m[c] = []; });
    rows.forEach(r => {
      columns.forEach(c => {
        const v = (r[c] ?? '').toString();
        if (v && !m[c].includes(v)) m[c].push(v);
      });
    });
    Object.keys(m).forEach(k => m[k].sort((a,b)=>a.localeCompare(b)));
    return m;
  }, [rows, columns]);

  // 현재 필터 적용된 행 인덱스(원본 인덱스 유지)
  const visibleIdx = useMemo(() => {
    const pass = (r: Row) => {
      for (const k of Object.keys(activeFilters)) {
        const set = activeFilters[k];
        if (!set || set.size === 0) continue;
        const v = (r[k] ?? '').toString();
        if (!set.has(v)) return false;
      }
      return true;
    };
    return rows.map((_,i)=>i).filter(i => pass(rows[i]));
  }, [rows, activeFilters]);

  /** ---- 셀 선택/드래그 & 색상 표시 ---- */
  const [dragging, setDragging] = useState(false);
  // 선택된 셀 키: `${rowIndex}:${colIndex}` (rowIndex는 원본 인덱스)
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const keyOf = (ri:number, ci:number) => `${ri}:${ci}`;

  const onCellDown = (ri:number, ci:number) => {
    setDragging(true);
    setSelected(new Set([keyOf(ri,ci)]));
  };
  const onCellEnter = (ri:number, ci:number) => {
    if (!dragging) return;
    setSelected(prev => new Set(prev).add(keyOf(ri,ci)));
  };
  useEffect(() => {
    const up = () => setDragging(false);
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, []);

  // 셀 스타일 저장 (배경/글자색)
  const [cellStyles, setCellStyles] = useState<Record<string, {bg?:string;color?:string}>>(
    () => {
      try {
        const raw = localStorage.getItem(`${storageKey}:cellStyles`);
        return raw ? JSON.parse(raw) : {};
      } catch { return {}; }
    }
  );
  useEffect(() => {
    localStorage.setItem(`${storageKey}:cellStyles`, JSON.stringify(cellStyles));
  }, [cellStyles, storageKey]);

  const [colorOpen, setColorOpen] = useState(false);
  const [colorMode, setColorMode] = useState<'bg'|'text'>('bg'); // 배경/글자

  const applyColor = (color?: string) => {
    if (selected.size === 0) { alert('색상을 지정할 셀을 먼저 드래그로 선택하세요.'); return; }
    setCellStyles(prev => {
      const next = { ...prev };
      selected.forEach(k => {
        const cur = next[k] ?? {};
        if (colorMode === 'bg') {
          if (color) cur.bg = color; else delete cur.bg;
        } else {
          if (color) cur.color = color; else delete cur.color;
        }
        if (!cur.bg && !cur.color) delete next[k];
        else next[k] = cur;
      });
      return next;
    });
    setColorOpen(false);
  };

  /** ---- 렌더 ---- */
  return (
    <div className="bg-white border rounded shadow-sm">
      {/* 상단 툴바 */}
      <div className="px-4 py-2 border-b flex items-center gap-2">
        <div className="font-semibold">통합관리</div>
        <div className="flex-1" />

        {/* 색상표시 버튼 */}
        <div className="relative">
          <button
            className="px-3 py-1.5 text-sm rounded border bg-white hover:bg-gray-50"
            onClick={() => setColorOpen(o=>!o)}
            title="선택한 셀에 색상 표시"
          >
            색상표시
          </button>
          {colorOpen && (
            <div className="absolute right-0 mt-2 w-[220px] bg-white border rounded shadow z-30 p-3">
              <div className="text-xs text-gray-600 mb-2">적용 대상: 드래그로 선택한 셀</div>
              <div className="flex gap-2 mb-2">
                <label className="text-xs flex items-center gap-1">
                  <input type="radio" name="colormode" checked={colorMode==='bg'} onChange={()=>setColorMode('bg')} />
                  배경색
                </label>
                <label className="text-xs flex items-center gap-1">
                  <input type="radio" name="colormode" checked={colorMode==='text'} onChange={()=>setColorMode('text')} />
                  글자색
                </label>
              </div>
              <div className="grid grid-cols-8 gap-1 mb-2">
                {(colorMode==='bg' ? BG_COLORS : TEXT_COLORS).map(c => (
                  <button
                    key={c}
                    className="h-6 rounded border"
                    style={{ background: colorMode==='bg' ? c : 'white', color: colorMode==='text' ? c : undefined }}
                    onClick={()=>applyColor(c)}
                    title={c}
                  />
                ))}
              </div>
              <div className="flex justify-between">
                <button className="text-xs px-2 py-1 border rounded hover:bg-gray-50" onClick={()=>applyColor(undefined)}>지우기</button>
                <button className="text-xs px-2 py-1 border rounded hover:bg-gray-50" onClick={()=>setColorOpen(false)}>닫기</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 그리드 */}
      <div className="p-2">
        <div className="w-full overflow-auto">
          <table className="border-collapse min-w-[1600px] w-full">
            <colgroup>
              {widths.map((w,i)=><col key={i} style={{ width: `${w}px` }}/>)}
            </colgroup>

            {/* 헤더 */}
            <thead>
              <tr>
                {columns.map((h, ci) => {
                  const isFiltered = !!activeFilters[h] && activeFilters[h]!.size>0;
                  return (
                    <th key={h} className={`${thCls} relative`}>
                      <div className="flex items-center justify-center">
                        <span className="whitespace-nowrap">{h}</span>
                        {/* 필터 버튼 (엑셀 스타일) */}
                        <button
                          className="ml-2 px-1 py-0.5 text-xs rounded border hover:bg-gray-50"
                          onClick={() => setFilterOpenCol(ci)}
                          title="필터"
                        >
                          필터<TinyTri active={isFiltered}/>
                        </button>
                      </div>

                      {/* 리사이저 */}
                      <div
                        className="absolute right-0 top-0 h-full w-1 cursor-col-resize"
                        onMouseDown={(e)=>{
                          e.preventDefault();
                          resizing.current = { col: ci, startX: e.clientX, startW: widths[ci] };
                        }}
                      />

                      {/* 필터 팝오버 */}
                      {filterOpenCol===ci && (
                        <ColumnFilter
                          title={h}
                          allValues={uniqueMap[h] ?? []}
                          current={activeFilters[h] ?? new Set()}
                          onClose={() => { setFilterOpenCol(null); setFilterSearch(''); }}
                          onApply={(set) => {
                            setActiveFilters(prev => {
                              const next = { ...prev };
                              if (set.size===0) delete next[h];
                              else next[h] = set;
                              return next;
                            });
                            setFilterOpenCol(null);
                            setFilterSearch('');
                          }}
                          onClear={()=>{
                            setActiveFilters(prev => {
                              const next = { ...prev };
                              delete next[h];
                              return next;
                            });
                            setFilterOpenCol(null);
                            setFilterSearch('');
                          }}
                          search={filterSearch}
                          setSearch={setFilterSearch}
                        />
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>

            {/* 바디 */}
            <tbody>
              {visibleIdx.map((ri) => {
                const r = rows[ri];
                return (
                  <tr key={ri}>
                    {columns.map((c, ci) => {
                      const k = `${ri}:${ci}`;
                      const style = cellStyles[k] ?? {};
                      const isSel = selected.has(k);
                      return (
                        <td
                          key={ci}
                          className={`${tdCls} ${isSel ? 'ring-2 ring-blue-400 ring-offset-0' : ''}`}
                          style={{ background: style.bg, color: style.color, userSelect:'none' }}
                          onMouseDown={()=>onCellDown(ri,ci)}
                          onMouseEnter={()=>onCellEnter(ri,ci)}
                        >
                          <div className="whitespace-nowrap overflow-hidden text-ellipsis">
                            {r[c] ?? ''}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/** 엑셀식 필터 팝오버 */
function ColumnFilter({
  title, allValues, current, onApply, onClose, onClear, search, setSearch
}:{
  title: string;
  allValues: string[];
  current: Set<string>;
  onApply: (sel:Set<string>)=>void;
  onClose: ()=>void;
  onClear: ()=>void;
  search: string;
  setSearch: (v:string)=>void;
}) {
  const [temp, setTemp] = useState<Set<string>>(new Set(current));
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
    <div className="absolute left-1/2 -translate-x-1/2 mt-2 w-[260px] max-h-[320px] bg-white border rounded shadow z-40 p-2">
      <div className="text-xs font-semibold mb-2">{title} 필터</div>

      <input
        className="w-full border rounded px-2 py-1 text-sm mb-2"
        placeholder="검색"
        value={search}
        onChange={(e)=>setSearch(e.target.value)}
      />

      <div className="border rounded mb-2 p-2 max-h-[180px] overflow-auto">
        <label className="flex items-center gap-2 text-sm mb-2">
          <input type="checkbox" checked={allChecked} onChange={(e)=>toggleAll(e.target.checked)} />
          (모두 선택)
        </label>
        {filtered.map(v => (
          <label key={v} className="flex items-center gap-2 text-sm py-0.5">
            <input type="checkbox" checked={temp.has(v)} onChange={(e)=>toggle(v,e.target.checked)} />
            <span className="truncate" title={v}>{v}</span>
          </label>
        ))}
        {filtered.length===0 && <div className="text-xs text-gray-400 py-2">검색 결과 없음</div>}
      </div>

      <div className="flex justify-between">
        <button className="text-xs px-2 py-1 border rounded hover:bg-gray-50" onClick={onClear}>초기화</button>
        <div className="space-x-2">
          <button className="text-xs px-2 py-1 border rounded hover:bg-gray-50" onClick={onClose}>취소</button>
          <button className="text-xs px-2 py-1 border rounded bg-blue-600 text-white hover:bg-blue-700" onClick={()=>onApply(temp)}>확인</button>
        </div>
      </div>
    </div>
  );
}
