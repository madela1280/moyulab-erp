'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

type Row = Record<string, string>;

type Hit = {
  r: number;   // 행 index
  c: number;   // 열 index (cols 배열 기준)
  colName: string;
  value: string;
};

type Props = {
  rows: Row[];
  columns: string[];                    // 화면에 렌더중인 전체 컬럼(순서 포함)
  checked: Record<number, boolean>;     // 체크된 행만 검색하려면 사용
  onJump: (r: number, c: number) => void;
  onHighlight: (r: number, c: number) => void;
  onClose: () => void;
};

const TARGET_COLS = ['수취인명', '연락처1', '연락처2', '계약자주소', '기기번호'];
const LS_COLS = 'find_checkedCols';
const LS_POS  = 'find_panel_pos';

function normalize(s: string) {
  return (s ?? '').toString();
}

/** 간단 부분일치 (대소문자 무시) */
function match(text: string, q: string) {
  if (!q) return false;
  return text.toLowerCase().includes(q.toLowerCase());
}

export default function FindPanel({
  rows,
  columns,
  checked,
  onJump,
  onHighlight,
  onClose,
}: Props) {
  /** ── 패널 위치 (드래그 가능) ───────────────────────────────────────── */
  const [pos, setPos] = useState<{ left: number; top: number }>(() => {
    try {
      const raw = localStorage.getItem(LS_POS);
      return raw ? JSON.parse(raw) : { left: 80, top: 120 };
    } catch {
      return { left: 80, top: 120 };
    }
  });
  const dragRef = useRef<{ x: number; y: number; offX: number; offY: number } | null>(null);

  const onDragStart = (e: React.MouseEvent) => {
    dragRef.current = { x: e.clientX, y: e.clientY, offX: pos.left, offY: pos.top };
  };
  const onDragMove = (e: React.MouseEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    setPos({ left: dragRef.current.offX + dx, top: dragRef.current.offY + dy });
  };
  const onDragEnd = () => {
    dragRef.current = null;
    localStorage.setItem(LS_POS, JSON.stringify(pos));
  };

  /** ── 열 체크 (처음부터 모두 체크 + 저장/복원) ──────────────────────── */
  const [selCols, setSelCols] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(LS_COLS);
      if (raw) return new Set<string>(JSON.parse(raw));
      // 처음엔 5개 모두 체크
      return new Set<string>(TARGET_COLS);
    } catch {
      return new Set<string>(TARGET_COLS);
    }
  });
  useEffect(() => {
    localStorage.setItem(LS_COLS, JSON.stringify(Array.from(selCols)));
  }, [selCols]);

  const toggleCol = (name: string) => {
    setSelCols(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  /** ── 검색 상태 ───────────────────────────────────────────────────── */
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [idx, setIdx] = useState<number>(-1);
  const [total, setTotal] = useState(0);
  const [pendingStep, setPendingStep] = useState<0 | 1 | -1>(0); // 0: 없음, 1: next, -1: prev

  // rows/columns가 바뀌거나 검색어가 바뀌면 이전 결과 초기화
  useEffect(() => {
    setHits([]);
    setIdx(-1);
    setTotal(0);
    setPendingStep(0);
  }, [rows, columns, q, selCols]);

  /** ── 워커 (있으면 사용, 없으면 로컬 검색) ─────────────────────────── */
  const workerRef = useRef<Worker | null>(null);
  useEffect(() => {
    try {
      // 경로: app/components/FindPanel.tsx -> ../../workers/findWorker.ts
      const w = new Worker(new URL('../workers/findWorker.ts', import.meta.url));
      workerRef.current = w;
      w.onmessage = (e: MessageEvent<{ total: number; hits: Hit[] }>) => {
        setTotal(e.data.total);
        setHits(e.data.hits);
      };
      return () => {
        w.terminate();
        workerRef.current = null;
      };
    } catch {
      workerRef.current = null; // 로컬 검색으로 fallback
    }
  }, []);

  /** 체크된 행만 사용할지 결정 */
  const activeRowIdxs = useMemo(() => {
    const ids = Object.keys(checked).filter(k => checked[+k]).map(Number);
    return ids.length ? ids : rows.map((_, i) => i);
  }, [checked, rows]);

  /** 선택된 열 이름(실제 존재하는 열과 교집합) */
  const enabledCols = useMemo(() => {
    const set = new Set(selCols);
    return columns.filter(c => set.has(c));
  }, [columns, selCols]);

  /** 검색 실행 (워커 또는 로컬) */
  const runSearch = () => {
    if (!q.trim() || enabledCols.length === 0) {
      setHits([]);
      setIdx(-1);
      setTotal(0);
      return;
    }

    // 워커 사용
    if (workerRef.current) {
      const payload = {
        q,
        columns: enabledCols,
        // 전송 비용을 줄이기 위해 필요한 행만 압축해서 보냄
        rows: activeRowIdxs.map(i => rows[i]),
      };
      workerRef.current.postMessage(payload);
      return;
    }

    // 로컬 검색 (fallback)
    const out: Hit[] = [];
    const colIdxMap = new Map<string, number>();
    enabledCols.forEach(name => colIdxMap.set(name, columns.indexOf(name)));

    for (const i of activeRowIdxs) {
      const r = rows[i];
      for (const colName of enabledCols) {
        const cIdx = colIdxMap.get(colName) ?? -1;
        const v = normalize(r[colName]);
        if (cIdx >= 0 && match(v, q)) {
          out.push({ r: i, c: cIdx, colName, value: v });
        }
      }
    }
    setHits(out);
    setTotal(out.length);
  };

  /** “다음/이전 찾기”가 먼저 눌려도 자동으로 검색 후 이동 */
  useEffect(() => {
    if (!pendingStep) return;
    if (hits.length === 0) return; // 검색 완료를 기다림(runSearch 후)
    if (pendingStep > 0) {
      const ni = idx < 0 ? 0 : (idx + 1) % hits.length;
      setIdx(ni);
      const h = hits[ni];
      onHighlight(h.r, h.c);
      onJump(h.r, h.c);
    } else {
      const ni = idx < 0 ? 0 : (idx - 1 + hits.length) % hits.length;
      setIdx(ni);
      const h = hits[ni];
      onHighlight(h.r, h.c);
      onJump(h.r, h.c);
    }
    setPendingStep(0);
  }, [hits, pendingStep, idx, onHighlight, onJump]);

  const onFindAll = () => {
    runSearch();
    // 모두찾기는 이동하지 않고 목록/건수만 갱신
  };

  const onNext = () => {
    if (!q.trim() || enabledCols.length === 0) return;
    if (hits.length === 0) {
      runSearch();          // 먼저 검색을 돌리고
      setPendingStep(1);    // 결과 오면 첫 항목으로 이동
      return;
    }
    const ni = idx < 0 ? 0 : (idx + 1) % hits.length;
    setIdx(ni);
    const h = hits[ni];
    onHighlight(h.r, h.c);
    onJump(h.r, h.c);
  };

  const resultLabel = (h: Hit) => `[${h.colName}] ${h.value}`;

  return (
    <div
      className="fixed z-50 w-[360px] select-none"
      style={{ left: pos.left, top: pos.top }}
      onMouseMove={onDragMove}
      onMouseUp={onDragEnd}
      onMouseLeave={onDragEnd}
    >
      <div className="bg-white border rounded shadow">
        {/* 헤더 (드래그 핸들) */}
        <div
          className="px-3 py-2 border-b text-sm font-semibold cursor-move bg-gray-50"
          onMouseDown={onDragStart}
        >
          찾기
        </div>

        <div className="p-3 space-y-2 text-sm">
          {/* 열 체크 (5개 모두, 기본 전체 선택) */}
          <div className="grid grid-cols-2 gap-y-2 gap-x-4">
            {TARGET_COLS.map(name => (
              <label key={name} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selCols.has(name)}
                  onChange={() => toggleCol(name)}
                />
                {name}
              </label>
            ))}
          </div>

          {/* 검색어 */}
          <input
            className="w-full border rounded px-2 py-1 text-sm"
            placeholder="찾을 내용 입력"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onNext();
            }}
          />

          {/* 버튼들 */}
          <div className="flex items-center gap-2">
            <button
              className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50"
              onClick={onFindAll}
              title="전체 결과 목록 및 건수 갱신"
            >
              모두찾기
            </button>
            <button
              className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50"
              onClick={onNext}
              title="현재 검색어로 다음 위치로 이동"
            >
              다음찾기
            </button>
            <button
              className="ml-auto px-3 py-1.5 text-sm border rounded hover:bg-gray-50"
              onClick={() => {
                onHighlight?.(-1 as any, -1 as any); // 부모에서 hl 초기화하는 경우만
                onClose();
              }}
            >
              닫기
            </button>
          </div>

          {/* 결과 요약 */}
          <div className="text-xs text-gray-600">
            결과: {total} (체크된 행 {activeRowIdxs.length} / 열 {enabledCols.length})
          </div>

          {/* 결과 리스트 (클릭 시 점프) */}
          <div className="max-h-44 overflow-auto border rounded">
            {hits.length === 0 ? (
              <div className="text-xs text-gray-400 p-2">검색 결과 없음</div>
            ) : (
              <ul className="text-xs">
                {hits.map((h, i) => (
                  <li
                    key={`${h.r}-${h.c}-${i}`}
                    className={`px-2 py-1 cursor-pointer ${i === idx ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                    onClick={() => {
                      setIdx(i);
                      onHighlight(h.r, h.c);
                      onJump(h.r, h.c);
                    }}
                    title={`r${h.r} c${h.c}`}
                  >
                    {resultLabel(h)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}




