'use client';

import React, { useMemo, useState } from 'react';

type Row = Record<string, string>;

/** 통합관리 로컬스토리지 키 (UnifiedGrid와 동일 literal) */
const LS_UNIFIED_ROWS = 'unified_rows';

/** 공통: 로컬에서 통합관리 전체 행 로드 */
function loadUnifiedRows(): Row[] {
  try {
    const raw = localStorage.getItem(LS_UNIFIED_ROWS);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/** 연락처1에서 가운데 번호(예: 010-1234-5678 -> "1234") 추출 */
function midBlock(phoneRaw: string): string {
  const d = (phoneRaw || '').replace(/\D+/g, ''); // 숫자만
  // 010-XXXX-YYYY 또는 01X-XXX-YYYY 등 다양한 길이 고려
  // 패턴 우선: 3-4-4 또는 3-3-4
  const m1 = d.match(/^(\d{3})(\d{4})(\d{4})$/);
  if (m1) return m1[2];
  const m2 = d.match(/^(\d{3})(\d{3})(\d{4})$/);
  if (m2) return m2[2];
  // fallback: 중앙부 3~4자리 추정
  if (d.length >= 8) {
    const start = Math.floor((d.length - 4) / 2);
    return d.slice(start, start + 4);
  }
  return '';
}

type ResultItem = {
  idx: number;            // 통합관리 원본 인덱스(참조용)
  기기번호?: string;
  수취인명?: string;
  연락처1?: string;
  시작일?: string;
  종료일?: string;
  반납완료일?: string;
  거래처분류?: string;
};

export default function ErrorCheckMenu() {
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState<null | { kind: 'device' | 'recipient'; rows: ResultItem[] }>(null);

  const runDeviceCheck = () => {
    const all = loadUnifiedRows();
    // 반납완료일이 비어있는 행만
    const active = all
      .map((r, i) => ({ ...r, __i: i }))
      .filter(r => (r['반납완료일'] ?? '') === '');

    // 기기번호 그룹핑
    const byDevice = new Map<string, ResultItem[]>();
    for (const r of active) {
      const key = (r['기기번호'] ?? '').toString().trim();
      if (!key) continue;
      const item: ResultItem = {
        idx: r.__i as number,
        기기번호: key,
        수취인명: r['수취인명'] ?? '',
        연락처1: r['연락처1'] ?? '',
        시작일: r['시작일'] ?? '',
        종료일: r['종료일'] ?? '',
        반납완료일: r['반납완료일'] ?? '',
        거래처분류: r['거래처분류'] ?? '',
      };
      if (!byDevice.has(key)) byDevice.set(key, []);
      byDevice.get(key)!.push(item);
    }

    // 동일 기기번호가 2건 이상 => "동시 대여 가능성" 오류로 표시
    const dupRows: ResultItem[] = [];
    byDevice.forEach(list => {
      if (list.length > 1) dupRows.push(...list);
    });

    setModal({ kind: 'device', rows: dupRows });
    setOpen(false);
  };

  const runRecipientCheck = () => {
    const all = loadUnifiedRows();
    const active = all
      .map((r, i) => ({ ...r, __i: i }))
      .filter(r => (r['반납완료일'] ?? '') === '');

    // (수취인명 + 연락처 가운데 번호)로 그룹핑
    const byPerson = new Map<string, ResultItem[]>();
    for (const r of active) {
      const name = (r['수취인명'] ?? '').toString().trim();
      const mid = midBlock((r['연락처1'] ?? '').toString());
      if (!name || !mid) continue;
      const key = `${name}|${mid}`;
      const item: ResultItem = {
        idx: r.__i as number,
        기기번호: r['기기번호'] ?? '',
        수취인명: name,
        연락처1: r['연락처1'] ?? '',
        시작일: r['시작일'] ?? '',
        종료일: r['종료일'] ?? '',
        반납완료일: r['반납완료일'] ?? '',
        거래처분류: r['거래처분류'] ?? '',
      };
      if (!byPerson.has(key)) byPerson.set(key, []);
      byPerson.get(key)!.push(item);
    }

    // 같은 (이름+가운데번호) 조합이 2건 이상이면 표시
    const dupRows: ResultItem[] = [];
    byPerson.forEach(list => {
      if (list.length > 1) dupRows.push(...list);
    });

    setModal({ kind: 'recipient', rows: dupRows });
    setOpen(false);
  };

  const title = useMemo(() => {
    if (!modal) return '';
    return modal.kind === 'device' ? '기기 중복/오류 결과' : '수취인 중복/오류 결과';
  }, [modal]);

  const downloadCSV = () => {
    if (!modal) return;
    const header = ['원본인덱스','거래처분류','수취인명','연락처1','기기번호','시작일','종료일','반납완료일'].join(',');
    const body = modal.rows.map(r => {
      const cells = [
        String(r.idx),
        r.거래처분류 ?? '',
        r.수취인명 ?? '',
        r.연락처1 ?? '',
        r.기기번호 ?? '',
        r.시작일 ?? '',
        r.종료일 ?? '',
        r.반납완료일 ?? '',
      ].map(v => {
        const s = (v ?? '').toString().replace(/"/g, '""');
        return /[",\n]/.test(s) ? `"${s}"` : s;
      }).join(',');
      return cells;
    }).join('\n');

    const csv = header + '\n' + body;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${title.replace(/\s+/g,'_')}.csv`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  return (
    <div className="relative">
      {/* 메인 버튼 (연한 노란색) */}
      <button
        className="px-2 py-1 text-xs border rounded bg-yellow-100 hover:bg-yellow-200"
        onClick={() => setOpen(v => !v)}
        title="중복/오류 검사"
      >
        중복/오류검사
      </button>

      {/* 서브 메뉴 */}
      {open && (
        <div className="absolute z-40 mt-2 w-[160px] bg-white border rounded shadow p-2 text-gray-900">
          <div className="text-xs text-gray-600 mb-1">검사 대상</div>
          <div className="flex flex-col gap-1">
            <button
              className="px-2 py-1 text-sm border rounded hover:bg-gray-50 text-left"
              onClick={runDeviceCheck}
            >
              기기 (동일 기기번호)
            </button>
            <button
              className="px-2 py-1 text-sm border rounded hover:bg-gray-50 text-left"
              onClick={runRecipientCheck}
            >
              수취인 (이름+가운데번호)
            </button>
          </div>
        </div>
      )}

      {/* 결과 모달 */}
      {modal && (
        <div className="fixed inset-0 z-40 bg-black/30 flex items-center justify-center" onClick={()=>setModal(null)}>
          <div className="bg-white w-[900px] max-w-[95vw] rounded shadow" onClick={(e)=>e.stopPropagation()}>
            <div className="px-4 py-3 border-b font-semibold text-gray-900 flex items-center justify-between">
              <span>{title}</span>
              <div className="flex gap-2">
                <button className="px-2 py-1 text-xs border rounded hover:bg-gray-50" onClick={downloadCSV}>CSV</button>
                <button className="px-2 py-1 text-xs border rounded hover:bg-gray-50" onClick={()=>setModal(null)}>닫기</button>
              </div>
            </div>

            <div className="p-3 max-h-[70vh] overflow-auto text-sm text-gray-900">
              {modal.rows.length === 0 ? (
                <div className="text-center text-gray-500 py-8">문제 없음</div>
              ) : (
                <table className="w-full border-collapse">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="border px-2 py-1">원본 idx</th>
                      <th className="border px-2 py-1">거래처분류</th>
                      <th className="border px-2 py-1">수취인명</th>
                      <th className="border px-2 py-1">연락처1</th>
                      <th className="border px-2 py-1">기기번호</th>
                      <th className="border px-2 py-1">시작일</th>
                      <th className="border px-2 py-1">종료일</th>
                      <th className="border px-2 py-1">반납완료일</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modal.rows.map((r, i) => (
                      <tr key={i}>
                        <td className="border px-2 py-1 text-right">{r.idx}</td>
                        <td className="border px-2 py-1">{r.거래처분류}</td>
                        <td className="border px-2 py-1">{r.수취인명}</td>
                        <td className="border px-2 py-1">{r.연락처1}</td>
                        <td className="border px-2 py-1">{r.기기번호}</td>
                        <td className="border px-2 py-1">{r.시작일}</td>
                        <td className="border px-2 py-1">{r.종료일}</td>
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
