'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

type Row = Record<string, string>;

type Props = {
  rows: Row[];
  columns: string[];
  checked: Record<number, boolean>;
  checkedCols: string[];
  onChangeCheckedCols: (cols: string[]) => void;
  onJump: (r: number, c: number) => void;
  onHighlight?: (r: number, c: number) => void;
  onClose: () => void;
};

type FindOptions = {
  caseSensitive: boolean;
  wholeCell: boolean;
  wildcard: boolean;
};

type Hit = { r: number; c: number; value: string };

const STORAGE_COLS = 'find_checkedCols';
const STORAGE_QUERY = 'find_lastQuery';
const STORAGE_OPTS = 'find_lastOpts';

const ALLOWED = ['수취인명','연락처1','연락처2','계약자주소','기기번호'];

function normalizeCols(all: string[]) {
  return all.filter(c => ALLOWED.includes(c));
}

function wildcardToRegExp(input: string) {
  const escaped = input.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  return new RegExp('^' + escaped.replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
}

function makeMatcher(query: string, opts: FindOptions) {
  if (!opts.wildcard) {
    if (opts.wholeCell) {
      return (cell: string) =>
        opts.caseSensitive ? (cell === query) : (cell.toLowerCase() === query.toLowerCase());
    }
    return (cell: string) =>
      opts.caseSensitive
        ? cell.includes(query)
        : cell.toLowerCase().includes(query.toLowerCase());
  }
  const re = wildcardToRegExp(opts.wholeCell ? query : `*${query}*`);
  if (opts.caseSensitive) return (cell: string) => re.test(cell);
  return (cell: string) => re.test(cell.toLowerCase());
}

function searchSync(rows: Row[], cols: string[], matcher: (s: string)=>boolean): Hit[] {
  const out: Hit[] = [];
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    for (let ci = 0; ci < cols.length; ci++) {
      const cName = cols[ci];
      const v = (row[cName] ?? '').toString();
      if (matcher(v)) out.push({ r, c: ci, value: v });
    }
  }
  return out;
}

