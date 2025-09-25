'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

type Row = Record<string, string>;
const LS_UNIFIED_ROWS = 'unified_rows';

/** 통합관리(로컬스토리지) 로우 로드 */
function loadUnifiedRows(): Row[] {
  try {
    const raw = localStorage.getItem(LS_UNIFIED_ROWS);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/** 완전 공백 행(모든 셀 빈 값) 제거용 */
function isMeaningfulRow(r: Row): boolean {
  for (const v of Object.values(r ?? {})) {
    if ((v ?? '').toString().trim() !== '') return true;
  }
  return false;
}

/** 연락처 가운데 번호(4자리 우선) */
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

/** 결과표의 공통 컬럼 순서(요청한 순서) */
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

type ResultItem = {
  key: string; // 그룹핑/색상 구분 키
} & { [K in (typeof HEADER_ORDER)[number]]?: string };

type ModalKind = 'device' | 'recipient' | 'unregistered' | 'emptyDevice';

export default function ErrorCheckMenu({ rows }: { rows?: Row[] }) {
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState<null | { kind: ModalKind; rows: ResultItem[] }>(null);

  /** 결과 모달 드래그 이동용 상태 */
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ dragging: boolean; dx: number; dy: number }>({ dragging: false, dx: 0, dy: 0 });

  /** 소스 데이터(완전 빈 행 제거) */
  const sourceRows = useMemo<Row[]>(() => {
    const base = (rows && Array.isArray(rows) ? rows : loadUnifiedRows()) as Row[];
    return base.filter(isMeaningfulRow);
  }, [rows]);

  /** 공통: Row → ResultItem */
  const toItem = (r: Row, key: string): ResultItem => ({
    key,
    거래처분류: (r['거래처분류'] ?? '').toString(),
    상태: (r['상태'] ?? '').toString(),
    기기번호: (r['기기번호'] ?? '').toString(),
    기종: (r['기종'] ?? '').toString(),
    제품: (r['제품'] ?? '').toString(),
    수취인명: (r['수취인명'] ?? '').toString(),
    연락처1: (r['연락처1'] ?? '').toString(),
    택배발송일: (r['택배발송일'] ?? '').toString(),
    시작일: (r['시작일'] ?? '').toString(),
    종료일: (r['종료일'] ?? '').toString(),
    반납요청일: (r['반납요청일'] ?? '').toString(),
    반납완료일: (r['반납완료일'] ?? '').toString(),
  });

  /** 1) 기기번호 중복(반납완료일 비어있는 행 대상) */
  const runDeviceCheck = () => {
    const active = sourceRows.filter(r => (r['반납완료일'] ?? '').toString().trim() === '');
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
    centerModal();
  };

  /** 2) 수취인(이름+가운데번호), '조리원'으로 시작하는 거래처분류는 제외, 반납완료일 빈 것만 */
  const runRecipientCheck = () => {
    const active = sourceRows.filter(r => {
      const vendor = (r['거래처분류'] ?? '').toString().trim();
      const excludeJoriwon = vendor.startsWith('조리원');
      return !excludeJoriwon && (r['반납완료일'] ?? '').toString().trim() === '';
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
    byPerson.forEach(list => { if (list.length > 1) dupRows.push(...list); });
    dupRows.sort((a, b) => (a.key ?? '').localeCompare(b.key ?? ''));
    setModal({ kind: 'recipient', rows: dupRows });
    setOpen(false);
    centerModal();
  };

  /** 3) 미등록 기기: 통합관리에서 '기기번호는 있음' && '기종/제품이 모두 빈칸' */
  const runUnregisteredCheck = () => {
    const result = sourceRows
      .filter(r => {
        const dev = (r['기기번호'] ?? '').toString().trim();
        const model = (r['기종'] ?? '').toString().trim();
        const prod = (r['제품'] ?? '').toString().trim();
        return !!dev && model === '' && prod === '';
      })
      .map(r => toItem(r, (r['기기번호'] ?? '').toString().trim()));

    result.sort((a, b) => (a.기기번호 ?? '').localeCompare(b.기기번호 ?? ''));
    setModal({ kind: 'unregistered', rows: result });
    setOpen(false);
    centerModal();
  };

  /** 4) 기기번호 미기입: 의미 있는 행 중 기기번호가 빈칸 */
  const runEmptyDeviceNoCheck = () => {
    const result = sourceRows
      .filter(r => (r['기기번호'] ?? '').toString().trim() === '')
      .map((r, idx) => toItem(r, `(empty)#${idx}`)); // 키는 구분용

    // 완전 빈 행 이미 제거했으므로 빈 줄이 대량으로 보일 일이 없음
    setModal({ kind: 'emptyDevice', rows: result });
    setOpen(false);
    centerModal();
  };

  /** 모달 타이틀 */
  const title = useMemo(() => {
    if (!modal) return '';
    switch (modal.kind) {
      case 'device': return '기기번호 중복 검사 결과';
      case 'recipient': return '수취인(이름+가운데번호) 중복 검사 결과';
      case 'unregistered': return '미등록 기기 검사 결과 (기종/제품 모두 빈칸)';
      case 'emptyDevice': return '기기번호 미기입 검사 결과';
    }
  }, [modal]);

  /** CSV 다운로드 (4종 공통 순서로 출력) */
  const downloadCSV = () => {
    if (!modal) return;
    const BOM = '\uFEFF';
    const header = HEADER_ORDER.join(',');
    const body = modal.rows.map(r => {
      const cells = HEADER_ORDER.map(k => {
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

  /** 같은 그룹(같은 key) 배경색 고정 팔레트 */
  const colorForKey = (() => {
    const palette = ['#FFF7AE', '#E5E7EB', '#D1FAE5']; // 노랑/그레이/연초록 반복
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

  /** 모달 중앙 정렬 기본값 */
  function centerModal() {
    const w = 1100; // 모달 폭
    const x = Math.max(8, Math.round((window.innerWidth - w) / 2));
    const y = 60;
    setPos({ x, y });
  }

  /** 드래그 핸들러 */
  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!dragRef.current.dragging) return;
      setPos(p => {
        if (!p) return p;
        const nx = e.clientX - dragRef.current.dx;
        const ny = e.clientY - dragRef.current.dy;
        // 화면 밖으로 못 나가게 약간의 여백
        const maxX = window.innerWidth - 24;
        const maxY = window.innerHeight - 24;
        return {
          x: Math.min(Math.max(nx, 8), maxX),
          y: Math.min(Math.max(ny, 8), maxY),
        };
      });
    }
    function onUp() { dragRef.current.dragging = false; }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

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
        <div className="absolute z-40 mt-2 w-[220px] bg-white border rounded shadow p-2 text-gray-900">
          <div className="text-[10px] text-gray-600 mb-1">검사 대상</div>
          <div className="flex flex-col gap-2">
            <button className="px-2 py-1 text-[10px] border rounded hover:bg-gray-50 text-left" onClick={runDeviceCheck}>
              기기번호 중복
            </button>
            <button className="px-2 py-1 text-[10px] border rounded hover:bg-gray-50 text-left" onClick={runRecipientCheck}>
              수취인
            </button>
            <button className="px-2 py-1 text-[10px] border rounded hover:bg-gray-50 text-left" onClick={runUnregisteredCheck}>
              미등록 기기
            </button>
            <button className="px-2 py-1 text-[10px] border rounded hover:bg-gray-50 text-left" onClick={runEmptyDeviceNoCheck}>
              기기번호 미기입
            </button>
          </div>
        </div>
      )}

      {modal && pos && (
        <div
          className="fixed inset-0 z-40 bg-black/30"
          onClick={() => setModal(null)}
        >
          <div
            className="bg-white w-[1100px] max-w-[95vw] rounded shadow select-none"
            style={{ position: 'fixed', left: pos.x, top: pos.y }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 드래그 가능한 헤더 */}
            <div
              className="px-4 py-3 border-b font-semibold text-gray-900 flex items-center justify-between cursor-move"
              onMouseDown={(e) => {
                dragRef.current.dragging = true;
                const rect = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
                dragRef.current.dx = e.clientX - rect.left;
                dragRef.current.dy = e.clientY - rect.top;
              }}
            >
              <span>{title}</span>
              <div className="flex gap-2 cursor-default">
                <button className="px-2 py-1 text-xs border rounded hover:bg-gray-50" onClick={downloadCSV}>
                  CSV
                </button>
                <button className="px-2 py-1 text-xs border rounded hover:bg-gray-50" onClick={() => setModal(null)}>
                  닫기
                </button>
              </div>
            </div>

            {/* 결과 표 */}
            <div className="p-3 max-h-[70vh] overflow-auto text-[0.74rem] text-gray-900">
              {modal.rows.length === 0 ? (
                <div className="text-center text-gray-500 py-8">문제 없음</div>
              ) : (
                <table className="w-full border-collapse">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      {HEADER_ORDER.map(h => (
                        <th key={h} className="border px-2 py-1">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {modal.rows.map((r, i) => (
                      <tr key={i} style={{ background: colorForKey(r.key) }}>
                        {HEADER_ORDER.map(h => (
                          <td key={h} className="border px-2 py-1">
                            {(r[h] ?? '')}
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



