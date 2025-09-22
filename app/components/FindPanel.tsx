'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type Row = Record<string, string>;

type Hit = { r: number; c: number; colName: string; value: string };

export default function FindPanel({
  rows,
  columns,
  checked,
  onJump,
  onHighlight,
  onClose,
}: {
  rows: Row[];
  columns: string[];
  checked: Record<number, boolean>;
  onJump: (r: number, c: number) => void;
  onHighlight?: (r: number, c: number) => void;
  onClose: () => void;
}) {
  // --- 열 선택: 허용 컬럼만 ---
  const ALLOWED = useMemo(
    () => new Set(['수취인명', '연락처1', '연락처2', '계약자주소']),
    []
  );
  const allowedCols = useMemo(
    () => columns.filter((c) => ALLOWED.has(c)),
    [columns, ALLOWED]
  );
  const [colSet, setColSet] = useState<Set<string>>(
    () => new Set(allowedCols)
  );
  useEffect(() => {
    // 컬럼 구성이 바뀌면 교차 보정
    const next = new Set<string>();
    allowedCols.forEach((c) => colSet.has(c) && next.add(c));
    // 하나도 없으면 전부 선택
    if (next.size === 0) allowedCols.forEach((c) => next.add(c));
    setColSet(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowedCols.join('|')]);

  const toggleCol = (c: string) => {
    setColSet((prev) => {
      const n = new Set(prev);
      if (n.has(c)) n.delete(c);
      else n.add(c);
      return n;
    });
  };

  // --- 검색어/결과 ---
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [idx, setIdx] = useState<number>(-1);

  // --- 드래그로 이동(분리) ---
  const [detached, setDetached] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 24, y: 80 });
  const draggingRef = useRef<{ dx: number; dy: number } | null>(null);

  const onDragStart = (e: React.MouseEvent) => {
    // 처음 드래그하면 곧바로 포털로 전환
    if (!detached) setDetached(true);
    const startX = e.clientX;
    const startY = e.clientY;
    const { x, y } = pos;
    draggingRef.current = { dx: startX - x, dy: startY - y };
    window.addEventListener('mousemove', onDragMove);
    window.addEventListener('mouseup', onDragEnd, { once: true });
  };
  const onDragMove = (e: MouseEvent) => {
    if (!draggingRef.current) return;
    const { dx, dy } = draggingRef.current;
    setPos({ x: e.clientX - dx, y: e.clientY - dy });
  };
  const onDragEnd = () => {
    draggingRef.current = null;
    window.removeEventListener('mousemove', onDragMove);
  };

  // --- 유틸: 매치 판정(간단: 부분 일치, 대소문자 구분 안 함) ---
  const match = (val: string, query: string) => {
    if (!query) return false;
    return (val ?? '').toString().toLowerCase().includes(query.toLowerCase());
  };

  // --- 모두 찾기 ---
  const doFindAll = () => {
    const activeCols = allowedCols.filter((c) => colSet.has(c));
    const colIndex = new Map(activeCols.map((c, i) => [c, i]));
    const out: Hit[] = [];
    rows.forEach((r, ri) => {
      if (Object.keys(checked).length && !checked[ri]) return; // 체크된 행만
      activeCols.forEach((c) => {
        const v = (r[c] ?? '').toString();
        if (match(v, q)) out.push({ r: ri, c: columns.indexOf(c), colName: c, value: v });
      });
    });
    setHits(out);
    setIdx(out.length ? 0 : -1);
    if (out.length && onHighlight) onHighlight(out[0].r, out[0].c);
  };

  // --- 다음 찾기 ---
  const doNext = () => {
    if (!hits.length) {
      doFindAll();
      return;
    }
    const ni = (idx + 1) % hits.length;
    setIdx(ni);
    const h = hits[ni];
    onJump(h.r, h.c);
    onHighlight?.(h.r, h.c);
  };

  // --- 결과 리스트 클릭 ---
  const jumpToHit = (i: number) => {
    const h = hits[i];
    setIdx(i);
    onJump(h.r, h.c);
    onHighlight?.(h.r, h.c);
  };

  // --- 패널 UI ---
  const panel = (
    <div
      className="bg-white border rounded shadow-lg w-[360px] text-sm select-none"
      style={{ userSelect: 'none' }}
    >
      {/* 드래그 핸들 */}
      <div
        className="cursor-move px-3 py-2 border-b font-semibold bg-gray-50 flex items-center justify-between drag-handle"
        onMouseDown={onDragStart}
        title="드래그하여 창 이동"
      >
        열 선택 (빈 값-전체)
        <button
          className="ml-2 px-2 py-0.5 text-xs border rounded hover:bg-gray-100"
          onClick={onClose}
          title="닫기"
        >
          닫기
        </button>
      </div>

      {/* 열 체크 */}
      <div className="p-3 grid grid-cols-2 gap-2">
        {allowedCols.map((c) => (
          <label key={c} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={colSet.has(c)}
              onChange={() => toggleCol(c)}
            />
            {c}
          </label>
        ))}
      </div>

      {/* 검색어 */}
      <div className="px-3 pb-2">
        <div className="mb-1">찾을 내용</div>
        <input
          className="w-full border rounded px-2 py-1"
          placeholder="예: 나진영"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') doNext();
          }}
        />
      </div>

      {/* 버튼들 */}
      <div className="px-3 pb-2 flex gap-2">
        <button
          className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
          onClick={doFindAll}
        >
          모두 찾기
        </button>
        <button
          className="px-3 py-1 text-xs border rounded hover:bg-gray-50"
          onClick={doNext}
        >
          다음 찾기
        </button>
      </div>

      {/* 결과 요약 */}
      <div className="px-3 pb-2 text-xs text-gray-600">
        결과: {hits.length}{hits.length ? ` (현재 ${idx + 1}/${hits.length})` : ' (전체 검색)'}
      </div>

      {/* 결과 리스트 */}
      <div className="px-3 pb-3 max-h-40 overflow-auto">
        {hits.length === 0 ? (
          <div className="text-xs text-gray-400">검색 결과 없음</div>
        ) : (
          <ul className="text-xs">
            {hits.map((h, i) => (
              <li key={`${h.r}-${h.c}-${i}`}>
                <button
                  className={`w-full text-left px-2 py-1 rounded ${
                    i === idx ? 'bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                  onClick={() => jumpToHit(i)}
                  title={`${h.colName} r${h.r + 1} c${h.c + 1}`}
                >
                  [{h.colName}] {h.value}
                  <span className="text-gray-400 ml-2">r{h.r + 1} c{h.c + 1}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );

  // detached 되면 포털로만 렌더 => 원래 자리에서 사라짐
  if (detached) {
    return createPortal(
      <div
        style={{
          position: 'fixed',
          left: pos.x,
          top: pos.y,
          zIndex: 1000,
        }}
      >
        {panel}
      </div>,
      document.body
    );
  }

  // 도킹 상태(버튼 아래 등 원래 위치)에 렌더
  return panel;
}