export default function FindPanel({
  rows, columns, checked, checkedCols, onChangeCheckedCols, onJump, onHighlight, onClose
}: Props) {
  const [pos, setPos] = useState<{x:number;y:number}>({ x: 24, y: 60 });
  const draggingRef = useRef<{dx:number;dy:number} | null>(null);

  const allowedCols = useMemo(() => normalizeCols(columns), [columns]);

  // 초기 전체 체크 ON
  useEffect(() => {
    if (!checkedCols.length) {
      onChangeCheckedCols(allowedCols);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowedCols.join('|')]);

  const [query, setQuery] = useState<string>(() => {
    try { return localStorage.getItem(STORAGE_QUERY) ?? ''; } catch { return ''; }
  });
  const [opts, setOpts] = useState<FindOptions>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_OPTS);
      if (raw) return JSON.parse(raw);
    } catch {}
    return { caseSensitive:false, wholeCell:false, wildcard:false };
  });
  useEffect(() => { try { localStorage.setItem(STORAGE_QUERY, query); } catch {} }, [query]);
  useEffect(() => { try { localStorage.setItem(STORAGE_OPTS, JSON.stringify(opts)); } catch {} }, [opts]);

  const [hits, setHits] = useState<Hit[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [curIdx, setCurIdx] = useState<number>(-1);

  const doSearch = (q: string, cols: string[], options: FindOptions, focusFirst: boolean) => {
    if (!q.trim() || cols.length === 0) {
      setHits([]); setTotal(0); setCurIdx(-1);
      onHighlight?.(Number.NaN as any, Number.NaN as any);
      return;
    }
    const matcher = makeMatcher(q, options);
    const res = searchSync(rows, cols, matcher);
    setHits(res);
    setTotal(res.length);
    setCurIdx(res.length ? 0 : -1);
    if (res.length && focusFirst) {
      const h = res[0];
      onHighlight?.(h.r, h.c);
      onJump(h.r, h.c);
    }
  };

  const onFindAll = () => {
    const cols = allowedCols.filter(c => checkedCols.includes(c));
    doSearch(query, cols, opts, true);
  };

  const onFindNext = () => {
    const cols = allowedCols.filter(c => checkedCols.includes(c));
    if (!query.trim() || cols.length===0) return;

    // ✅ hits가 비어있으면 바로 검색 실행
    if (hits.length === 0) {
      doSearch(query, cols, opts, true);
      return;
    }
    if (total === 0) return;

    let next = curIdx + 1;
    if (next >= hits.length) next = 0;
    setCurIdx(next);
    const h = hits[next];
    onHighlight?.(h.r, h.c);
    onJump(h.r, h.c);
  };

  const onDragStart = (e: React.MouseEvent) => {
    const startX = e.clientX - pos.x;
    const startY = e.clientY - pos.y;
    draggingRef.current = { dx: startX, dy: startY };
    window.addEventListener('mousemove', onDragMove);
    window.addEventListener('mouseup', onDragEnd);
  };
  const onDragMove = (e: MouseEvent) => {
    const g = draggingRef.current;
    if (!g) return;
    setPos({ x: e.clientX - g.dx, y: e.clientY - g.dy });
  };
  const onDragEnd = () => {
    draggingRef.current = null;
    window.removeEventListener('mousemove', onDragMove);
    window.removeEventListener('mouseup', onDragEnd);
  };

  const handleClose = () => {
    setHits([]); setTotal(0); setCurIdx(-1);
    onHighlight?.(Number.NaN as any, Number.NaN as any);
    onClose();
  };

  const toggleCol = (col: string) => {
    const set = new Set(checkedCols);
    if (set.has(col)) set.delete(col); else set.add(col);
    const next = allowedCols.filter(c => set.has(c));
    onChangeCheckedCols(next);
    try { localStorage.setItem(STORAGE_COLS, JSON.stringify(next)); } catch {}
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_COLS);
      if (raw) {
        const saved: string[] = JSON.parse(raw);
        const valid = allowedCols.filter(c => saved.includes(c));
        if (valid.length) onChangeCheckedCols(valid);
        else onChangeCheckedCols(allowedCols);
      } else {
        onChangeCheckedCols(allowedCols);
      }
    } catch {
      onChangeCheckedCols(allowedCols);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="fixed z-50 w-[360px] rounded-lg border shadow bg-white"
      style={{ left: pos.x, top: pos.y }}
    >
      <div
        className="cursor-move px-3 py-2 text-sm font-semibold bg-gray-100 border-b select-none"
        onMouseDown={onDragStart}
      >
        찾기
      </div>

      <div className="p-3 space-y-3">
        <div className="text-xs">
          <div className="mb-1 font-semibold">열 선택</div>
          <div className="flex flex-wrap gap-2">
            {allowedCols.map(col => (
              <label key={col} className="inline-flex items-center gap-1 border rounded px-2 py-1">
                <input
                  type="checkbox"
                  checked={checkedCols.includes(col)}
                  onChange={() => toggleCol(col)}
                />
                {col}
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <input
            className="w-full border rounded px-2 py-1 text-sm"
            placeholder="찾을 내용"
            value={query}
            onChange={(e)=>setQuery(e.target.value)}
            onKeyDown={(e)=>{ if (e.key==='Enter') onFindNext(); }}
          />
          <div className="flex flex-wrap gap-3 text-xs">
            <label className="inline-flex items-center gap-1">
              <input
                type="checkbox"
                checked={opts.caseSensitive}
                onChange={(e)=>setOpts(v=>({ ...v, caseSensitive:e.target.checked }))}
              />
              대소문자 구분
            </label>
            <label className="inline-flex items-center gap-1">
              <input
                type="checkbox"
                checked={opts.wholeCell}
                onChange={(e)=>setOpts(v=>({ ...v, wholeCell:e.target.checked }))}
              />
              전체 일치
            </label>
            <label className="inline-flex items-center gap-1">
              <input
                type="checkbox"
                checked={opts.wildcard}
                onChange={(e)=>setOpts(v=>({ ...v, wildcard:e.target.checked }))}
              />
              와일드카드(*,?)
            </label>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button className="px-2 py-1 text-xs border rounded hover:bg-gray-50" onClick={onFindAll}>
            모두 찾기
          </button>
          <button className="px-2 py-1 text-xs border rounded hover:bg-gray-50" onClick={onFindNext}>
            다음 찾기
          </button>
          <div className="ml-auto text-xs text-gray-600">
            건수: {total}{hits.length?` (${curIdx+1}/${hits.length})`:''}
          </div>
        </div>

        <div className="max-h-48 overflow-auto border rounded">
          {hits.length === 0 ? (
            <div className="text-xs text-gray-400 p-2">결과 없음</div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="border px-2 py-1 text-left">행</th>
                  <th className="border px-2 py-1 text-left">열</th>
                  <th className="border px-2 py-1 text-left">값</th>
                </tr>
              </thead>
              <tbody>
                {hits.map((h, i) => {
                  const colName = allowedCols.filter(c => checkedCols.includes(c))[h.c] ?? '';
                  const active = i === curIdx;
                  return (
                    <tr
                      key={`${h.r}-${h.c}-${i}`}
                      className={active ? 'bg-blue-50 cursor-pointer' : 'hover:bg-gray-50 cursor-pointer'}
                      onClick={() => {
                        setCurIdx(i);
                        onHighlight?.(h.r, h.c);
                        onJump(h.r, h.c);
                      }}
                    >
                      <td className="border px-2 py-1">{h.r+1}</td>
                      <td className="border px-2 py-1">{colName}</td>
                      <td className="border px-2 py-1 truncate" title={h.value}>{h.value}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex justify-end">
          <button className="px-2 py-1 text-xs border rounded hover:bg-gray-50" onClick={handleClose}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}






