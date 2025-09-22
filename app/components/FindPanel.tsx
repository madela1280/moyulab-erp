'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

type Row = Record<string, string>;

type Props = {
  /** 전체 행 */
  rows: Row[];
  /** 화면에 보이는 컬럼 라벨 배열 */
  columns: string[];
  /** 체크된 행 인덱스 맵 (없으면 전체 검색) */
  checked?: Record<number, boolean>;
  /** 해당 셀로 스크롤 & 선택 이동 */
  onJump: (r: number, c: number) => void;
  /** 현재 매치 좌표를 넘겨 행/열 전체 하이라이트 */
  onHighlight: (r: number, c: number) => void;
  /** 패널 닫기 */
  onClose: () => void;
};

/** 허용되는 열만 선택 가능 (요구사항) */
const ALLOWED_COLS = new Set(['수취인명', '연락처1', '연락처2', '계약자주소']);

type Hit = { r: number; c: number; value: string };

export default function FindPanel({
  rows,
  columns,
  checked,
  onJump,
  onHighlight,
  onClose,
}: Props) {
  // ───────────────────────────
  // 위치(드래그 이동 가능)
  // ───────────────────────────
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: 460, top: 110 });
  const dragRef = useRef<{ ox: number; oy: number; sx: number; sy: number } | null>(null);

  const onDragStart = (e: React.MouseEvent) => {
    dragRef.current = { ox: e.clientX, oy: e.clientY, sx: pos.left, sy: pos.top };
    window.addEventListener('mousemove', onDragging);
    window.addEventListener('mouseup', onDragEnd);
  };
  const onDragging = (e: MouseEvent) => {
    if (!dragRef.current) return;
    const { ox, oy, sx, sy } = dragRef.current;
    setPos({ left: sx + (e.clientX - ox), top: sy + (e.clientY - oy) });
  };
  const onDragEnd = () => {
    window.removeEventListener('mousemove', onDragging);
    window.removeEventListener('mouseup', onDragEnd);
    dragRef.current = null;
  };

  // ───────────────────────────
  // 열 선택 (허용된 4개만)
  // ───────────────────────────
  const selectableCols = useMemo(
    () => columns.filter((c) => ALLOWED_COLS.has(c)),
    [columns]
  );
  const [colSet, setColSet] = useState<Set<string>>(
    () => new Set(selectableCols) // 기본: 전부 선택
  );
  useEffect(() => {
    // 컬럼 순서/구성이 바뀌면 교정
    const next = new Set<string>();
    selectableCols.forEach((c) => next.add(c));
    setColSet((prev) => {
      const out = new Set<string>();
      next.forEach((c) => {
        if (prev.has(c)) out.add(c);
        else out.add(c);
      });
      return out;
    });
  }, [selectableCols.join('|')]);

  const toggleCol = (c: string, on: boolean) => {
    setColSet((prev) => {
      const n = new Set(prev);
      if (on) n.add(c);
      else n.delete(c);
      return n;
    });
  };

  // ───────────────────────────
  // 검색어 & 결과
  // ───────────────────────────
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [idx, setIdx] = useState<number>(-1); // 현재 선택된 결과 인덱스

  // 체크된 행만 사용할지 판단
  const activeRowIndexes = useMemo(() => {
    const checkedIndexes =
      checked && Object.keys(checked).some((k) => checked[+k])
        ? Object.keys(checked)
            .filter((k) => checked![+k])
            .map((k) => +k)
            .sort((a, b) => a - b)
        : null; // null이면 전체
    return checkedIndexes;
  }, [checked]);

  const runFindAll = () => {
    const needles = q.trim();
    const useCols = columns
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => colSet.has(c));
    if (!needles || useCols.length === 0) {
      setHits([]);
      setIdx(-1);
      return;
    }

    const next: Hit[] = [];
    const rowCount = rows.length;

    const rowIndices =
      activeRowIndexes ?? Array.from({ length: rowCount }, (_, i) => i);

    const lower = needles.toLowerCase();

    for (const r of rowIndices) {
      const row = rows[r];
      for (const { c, i } of useCols) {
        const cell = (row?.[c] ?? '').toString();
        if (!cell) continue;
        if (cell.toLowerCase().includes(lower)) {
          next.push({ r, c: i, value: cell });
        }
      }
    }

    setHits(next);
    setIdx(next.length ? 0 : -1);

    if (next.length) {
      const h = next[0];
      onHighlight(h.r, h.c);
      onJump(h.r, h.c);
    }
  };

  const goNext = () => {
    if (!hits.length) {
      runFindAll();
      return;
    }
    const n = (idx + 1) % hits.length;
    setIdx(n);
    const h = hits[n];
    onHighlight(h.r, h.c);
    onJump(h.r, h.c);
  };

  // 검색어 변경 시 결과 초기화(사용자가 다시 모두찾기/다음찾기를 눌러 갱신)
  useEffect(() => {
    setHits([]);
    setIdx(-1);
  }, [q, Array.from(colSet).sort().join('|'), activeRowIndexes?.join(',')]);

  // ───────────────────────────
  // UI
  // ───────────────────────────
  return (
    <div
      className="fixed z-50 bg-white border rounded shadow p-3 w-[360px]"
      style={{ left: pos.left, top: pos.top }}
    >
      {/* 드래그 핸들 */}
      <div
        className="cursor-move font-semibold mb-2 select-none"
        onMouseDown={onDragStart}
      >
        열 선택 (빈 값-전체)
      </div>

      {/* 열 선택 (허용된 4개만) */}
      <div className="border rounded p-2 max-h-28 overflow-auto mb-3 text-sm grid grid-cols-2 gap-1">
        {selectableCols.map((c) => (
          <label key={c} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={colSet.has(c)}
              onChange={(e) => toggleCol(c, e.target.checked)}
            />
            <span>{c}</span>
          </label>
        ))}
        {selectableCols.length === 0 && (
          <div className="text-xs text-gray-500 col-span-2">
            선택 가능한 열이 없습니다.
          </div>
        )}
      </div>

      {/* 찾을 내용 */}
      <div className="mb-2">
        <div className="text-sm mb-1">찾을 내용</div>
        <input
          className="w-full border rounded px-2 py-1 text-sm"
          placeholder="예: 나진영"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') goNext();
          }}
        />
      </div>

      {/* 버튼들 */}
      <div className="flex items-center gap-2 mb-2">
        <button
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          onClick={runFindAll}
        >
          모두 찾기
        </button>
        <button
          className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50"
          onClick={goNext}
        >
          다음 찾기
        </button>
        <button
          className="ml-auto px-3 py-1.5 text-sm border rounded hover:bg-gray-50"
          onClick={onClose}
        >
          닫기
        </button>
      </div>

      {/* 결과 요약 */}
      <div className="text-xs text-gray-600 mb-1">
        결과: <span className="font-semibold">{hits.length}</span>
        {hits.length > 0 && idx >= 0 ? (
          <span> (현재 {idx + 1}/{hits.length})</span>
        ) : null}
        {checked && Object.keys(checked).some((k) => checked[+k]) ? (
          <span className="ml-2 text-gray-500">(체크된 행만 검색)</span>
        ) : (
          <span className="ml-2 text-gray-500">(전체 검색)</span>
        )}
      </div>

      {/* 결과 리스트 (최대 200건 표시) */}
      <div className="border rounded max-h-52 overflow-auto">
        {hits.slice(0, 200).map((h, i) => (
          <button
            key={`${h.r}:${h.c}:${i}`}
            className={`w-full text-left px-2 py-1 text-sm border-b last:border-b-0 hover:bg-blue-50 ${
              i === idx ? 'bg-blue-50' : ''
            }`}
            title={`행 ${h.r + 1}, 열 ${columns[h.c] ?? h.c}`}
            onClick={() => {
              setIdx(i);
              onHighlight(h.r, h.c);
              onJump(h.r, h.c);
            }}
          >
            <div className="flex justify-between gap-2">
              <span className="truncate">
                <span className="text-gray-500 mr-1">[{columns[h.c] ?? h.c}]</span>
                {h.value}
              </span>
              <span className="text-xs text-gray-500 shrink-0">
                r{h.r + 1} c{h.c + 1}
              </span>
            </div>
          </button>
        ))}
        {hits.length === 0 && (
          <div className="px-2 py-3 text-xs text-gray-400">검색 결과 없음</div>
        )}
        {hits.length > 200 && (
          <div className="px-2 py-1 text-[11px] text-gray-500">
            (상위 200건만 표시 중)
          </div>
        )}
      </div>
    </div>
  );
}

