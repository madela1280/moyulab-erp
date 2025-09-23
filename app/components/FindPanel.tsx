'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { FindReq, FindRes, FindHit } from '../workers/findWorker';

type Row = Record<string,string>;

export default function FindPanel({
  rows, columns, checked, onJump, onClose,
}:{
  rows: Row[];
  columns: string[];
  checked: Record<number, boolean>;
  onJump: (r:number, c:number)=>void;   // 셀 하이라이트/포커스
  onClose: ()=>void;
}) {
  const workerRef = useRef<Worker|null>(null);
  const [query, setQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeCell, setWholeCell] = useState(false);
  const [wildcard, setWildcard] = useState(false);
  const [total, setTotal] = useState(0);
  const [hits, setHits] = useState<FindHit[]>([]);
  const [page, setPage] = useState(0);
  const LIMIT = 200;

  const checkedIndices = useMemo(
    () => Object.keys(checked).filter(k => checked[+k]).map(k => +k).sort((a,b)=>a-b),
    [checked]
  );

  // 워커 생성/해제
    useEffect(() => {
    const w = new Worker(new URL('../workers/findWorker.ts', import.meta.url));
    workerRef.current = w;
    w.onmessage = (e: MessageEvent<FindRes>) => {
      setTotal(e.data.total);
      setHits(e.data.hits);
    };
    return () => { w.terminate(); workerRef.current = null; };
  }, []);

  // 디바운스 검색
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
  }, [query, caseSensitive, wholeCell, wildcard, rows, columns, checkedIndices.join(',')]);

  // 페이지 변경 시 재요청
  useEffect(() => { runSearch(page*LIMIT); /* eslint-disable-next-line */ }, [page]);

  // 다음/이전
  const [cursor, setCursor] = useState(0);
  useEffect(() => { setCursor(0); }, [hits, page, total]);

  const jumpToHit = (idx: number) => {
    if (total === 0) return;
    const globalIndex = page*LIMIT + idx;
    const isOutOfPage = idx < 0 || idx >= hits.length;
    if (isOutOfPage) return;
    setCursor(idx);
    const h = hits[idx];
    onJump(h.r, h.c);
  };

  const next = () => jumpToHit(Math.min(cursor + 1, hits.length - 1));
  const prev = () => jumpToHit(Math.max(cursor - 1, 0));

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div className="absolute z-40 mt-2 w-[420px] bg-white border rounded shadow p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold text-sm">찾기 (현재 뷰 · 체크된 행만)</div>
        <button className="text-xs px-2 py-1 border rounded hover:bg-gray-50" onClick={onClose}>닫기</button>
      </div>

      <div className="flex gap-2 mb-2">
        <input
          className="flex-1 border rounded px-2 py-1 text-sm"
          placeholder="검색어 (* 와 ? 와일드카드 지원)"
          value={query}
          onChange={e=>setQuery(e.target.value)}
        />
        <button className="px-2 py-1 text-xs border rounded hover:bg-gray-50" onClick={()=>runSearch(0)}>모두 찾기</button>
      </div>

      <div className="flex flex-wrap gap-3 text-xs mb-2">
        <label className="flex items-center gap-1"><input type="checkbox" checked={caseSensitive} onChange={e=>setCaseSensitive(e.target.checked)} />대소문자</label>
        <label className="flex items-center gap-1"><input type="checkbox" checked={wholeCell} onChange={e=>setWholeCell(e.target.checked)} />셀 전체 일치</label>
        <label className="flex items-center gap-1"><input type="checkbox" checked={wildcard} onChange={e=>setWildcard(e.target.checked)} />와일드카드(*,?)</label>
        <span className="ml-auto text-gray-600">결과: <b>{total}</b>건</span>
      </div>

      <div className="flex items-center gap-2 mb-2">
        <button className="px-2 py-1 text-xs border rounded hover:bg-gray-50" onClick={prev}>이전</button>
        <button className="px-2 py-1 text-xs border rounded hover:bg-gray-50" onClick={next}>다음</button>
        <span className="text-xs text-gray-600">페이지 {page+1}/{totalPages}</span>
        <div className="ml-auto flex items-center gap-1">
          <button className="px-2 py-1 text-xs border rounded hover:bg-gray-50" disabled={page===0} onClick={()=>setPage(p=>Math.max(0,p-1))}>◀</button>
          <button className="px-2 py-1 text-xs border rounded hover:bg-gray-50" disabled={page>=totalPages-1} onClick={()=>setPage(p=>Math.min(totalPages-1,p+1))}>▶</button>
        </div>
      </div>

      <div className="max-h-56 overflow-auto border rounded">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="text-left px-2 py-1 border-b w-14">행</th>
              <th className="text-left px-2 py-1 border-b w-20">열</th>
              <th className="text-left px-2 py-1 border-b">값</th>
            </tr>
          </thead>
          <tbody>
            {hits.map((h, i)=>(
              <tr key={i} className={i===cursor ? 'bg-blue-50' : ''}>
                <td className="px-2 py-1 border-b">{h.r+1}</td>
                <td className="px-2 py-1 border-b">{columns[h.c]}</td>
                <td className="px-2 py-1 border-b truncate">
                  <button className="underline" title={h.v} onClick={()=>jumpToHit(i)}>{h.v || '(빈 값)'}</button>
                </td>
              </tr>
            ))}
            {hits.length===0 && (
              <tr><td className="px-2 py-3 text-center text-gray-500" colSpan={3}>결과 없음</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
