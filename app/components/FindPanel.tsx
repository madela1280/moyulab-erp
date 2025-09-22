'use client';

import React, { useEffect, useRef, useState } from 'react';

type Props = {
  rows: Record<string, string>[];
  columns: string[];
  checked: Record<number, boolean>;
  onJump: (r: number, c: number) => void;
  onHighlight: (r: number, c: number) => void;
  onClose: () => void;
};

// 검색 결과 타입
type Hit = { r: number; c: number; text: string };

export default function FindPanel({ rows, columns, checked, onJump, onHighlight, onClose }: Props) {
  const [search, setSearch] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [curIdx, setCurIdx] = useState<number>(-1);
  const [selCols, setSelCols] = useState<string[]>(['수취인명']);
  const [pos, setPos] = useState({ x: 20, y: 100 }); // 패널 위치
  const dragging = useRef<{ x: number; y: number; sx: number; sy: number } | null>(null);

  // 허용된 열
  const allowedCols = ['수취인명', '연락처1', '연락처2', '계약자주소', '기기번호'];

  // 모두찾기 실행
  const doFindAll = () => {
    if (!search.trim()) return;
    const newHits: Hit[] = [];
    rows.forEach((row, r) => {
      selCols.forEach(c => {
        const val = (row[c] ?? '').toString();
        if (val.includes(search)) {
          newHits.push({ r, c: columns.indexOf(c), text: val });
        }
      });
    });
    setHits(newHits);
    setCurIdx(newHits.length ? 0 : -1);
    if (newHits.length) {
      const h = newHits[0];
      onJump(h.r, h.c);
      onHighlight(h.r, h.c);
    }
  };

  // 다음찾기 실행
  const doNext = () => {
    if (!hits.length) return;
    const nextIdx = (curIdx + 1) % hits.length;
    setCurIdx(nextIdx);
    const h = hits[nextIdx];
    onJump(h.r, h.c);
    onHighlight(h.r, h.c);
  };

  // 닫기
  const doClose = () => {
    setSearch('');
    setHits([]);
    setCurIdx(-1);
    onClose();
  };

  // 드래그 이동
  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current = { x: pos.x, y: pos.y, sx: e.clientX, sy: e.clientY };
  };
  useEffect(() => {
    const mm = (e: MouseEvent) => {
      if (!dragging.current) return;
      const { x, y, sx, sy } = dragging.current;
      setPos({ x: x + (e.clientX - sx), y: y + (e.clientY - sy) });
    };
    const mu = () => { dragging.current = null; };
    window.addEventListener('mousemove', mm);
    window.addEventListener('mouseup', mu);
    return () => { window.removeEventListener('mousemove', mm); window.removeEventListener('mouseup', mu); };
  }, []);

  return (
    <div
      className="fixed z-50 w-[320px] bg-white border rounded shadow"
      style={{ left: pos.x, top: pos.y }}
    >
      {/* 헤더 (드래그 영역) */}
      <div
        className="px-3 py-2 bg-gray-100 border-b cursor-move select-none text-sm font-semibold"
        onMouseDown={onMouseDown}
      >
        찾기
      </div>

      {/* 본문 */}
      <div className="p-3 space-y-2 text-sm">
        {/* 열 선택 */}
        <div className="flex flex-wrap gap-2">
          {allowedCols.map(c => (
            <label key={c} className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={selCols.includes(c)}
                onChange={e => {
                  if (e.target.checked) setSelCols(prev => [...prev, c]);
                  else setSelCols(prev => prev.filter(x => x !== c));
                }}
              />
              {c}
            </label>
          ))}
        </div>

        {/* 검색 입력 */}
        <input
          className="w-full border rounded px-2 py-1"
          placeholder="찾을 내용 입력"
          value={search}
          onChange={e => {
            setSearch(e.target.value);
            setHits([]);
            setCurIdx(-1);
          }}
        />

        {/* 버튼 */}
        <div className="flex gap-2">
          <button
            className="px-3 py-1 text-xs border rounded hover:bg-gray-50"
            onClick={doFindAll}
          >
            모두찾기
          </button>
          <button
            className="px-3 py-1 text-xs border rounded hover:bg-gray-50"
            onClick={doNext}
          >
            다음찾기
          </button>
          <button
            className="ml-auto px-3 py-1 text-xs border rounded hover:bg-gray-50"
            onClick={doClose}
          >
            닫기
          </button>
        </div>

        {/* 결과 리스트 */}
        {hits.length > 0 && (
          <div className="max-h-40 overflow-auto border-t pt-2 mt-2 text-xs">
            {hits.map((h, i) => (
              <div
                key={i}
                className={`px-2 py-1 cursor-pointer ${i === curIdx ? 'bg-blue-100' : 'hover:bg-gray-100'}`}
                onClick={() => {
                  setCurIdx(i);
                  onJump(h.r, h.c);
                  onHighlight(h.r, h.c);
                }}
              >
                {h.text} ({h.r + 1}행 / {columns[h.c]})
              </div>
            ))}
          </div>
        )}
        {hits.length === 0 && search && (
          <div className="text-xs text-gray-400">검색 결과 없음</div>
        )}
      </div>
    </div>
  );
}



