'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { FindRes, FindHit } from '../workers/findWorker';

type Props = {
  rows: Record<string, string>[];
  columns: string[];
  checked: Record<number, boolean>;
  onJump: (r: number, c: number) => void;
  onHighlight: (r: number, c: number) => void;  // 행/열 하이라이트
  onClose: () => void;
};

export default function FindPanel({ rows, columns, checked, onJump, onHighlight, onClose }: Props) {
  const workerRef = useRef<Worker | null>(null);

  // UI 상태
  const [query, setQuery] = useState('');
  const [selCols, setSelCols] = useState<string[]>([]); // 비어있으면 전체 열
  const [hits, setHits] = useState<FindHit[]>([]);
  const [total, setTotal] = useState(0);
  const [cur, setCur] = useState(0);

  // 체크된 행 인덱스
  const checkedIdx = useMemo(() => Object.keys(checked).filter(k => checked[+k]).map(k => +k), [checked]);

  // 워커 생성/해제
  useEffect(() => {
    const w = new Worker(new URL('../workers/findWorker.ts', import.meta.url));
    workerRef.current = w;
    w.onmessage = (e: MessageEvent<FindRes>) => {
      setTotal(e.data.total);
      setHits(e.data.hits);
      setCur(0);
      if (e.data.hits.length) {
        const h = e.data.hits[0];
        onHighlight(h.r, h.c);
        onJump(h.r, h.c);
      }
    };
    return () => { w.terminate(); workerRef.current = null; };
  }, [onJump, onHighlight]);

  // 모두 찾기
  const runFindAll = () => {
    const w = workerRef.current;
    if (!w) return;
    w.postMessage({
      rows,
      columns,
      checkedIndices: checkedIdx,
      query,
      caseSensitive: false,
      wholeCell: false,
      wildcard: false,
      offset: 0,
      limit: 5000,
      columnsToSearch: selCols.length ? selCols : null,
    });
  };

  // 다음 찾기
  const nextOne = () => {
    if (!hits.length) return;
    const i = (cur + 1) % hits.length;
    setCur(i);
    const h = hits[i];
    onHighlight(h.r, h.c);
    onJump(h.r, h.c);
  };

  // 리스트 클릭 이동
  const go = (i: number) => {
    setCur(i);
    const h = hits[i];
    onHighlight(h.r, h.c);
    onJump(h.r, h.c);
  };

  // 열 선택 토글
  const toggleCol = (col: string) => {
    setSelCols(prev => prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]);
  };

  return (
    <div className="bg-white border rounded shadow p-3 w-[380px]">
      {/* 열 선택 */}
      <div className="mb-2">
        <div className="text-[11px] text-gray-500 mb-1">열 선택 (빈 값=전체)</div>
        <div className="flex flex-wrap gap-1 max-h-28 overflow-auto border rounded p-2">
          {columns.map(col => (
            <label key={col} className={`text-xs px-2 py-1 rounded border cursor-pointer ${selCols.includes(col) ? 'bg-blue-50 border-blue-300' : 'hover:bg-gray-50'}`}>
              <input
                type="checkbox"
                className="mr-1"
                checked={selCols.includes(col)}
                onChange={() => toggleCol(col)}
              />
              {col}
            </label>
          ))}
        </div>
      </div>

      {/* 찾을 내용 */}
      <div className="mb-2">
        <div className="text-[11px] text-gray-500 mb-1">찾을 내용</div>
        <input
          className="w-full border rounded px-2 py-1 text-sm"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="예: 이슬아"
        />
      </div>

      {/* 버튼들 */}
      <div className="flex gap-2 mb-2">
        <button className="px-2 py-1 text-xs border rounded hover:bg-gray-50" onClick={runFindAll}>모두 찾기</button>
        <button className="px-2 py-1 text-xs border rounded hover:bg-gray-50" onClick={nextOne}>다음 찾기</button>
        <button className="ml-auto px-2 py-1 text-xs border rounded hover:bg-gray-50" onClick={onClose}>닫기</button>
      </div>

      {/* 결과 표시 */}
      <div className="text-[11px] text-gray-500 mb-1">결과: {total}건</div>
      <div className="max-h-56 overflow-auto border rounded">
        {hits.map((h, i) => (
          <button
            key={`${h.r}-${h.c}-${i}`}
            className={`w-full text-left text-xs px-2 py-1 border-b last:border-b-0 ${i===cur ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
            onClick={() => go(i)}
            title={`${columns[h.c]} • r${h.r+1}`}
          >
            <span className="text-gray-500 mr-2">{columns[h.c]}</span>
            <span className="truncate inline-block max-w-[250px] align-bottom">{h.v || '(빈 값)'}</span>
          </button>
        ))}
        {!hits.length && <div className="text-xs text-gray-400 p-2">검색 결과 없음</div>}
      </div>
    </div>
  );
}
