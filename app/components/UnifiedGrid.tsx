'use client';
import React, { useEffect, useState } from 'react';
import { io } from "socket.io-client";
const socket = io();

type Row = Record<string, string>;

const FALLBACK_COLUMNS: string[] = [
  '거래처분류','상태','안내분류','구매/렌탈','기기번호','기종','에러횟수','제품',
  '수취인명','연락처1','연락처2','계약자주소','택배발송일','시작일','종료일',
  '반납요청일','반납완료일','특이사항1','특이사항2','총연장횟수','신청일',
  '0차연장','1차연장','2차연장','3차연장','4차연장','5차연장'
];

export default function UnifiedGrid() {
  const [rows, setRows] = useState<Row[]>([]);
  const [columns, setColumns] = useState<string[]>(FALLBACK_COLUMNS);
  const [loading, setLoading] = useState(true);

  // ✅ 주기적 자동 새로고침 (5초마다 DB에서 최신 데이터 불러오기)
 useEffect(() => {
  const fetchRows = async () => {
    const res = await fetch('/api/unified');
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) setRows(data);
   setLoading(false);
  };
  fetchRows();
  const timer = setInterval(fetchRows, 2000);
  return () => clearInterval(timer);
}, []);

useEffect(() => {
  socket.on("update", (data) => {
    setRows(data);
  });
  return () => {
    socket.off("update");
  };
}, []);

  // ✅ 입력 변경 시 즉시 반영 + 자동저장
  const handleChange = async (rIdx: number, key: string, value: string) => {
  setRows(prev => {
    const next = [...prev];
    next[rIdx] = { ...next[rIdx], [key]: value };
    autoSave(next);
    socket.emit("update", next); // ✅ 변경사항 전송
    return next;
  });
};

  // ✅ 자동저장 함수
  const autoSave = async (nextRows: Row[]) => {
    try {
      await fetch('/api/unified', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: nextRows }),
      });
      console.log('✅ 자동저장 완료');
    } catch (err) {
      console.error('❌ 자동저장 실패:', err);
    }
  };

  // ✅ 행 추가 버튼
  const addRow = () => {
    setRows(prev => {
      const next = [...prev, Object.fromEntries(columns.map(c => [c, '']))];
      autoSave(next);
      return next;
    });
  };

  return (
    <div className="p-4">
      <div className="flex gap-2 mb-2">
        <button onClick={addRow} className="px-2 py-1 border rounded bg-blue-100">
          행 추가 (자동저장)
        </button>
      </div>

      {loading ? (
        <p>로딩 중...</p>
      ) : (
        <table className="min-w-[2000px] border border-gray-300 text-xs">
          <thead>
            <tr className="bg-gray-100">
              {columns.map(c => (
                <th key={c} className="border px-1 py-0.5">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rIdx) => (
              <tr key={rIdx}>
                {columns.map(c => (
                  <td key={c} className="border px-1">
                    <input
                      value={row[c] ?? ''}
                      onChange={e => handleChange(rIdx, c, e.target.value)}
                      className="w-full border-0 outline-none text-[11px]"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
