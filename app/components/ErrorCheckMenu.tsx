'use client';

import React, { useMemo, useRef, useState } from 'react';

type Row = Record<string, string>;
const LS_UNIFIED_ROWS = 'unified_rows';

/** 통합관리 로우 로드 */
function loadUnifiedRows(): Row[] {
  try {
    const raw = localStorage.getItem(LS_UNIFIED_ROWS);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/** 연락처 가운데 4자리 추출 */
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

/** 완전 공백 행(모든 셀 빈 값) 제거용 */
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

  // 드래그 이동용 상태 (모달)
  const [dragXY, setDragXY] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);

  const onDragStart = (e: React.MouseEvent) => {
    dragRef.current = { sx: e.clientX, sy: e.clientY, ox: dragXY.x, oy: dragXY.y };
    window.addEventListener('mousemove', onDragging);
    window.addEventListener('mouseup', onDragEnd);
  };
  const onDragging = (e: MouseEvent) => {
    const st = dragRef.current;
    if (!st) return;
    setDragXY({ x: st.ox + (e.clientX - st.sx), y: st.oy + (e.clientY - st.sy) });
  };
  const onDragEnd = () => {
    window.removeEventListener('mousemove', onDragging);
    window.removeEventListener('mouseup', onDragEnd);
    dragRef.current = null;
  };

  /** 소스: props.rows 우선, 없으면 통합관리 */
  const sourceRows = useMemo<Row[]>(() => {
    const src = (rows && Array.isArray(rows) ? rows : loadUnifiedRows()) as Row[];
    // 완전 공백 행 제거 (패딩 행 제거)
    return src.filter(isMeaningfulRow);
  }, [rows]);

  /** 공통 변환 (표시/CSV에 쓰는 필드 고정 순서) */
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
    const active = sourceRows.filter((r) => (r['반납완료일'] ?? '').toString().trim() === '');
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
    setDragXY({ x: 0, y: 0 });
  };

  /** 2) 수취인 (이름 + 연락처 가운데 4자리 중복) — 거래처분류가 "조리원"으로 시작하는 것은 제외 */
  const runRecipientCheck = () => {
    const excludePrefix = '조리원';
    const active = sourceRows.filter(
      (r) =>
        !(r['거래처분류'] ?? '').toString().trim().startsWith(excludePrefix) &&
        (r['반납완료일'] ?? '').toString().trim() === ''
    );

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
    setDragXY({ x: 0, y: 0 });
  };

  /** 3) 미등록 기기
   *  - 통합관리에서 "기기번호는 있음" AND "기종, 제품이 모두 빈칸" 인 행만 추출
   */
  const runUnregisteredCheck = () => {
    const result = sourceRows
      .filter((r) => {
        const dev = (r['기기번호'] ?? '').toString().trim();
        const model = (r['기종'] ?? '').toString().trim();
        const product = (r['제품'] ?? '').toString().trim();
        return dev && !model && !product;
      })
      .map((r) => toItem(r, r['기기번호'] ?? ''));

    result.sort((a, b) => (a.기기번호 ?? '').localeCompare(b.기기번호 ?? ''));
    setModal({ kind: 'unregistered', rows: result, title: '미등록 기기 검사 결과' });
    setOpen(false);
    setDragXY({ x: 0, y: 0 });
  };

  /** 4) 기기번호 미기입 — 기기번호 칸이 빈칸이며, 행 전체가 공백이 아닌 것만 */
  const runEmptyDeviceCheck = () => {
    const result = sourceRows
      .filter((r) => ((r['기기번호'] ?? '').toString().trim() === '') && isMeaningfulRow(r))
      .map((r, i) => toItem(r, `empty-${i}`));

    // 완전 빈 행 제거가 이미 적용되었지만, 혹시 모르니 한 번 더 방지
    const cleaned = result.filter((r) =>
      Object.values(r).some((v) => (v ?? '').toString().trim() !== '')
    );

    setModal({ kind: 'emptyDevice', rows: cleaned, title: '기기번호 미기입 검사 결과' });
    setOpen(false);
    setDragXY({ x: 0, y: 0 });
  };

  /** CSV (4개 공통 헤더 순서) */
  const headerOrder = [
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

  const downloadCSV = () => {
    if (!modal) return;
    const BOM = '\uFEFF';
    const header = headerOrder.join(',');
    const body = modal.rows
      .map((r) =>
        headerOrder
          .map((k) => {
            const s = (r[k] ?? '').toString().replace(/"/g, '""');
            return /[",\n]/.test(s) ? `"${s}"` : s;
          })
          .join(',')
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

  /** 동일 key(그룹)별 배경색 */
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
      {/* 메인 버튼 */}
      <button
        className="px-2 py-1 text-xs border rounded bg-yellow-100 hover:bg-yellow-200"
        onClick={() => setOpen((v) => !v)}
        title="중복/오류 검사"
      >
        중복/오류검사
      </button>

      {/* 서브 메뉴 */}
      {open && (
        <div className="absolute z-40 mt-2 w-[200px] bg-white border rounded shadow p-2 text-gray-900">
          <div className="text-[10px] text-gray-600 mb-1">검사 대상</div>
          <div className="flex flex-col gap-2">
            <button
              className="w-full px-2 py-1 text-[10px] border rounded hover:bg-gray-50 text-left"
              onClick={runDeviceCheck}
            >
              기기번호 중복
            </button>
            <button
              className="w-full px-2 py-1 text-[10px] border rounded hover:bg-gray-50 text-left"
              onClick={runRecipientCheck}
            >
              수취인
            </button>
            <button
              className="w-full px-2 py-1 text-[10px] border rounded hover:bg-gray-50 text-left"
              onClick={runUnregisteredCheck}
            >
              미등록 기기
            </button>
            <button
              className="w-full px-2 py-1 text-[10px] border rounded hover:bg-gray-50 text-left"
              onClick={runEmptyDeviceCheck}
            >
              기기번호 미기입
            </button>
          </div>
        </div>
      )}

      {/* 결과 모달 (드래그 가능 + 스크롤) */}
      {modal && (
        <div
          className="fixed inset-0 z-40 bg-black/30"
          onClick={() => setModal(null)}
        >
          <div
            className="absolute bg-white w-[1100px] max-w-[95vw] rounded shadow"
            style={{
              top: `calc(50% + ${dragXY.y}px)`,
              left: `calc(50% + ${dragXY.x}px)`,
              transform: 'translate(-50%, -50%)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 드래그 핸들 */}
            <div
              className="px-4 py-3 border-b font-semibold text-gray-900 flex items-center justify-between cursor-move select-none"
              onMouseDown={onDragStart}
              title="드래그하여 창 이동"
            >
              <span>{modal.title}</span>
              <div className="flex gap-2">
                <button
                  className="px-2 py-1 text-xs border rounded hover:bg-gray-50 cursor-default"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={downloadCSV}
                >
                  CSV
                </button>
                <button
                  className="px-2 py-1 text-xs border rounded hover:bg-gray-50 cursor-default"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={() => setModal(null)}
                >
                  닫기
                </button>
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
                      <th className="border px-2 py-1">기종</th>
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
                        <td className="border px-2 py-1">{r.기종}</td>
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



