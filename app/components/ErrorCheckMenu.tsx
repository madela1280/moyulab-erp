'use client';

import React, { useMemo, useState } from 'react';

type Row = Record<string, string>;
const LS_UNIFIED_ROWS = 'unified_rows';

function loadUnifiedRows(): Row[] {
  try {
    const raw = localStorage.getItem(LS_UNIFIED_ROWS);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function midBlock(phoneRaw: string): string {
  const d = (phoneRaw || '').replace(/\D+/g, '');
  const m1 = d.match(/^(\d{3})(\d{4})(\d{4})$/);
  if (m1) return m1[2];
  const m2 = d.match(/^(\d{3})(\d{3})(\d{4})$/);
  if (m2) return m2[2];
  if (d.length >= 8) {
    const start = Math.floor((d.length - 4) / 2);
    return d.slice(start, start + 4);
  }
  return '';
}

type ResultItem = {
  key: string;
  거래처분류?: string;
  상태?: string;
  기기번호?: string;
  제품?: string;
  수취인명?: string;
  연락처1?: string;
  택배발송일?: string;
  시작일?: string;
  종료일?: string;
  반납요청일?: string;
  반납완료일?: string;
};

export default function ErrorCheckMenu({ rows }: { rows?: Row[] }) {
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState<null | { kind: 'device' | 'recipient'; rows: ResultItem[] }>(null);

  const sourceRows = useMemo<Row[]>(() => {
    return (rows && Array.isArray(rows) ? rows : loadUnifiedRows()) as Row[];
  }, [rows]);

  const toItem = (r: Row, key: string): ResultItem => ({
    key,
    거래처분류: r['거래처분류'] ?? '',
    상태: r['상태'] ?? '',
    기기번호: r['기기번호'] ?? '',
    제품: r['제품'] ?? '',
    수취인명: r['수취인명'] ?? '',
    연락처1: r['연락처1'] ?? '',
    택배발송일: r['택배발송일'] ?? '',
    시작일: r['시작일'] ?? '',
    종료일: r['종료일'] ?? '',
    반납요청일: r['반납요청일'] ?? '',
    반납완료일: r['반납완료일'] ?? '',
  });

  const runDeviceCheck = () => {
    const active = sourceRows.filter(r => (r['반납완료일'] ?? '') === '');
    const byDevice = new Map<string, ResultItem[]>();
    for (const r of active) {
      const key = (r['기기번호'] ?? '').toString().trim();
      if (!key) continue;
      const item = toItem(r, key);
      if (!byDevice.has(key)) byDevice.set(key, []);
      byDevice.get(key)!.push(item);
    }
    const dupRows: ResultItem[] = [];
    byDevice.forEach(list => { if (list.length > 1) dupRows.push(...list); });
    dupRows.sort((a, b) => (a.기기번호 ?? '').localeCompare(b.기기번호 ?? ''));
    setModal({ kind: 'device', rows: dupRows });
    setOpen(false);
  };

  const runRecipientCheck = () => {
    const active = sourceRows.filter(r => (r['반납완료일'] ?? '') === '');
    const byPerson = new Map<string, ResultItem[]>();
    for (const r of active) {
      const name = (r['수취인명'] ?? '').toString().trim();
      const mid = midBlock((r['연락처1'] ?? '').toString());
      if (!name || !mid) continue;
      const key = `${name}|${mid}`;
      const item = toItem(r, key);
      if (!byPerson.has(key)) byPerson.set(key, []);
      byPerson.get(key)!.push(item);
    }
    const dupRows: ResultItem[] = [];
    byPerson.forEach(list => { if (list.length > 1) dupRows.push(...list); });
    dupRows.sort((a, b) => (a.key ?? '').localeCompare(b.key ?? ''));
    setModal({ kind: 'recipient', rows: dupRows });
    setOpen(false);
  };

  const title = useMemo(() => {
    if (!modal) return '';
    return modal.kind === 'device' ? '기기번호 중복/오류 결과' : '수취인 중복/오류 결과';
  }, [modal]);

  const downloadCSV = () => {
    if (!modal) return;
    const BOM = '\uFEFF';
    const headerOrder = ['거래처분류','상태','기기번호','제품','수취인명','연락처1','택배발송일','시작일','종료일','반납요청일','반납완료일'] as const;
    const header = headerOrder.join(',');
    const body = modal.rows.map(r => {
      const cells = headerOrder.map(k => {
        const s = (r[k] ?? '').toString().replace(/"/g, '""');
        return /[",\n]/.test(s) ? `"${s}"` : s;
      }).join(',');
      return cells;
    }).join('\n');
    const csv = BOM + header + '\n' + body;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${title.replace(/\s+/g,'_')}.csv`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const colorForKey = (() => {
    const palette = ['#FFF7AE', '#E5E7EB', '#D1FAE5'];
    const map = new Map<string, string>();
    let i = 0;
    return (key: string) => {
      if (!map.has(key)) {
        map.set(key, palette[i % palette.length]);
        i++;
      }
      return map.get(key)!;
    };
  })();

  return (
    <div className="relative">
      <button
        className="px-2 py-1 text-xs border rounded bg-yellow-100 hover:bg-yellow-200"
        onClick={() => setOpen(v => !v)}
        title="중복/오류 검사"
      >
        중복/오류검사
      </button>

      {open && (
        <div className="absolute z-40 mt-2 w-[200px] bg-white border rounded shadow p-2 text-gray-900">
          <div className="text-[10px] text-gray-600 mb-1">검사 대상</div>
          <div className="flex gap-2">
            <button className="flex-1 px-2 py-1 text-[10px] border rounded hover:bg-gray-50 text-center" onClick={runDeviceCheck}>기기번호</button>
            <button className="flex-1 px-2 py-1 text-[10px] border rounded hover:bg-gray-50 text-center" onClick={runRecipientCheck}>수취인</button>
          </div>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-40 bg-black/30 flex items-center justify-center" onClick={()=>setModal(null)}>
          <div className="bg-white w-[1100px] max-w-[95vw] rounded shadow" onClick={(e)=>e.stopPropagation()}>
            <div className="px-4 py-3 border-b font-semibold text-gray-900 flex items-center justify-between">
              <span>{title}</span>
              <div className="flex gap-2">
                <button className="px-2 py-1 text-xs border rounded hover:bg-gray-50" onClick={downloadCSV}>CSV</button>
                <button className="px-2 py-1 text-xs border rounded hover:bg-gray-50" onClick={()=>setModal(null)}>닫기</button>
              </div>
            </div>

            <div className="p-3 max-h-[70vh] overflow-auto text-[0.74rem] text-gray-900">
              {modal.rows.length === 0 ? (
                <div className="text-center text-gray-500 py-8">문제 없음</div>
              ) : (
                <table className="w-full border-collapse">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="border px-2 py-1">거래처분류</th>
                      <th className="border px-2 py-1">상태</th>
                      <th className="border px-2 py-1">기기번호</th>
                      <th className="border px-2 py-1">제품</th>
                      <th className="border px-2 py-1">수취인명</th>
                      <th className="border px-2 py-1">연락처1</th>
                      <th className="border px-2 py-1">택배발송일</th>
                      <th className="border px-2 py-1">시작일</th>
                      <th className="border px-2 py-1">종료일</th>
                      <th className="border px-2 py-1">반납요청일</th>
                      <th className="border px-2 py-1">반납완료일</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modal.rows.map((r, i) => (
                      <tr key={i} style={{ background: colorForKey(r.key) }}>
                        <td className="border px-2 py-1">{r.거래처분류}</td>
                        <td className="border px-2 py-1">{r.상태}</td>
                        <td className="border px-2 py-1">{r.기기번호}</td>
                        <td className="border px-2 py-1">{r.제품}</td>
                        <td className="border px-2 py-1">{r.수취인명}</td>
                        <td className="border px-2 py-1">{r.연락처1}</td>
                        <td className="border px-2 py-1">{r.택배발송일}</td>
                        <td className="border px-2 py-1">{r.시작일}</td>
                        <td className="border px-2 py-1">{r.종료일}</td>
                        <td className="border px-2 py-1">{r.반납요청일}</td>
                        <td className="border px-2 py-1">{r.반납완료일}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

