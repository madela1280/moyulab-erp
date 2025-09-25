'use client';

import React, { useMemo, useRef, useState, useEffect } from 'react';

type Row = Record<string, string>;
const LS_UNIFIED_ROWS = 'unified_rows';

/** 통합관리 rows 로드 */
function loadUnifiedRows(): Row[] {
  try {
    const raw = localStorage.getItem(LS_UNIFIED_ROWS);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/** 전화번호 가운데 4자리 */
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

/** 완전 공란 행(모든 셀 공백) 제거용 */
function isMeaningfulRow(r: Row): boolean {
  for (const v of Object.values(r ?? {})) {
    if ((v ?? '').toString().trim() !== '') return true;
  }
  return false;
}

type ResultItem = {
  key: string;
  거래처분류?: string;
  상태?: string;
  기기번호?: string;
  기종?: string;
  제품?: string;
  수취인명?: string;
  연락처1?: string;
  택배발송일?: string;
  시작일?: string;
  종료일?: string;
  반납요청일?: string;
  반납완료일?: string;
};

const HEADER_ORDER = [
  '거래처분류',
  '상태',
  '기기번호',
  '기종',
  '제품',
  '수취인명',
  '연락처1',
  '택배발송일',
  '시작일',
  '종료일',
  '반납요청일',
  '반납완료일',
] as const;

export default function ErrorCheckMenu({ rows }: { rows?: Row[] }) {
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState<
    | null
    | {
        kind: 'device' | 'recipient' | 'unregistered' | 'emptyDevice';
        rows: ResultItem[];
        title: string;
      }
  >(null);

  /** 결과 모달 드래그 위치 */
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const dragOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      setPos({ x: e.clientX - dragOffset.current.x, y: e.clientY - dragOffset.current.y });
    };
    const onUp = () => (dragging.current = false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const startDrag = (e: React.MouseEvent) => {
    if (!dragRef.current) return;
    dragging.current = true;
    const rect = dragRef.current.getBoundingClientRect();
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const sourceRows = useMemo<Row[]>(() => {
    return (rows && Array.isArray(rows) ? rows : loadUnifiedRows()) as Row[];
  }, [rows]);

  const toItem = (r: Row, key: string): ResultItem => ({
    key,
    거래처분류: r['거래처분류'] ?? '',
    상태: r['상태'] ?? '',
    기기번호: r['기기번호'] ?? '',
    기종: r['기종'] ?? '',
    제품: r['제품'] ?? '',
    수취인명: r['수취인명'] ?? '',
    연락처1: r['연락처1'] ?? '',
    택배발송일: r['택배발송일'] ?? '',
    시작일: r['시작일'] ?? '',
    종료일: r['종료일'] ?? '',
    반납요청일: r['반납요청일'] ?? '',
    반납완료일: r['반납완료일'] ?? '',
  });

  /** 1) 기기번호 중복 (반납완료일 비어있는 것만) */
  const runDeviceCheck = () => {
    const active = sourceRows.filter(
      (r) => (r['반납완료일'] ?? '') === '' && isMeaningfulRow(r)
    );
    const byDevice = new Map<string, ResultItem[]>();
    for (const r of active) {
      const key = (r['기기번호'] ?? '').toString().trim();
      if (!key) continue;
      const item = toItem(r, key);
      if (!byDevice.has(key)) byDevice.set(key, []);
      byDevice.get(key)!.push(item);
    }
    const dupRows: ResultItem[] = [];
    byDevice.forEach((list) => {
      if (list.length > 1) dupRows.push(...list);
    });
    dupRows.sort((a, b) => (a.기기번호 ?? '').localeCompare(b.기기번호 ?? ''));
    setModal({ kind: 'device', rows: dupRows, title: '기기번호 중복 검사 결과' });
    setOpen(false);
  };

  /** 2) 수취인 중복 (이름+가운데번호), 거래처분류가 '조리원'으로 시작하는 행은 제외, 반납완료일 비어있는 것만 */
  const runRecipientCheck = () => {
    const active = sourceRows.filter((r) => {
      const vendor = (r['거래처분류'] ?? '').toString().trim();
      const isJoriwon = vendor.startsWith('조리원');
      return (r['반납완료일'] ?? '') === '' && !isJoriwon && isMeaningfulRow(r);
    });

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
    byPerson.forEach((list) => {
      if (list.length > 1) dupRows.push(...list);
    });
    dupRows.sort((a, b) => (a.key ?? '').localeCompare(b.key ?? ''));
    setModal({ kind: 'recipient', rows: dupRows, title: '수취인 중복 검사 결과' });
    setOpen(false);
  };

  /**
   * 3) 미등록 기기
   *  - 통합관리에서 기기번호는 있고
   *  - 기종, 제품이 모두 빈 칸이며
   *  - 반납완료일이 비어있는 행
   */
  const runUnregisteredCheck = () => {
    const active = sourceRows.filter(
      (r) => (r['반납완료일'] ?? '') === '' && isMeaningfulRow(r)
    );
    const result = active
      .filter((r) => {
        const dev = (r['기기번호'] ?? '').toString().trim();
        const model = (r['기종'] ?? '').toString().trim();
        const prod = (r['제품'] ?? '').toString().trim();
        return dev && !model && !prod;
      })
      .map((r) => toItem(r, r['기기번호'] ?? ''));

    result.sort((a, b) => (a.기기번호 ?? '').localeCompare(b.기기번호 ?? ''));
    setModal({ kind: 'unregistered', rows: result, title: '미등록 기기 검사 결과' });
    setOpen(false);
  };

  /** 4) 기기번호 미기입 (기기번호가 빈 칸), 반납완료일 비어있는 것만, 공란행 제외 */
  const runEmptyDeviceCheck = () => {
    const active = sourceRows.filter(
      (r) => (r['반납완료일'] ?? '') === '' && isMeaningfulRow(r)
    );
    const result = active
      .filter((r) => (r['기기번호'] ?? '').toString().trim() === '')
      .map((r, idx) => toItem(r, `EMPTY_DEVICE_${idx}`));

    setModal({ kind: 'emptyDevice', rows: result, title: '기기번호 미기입 검사 결과' });
    setOpen(false);
  };

  /** CSV 다운로드 (BOM 포함, 열 순서 통일) */
  const downloadCSV = () => {
    if (!modal) return;
    const BOM = '\uFEFF';
    const header = HEADER_ORDER.join(',');
    const body = modal.rows
      .map((r) =>
        HEADER_ORDER.map((k) => {
          const s = (r[k] ?? '').toString().replace(/"/g, '""');
          return /[",\n]/.test(s) ? `"${s}"` : s;
        }).join(',')
      )
      .join('\n');
    const csv = BOM + header + '\n' + body;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${modal.title.replace(/\s+/g, '_')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  /** 같은 key끼리 행 배경색 반복(3색) */
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
        onClick={() => setOpen((v) => !v)}
        title="중복/오류 검사"
      >
        중복/오류검사
      </button>

      {open && (
        <div className="absolute z-40 mt-2 w-[220px] bg-white border rounded shadow p-2 text-gray-900">
          <div className="text-[10px] text-gray-600 mb-1">검사 대상</div>
          <div className="flex flex-col gap-1">
            <button
              className="px-2 py-1 text-[10px] border rounded hover:bg-gray-50 text-left"
              onClick={runDeviceCheck}
            >
              기기번호 중복
            </button>
            <button
              className="px-2 py-1 text-[10px] border rounded hover:bg-gray-50 text-left"
              onClick={runRecipientCheck}
            >
              수취인 (이름+가운데번호, 조리원* 제외)
            </button>
            <button
              className="px-2 py-1 text-[10px] border rounded hover:bg-gray-50 text-left"
              onClick={runUnregisteredCheck}
            >
              미등록 기기 (기종/제품 공란)
            </button>
            <button
              className="px-2 py-1 text-[10px] border rounded hover:bg-gray-50 text-left"
              onClick={runEmptyDeviceCheck}
            >
              기기번호 미기입
            </button>
          </div>
        </div>
      )}

      {modal && (
        <div
          className="fixed inset-0 z-40 bg-black/30"
          onClick={() => setModal(null)}
        >
          {/* 드래그 가능한 카드 */}
          <div
            ref={dragRef}
            onClick={(e) => e.stopPropagation()}
            className="absolute bg-white w-[1100px] max-w-[95vw] rounded shadow border"
            style={{ left: pos.x, top: pos.y }}
          >
            {/* 헤더 (드래그 핸들) */}
            <div
              className="px-4 py-3 border-b font-semibold text-gray-900 flex items-center justify-between cursor-move select-none"
              onMouseDown={startDrag}
            >
              <span>{modal.title}</span>
              <div className="flex gap-2">
                <button
                  className="px-2 py-1 text-xs border rounded hover:bg-gray-50"
                  onClick={downloadCSV}
                >
                  CSV
                </button>
                <button
                  className="px-2 py-1 text-xs border rounded hover:bg-gray-50"
                  onClick={() => setModal(null)}
                >
                  닫기
                </button>
              </div>
            </div>

            {/* 내용: 스크롤 가능 */}
            <div className="p-3 max-h-[70vh] overflow-auto text-[0.74rem] text-gray-900">
              {modal.rows.length === 0 ? (
                <div className="text-center text-gray-500 py-8">문제 없음</div>
              ) : (
                <table className="w-full border-collapse">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      {HEADER_ORDER.map((h) => (
                        <th key={h} className="border px-2 py-1">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {modal.rows.map((r, i) => (
                      <tr key={i} style={{ background: colorForKey(r.key) }}>
                        {HEADER_ORDER.map((k) => (
                          <td key={k} className="border px-2 py-1">
                            {(r[k] ?? '') as string}
                          </td>
                        ))}
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




