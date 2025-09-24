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

type Hit = { r: number; c: number; value: string };

// ?덉슜 ??
const ALLOWED = ['?섏랬?몃챸', '?곕씫泥?', '?곕씫泥?', '怨꾩빟?먯＜??, '湲곌린踰덊샇'];
const STORAGE_COLS = 'find_checkedCols';
const STORAGE_QUERY = 'find_lastQuery';

function normalizeCols(all: string[]) {
  return all.filter(c => ALLOWED.includes(c));
}

function searchSync(rows: Row[], cols: string[], q: string): Hit[] {
  const query = q.trim();
  if (!query) return [];
  const out: Hit[] = [];
  const lowerQ = query.toLowerCase();
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    for (let ci = 0; ci < cols.length; ci++) {
      const cname = cols[ci];
      const v = (row[cname] ?? '').toString();
      if (!v) continue;
      if (v.toLowerCase().includes(lowerQ)) out.push({ r, c: ci, value: v });
    }
  }
  return out;
}

export default function FindPanel({
  rows,
  columns,
  checked,
  checkedCols,
  onChangeCheckedCols,
  onJump,
  onHighlight,
  onClose,
}: Props) {
  // ?⑤꼸 ?꾩튂(?쒕옒洹?
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 24, y: 60 });
  const draggingRef = useRef<{ dx: number; dy: number } | null>(null);

  const allowedCols = useMemo(() => normalizeCols(columns), [columns]);

  // 珥덇린 泥댄겕: ??κ컪 ?덉쑝硫?蹂듭썝, ?놁쑝硫??덉슜???꾩껜
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_COLS);
      if (raw) {
        const saved: string[] = JSON.parse(raw);
        const valid = allowedCols.filter(c => saved.includes(c));
        onChangeCheckedCols(valid.length ? valid : allowedCols);
      } else {
        onChangeCheckedCols(allowedCols);
      }
    } catch {
      onChangeCheckedCols(allowedCols);
    }
    // allowedCols 蹂??????踰??숆린??

  // ?뚯빱 ?앹꽦/?댁젣
    useEffect(() => {
    const w = new Worker(new URL('../workers/findWorker.ts', import.meta.url));
    workerRef.current = w;
    w.onmessage = (e: MessageEvent<FindRes>) => {
      setTotal(e.data.total);
      setHits(e.data.hits);
    };
    return () => { w.terminate(); workerRef.current = null; };
  }, []);

  // ?붾컮?댁뒪 寃??
  const runSearch = (offset=page*LIMIT) => {
    const req: FindReq = {
      rows, columns, checkedIndices,
      query, caseSensitive, wholeCell, wildcard,
      offset, limit: LIMIT,
    };
    workerRef.current?.postMessage(req);
  };
  useEffect(() => {
    const t = setTimeout(() => { setPage(0); runSearch(0); }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowedCols.join('|')]);

  // 寃?됱뼱
  const [query, setQuery] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_QUERY) ?? '';
    } catch {
      return '';
    }
  });

  // 寃곌낵 ?곹깭
  const [hits, setHits] = useState<Hit[]>([]);
  const [total, setTotal] = useState(0);
  const [curIdx, setCurIdx] = useState(-1);

  // ??泥댄겕 ?좉? + ???
  const toggleCol = (col: string) => {
    const set = new Set(checkedCols);
    if (set.has(col)) set.delete(col);
    else set.add(col);
    const next = allowedCols.filter(c => set.has(c));
    onChangeCheckedCols(next);
    try {
      localStorage.setItem(STORAGE_COLS, JSON.stringify(next));
    } catch {}
  };

  // ?쒕옒洹??몃뱾
  const onDragStart = (e: React.MouseEvent) => {
    draggingRef.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
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

  // 怨듯넻 寃???ㅽ뻾
  const runSearch = (focusFirst: boolean) => {
    const cols = allowedCols.filter(c => checkedCols.includes(c));
    const res = searchSync(rows, cols, query);
    setHits(res);
    setTotal(res.length);
    if (res.length && focusFirst) {
      setCurIdx(0);
      const h = res[0];
      onHighlight?.(h.r, h.c);
      onJump(h.r, h.c);
    } else {
      setCurIdx(-1);
    }
  };

  // 紐⑤몢 李얘린
  const onFindAll = () => {
    runSearch(true);
  };

  // ?ㅼ쓬 李얘린 (?ъ쟾 紐⑤몢李얘린 ?놁씠???숈옉)
  const onFindNext = () => {
    const cols = allowedCols.filter(c => checkedCols.includes(c));
    if (!query.trim() || cols.length === 0) return;

    if (hits.length === 0) {
      runSearch(true);
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

  // ?リ린
  const handleClose = () => {
    setHits([]);
    setTotal(0);
    setCurIdx(-1);
    onHighlight?.(Number.NaN as any, Number.NaN as any); // 遺紐⑥뿉??null 泥섎━
    onClose();
  };

  return (
    <div
      className="fixed z-50 w-[360px] rounded-lg border shadow bg-white"
      style={{ left: pos.x, top: pos.y }}
    >
      {/* ?쒕옒洹??몃뱾 */}
      <div
        className="cursor-move px-3 py-2 text-sm font-semibold bg-gray-100 border-b select-none"
        onMouseDown={onDragStart}
      >
        李얘린
      </div>

      <div className="p-3 space-y-3">
        {/* ???좏깮 */}
        <div className="text-xs">
          <div className="mb-1 font-semibold">???좏깮</div>
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

        {/* 寃?됱뼱 */}
        <div className="space-y-2">
          <input
            className="w-full border rounded px-2 py-1 text-sm"
            placeholder="李얠쓣 ?댁슜"
            value={query}
            onChange={e => {
              const v = e.target.value;
              setQuery(v);
              try {
                localStorage.setItem(STORAGE_QUERY, v);
              } catch {}
              // ?낅젰??諛붾뚮㈃ ?댁쟾 寃곌낵/?ъ빱??珥덇린????'?ㅼ쓬 李얘린' ?⑤룆 ????寃??
              setHits([]);
              setTotal(0);
              setCurIdx(-1);
              onHighlight?.(Number.NaN as any, Number.NaN as any);
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') onFindNext();
            }}
          />
        </div>

        {/* ?≪뀡 */}
        <div className="flex items-center gap-2">
          <button className="px-2 py-1 text-xs border rounded hover:bg-gray-50" onClick={onFindAll}>
            紐⑤몢 李얘린
          </button>
          <button className="px-2 py-1 text-xs border rounded hover:bg-gray-50" onClick={onFindNext}>
            ?ㅼ쓬 李얘린
          </button>
          <div className="ml-auto text-xs text-gray-600">
            嫄댁닔: {total}
            {hits.length ? ` (${curIdx + 1}/${hits.length})` : ''}
          </div>
        </div>

        {/* 寃곌낵 由ъ뒪??*/}
        <div className="max-h-48 overflow-auto border rounded">
          {hits.length === 0 ? (
            <div className="text-xs text-gray-400 p-2">寃곌낵 ?놁쓬</div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="border px-2 py-1 text-left">??/th>
                  <th className="border px-2 py-1 text-left">??/th>
                  <th className="border px-2 py-1 text-left">媛?/th>
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
                      <td className="border px-2 py-1">{h.r + 1}</td>
                      <td className="border px-2 py-1">{colName}</td>
                      <td className="border px-2 py-1 truncate" title={h.value}>
                        {h.value}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex justify-end">
          <button className="px-2 py-1 text-xs border rounded hover:bg-gray-50" onClick={handleClose}>
            ?リ린
          </button>
        </div>
      </div>
    </div>
  );
}


