'use client';

import React, { useEffect, useRef, useState } from 'react';

type Props = {
  open: boolean;
  onClose: () => void;
  onSave: (data: {
    days: number;
    reasons: string[];
    amount: number;
    due: string; // YYYY-MM-DD
  }) => void;
  initial?: {
    days?: number;
    reasons?: string[];
    amount?: number;
    due?: string; // YYYY-MM-DD
  };
  anchorPoint?: { x: number; y: number };
};

const LS_REASON_OPTIONS = 'extension_reason_options';
const DEFAULT_OPTIONS = ['스토어', '계좌', '서비스', '이벤트', '조리원'];

function loadReasonOptions(): string[] {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(LS_REASON_OPTIONS) : null;
    const arr = raw ? JSON.parse(raw) : null;
    if (Array.isArray(arr) && arr.length) return arr;
  } catch {}
  return DEFAULT_OPTIONS.slice();
}
function saveReasonOptions(list: string[]) {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(LS_REASON_OPTIONS, JSON.stringify(list));
    }
  } catch {}
}

/** 금액 유틸 */
function parseAmount(s: string): number {
  const n = Number((s || '').toString().replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}
function formatAmount(n: number): string {
  const v = Number.isFinite(n) ? n : 0;
  return v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
function pad2(s: string) {
  return s.length === 1 ? '0' + s : s;
}
function makeDate(y: string, m: string, d: string): string | null {
  if (y.length !== 4 || m.length === 0 || d.length === 0) return null;
  const yy = Number(y);
  const mm = Number(m);
  const dd = Number(d);
  if (!Number.isFinite(yy) || !Number.isFinite(mm) || !Number.isFinite(dd)) return null;
  if (mm < 1 || mm > 12) return null;
  if (dd < 1 || dd > 31) return null;
  return `${yy}-${pad2(String(mm))}-${pad2(String(dd))}`;
}

export default function ExtensionModal({
  open,
  onClose,
  onSave,
  initial,
  anchorPoint,
}: Props) {
  // 연장일수
  const [days, setDays] = useState<number>(initial?.days ?? 0);

  // 사유(단일 선택)
  const [reasons, setReasons] = useState<string[]>(
    initial?.reasons && initial.reasons.length ? [initial.reasons[0]] : ['']
  );
  const reason = reasons[0] ?? '';

  // 선택지
  const [reasonOptions, setReasonOptions] = useState<string[]>([]);
  useEffect(() => {
    if (open) setReasonOptions(loadReasonOptions());
  }, [open]);

  // 금액
  const [amountStr, setAmountStr] = useState<string>(() =>
    formatAmount(initial?.amount ?? 0)
  );

  // 만기일
  const [dueY, setDueY] = useState<string>('');
  const [dueM, setDueM] = useState<string>('');
  const [dueD, setDueD] = useState<string>('');
  useEffect(() => {
    const d = (initial?.due ?? '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      setDueY(d.slice(0, 4));
      setDueM(d.slice(5, 7));
      setDueD(d.slice(8, 10));
    } else {
      setDueY(''); setDueM(''); setDueD('');
    }
  }, [initial?.due]);

  // 드래그 이동
  const [pos, setPos] = useState<{ x: number; y: number }>(() => ({
    x: anchorPoint?.x ?? 80,
    y: anchorPoint?.y ?? 60,
  }));
  const [dragging, setDragging] = useState(false);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onMove = (e: MouseEvent) => {
      if (!dragging) return;
      setPos({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    };
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging, offset, open]);

  if (!open) return null;

  // 선택 처리
  const setReason = (v: string) => setReasons([v]);

  const handleSelectReason = (value: string) => {
    if (value === '__CUSTOM__') {
      const label = prompt('사유를 직접 입력하세요.');
      const v = (label ?? '').trim();
      if (!v) return;
      setReason(v);
      return;
    }
    if (value === '__ADD__') {
      const label = prompt('새 사유(선택지)를 추가하세요.');
      const v = (label ?? '').trim();
      if (!v) return;
      if (!reasonOptions.includes(v)) {
        const next = [...reasonOptions, v];
        setReasonOptions(next);
        saveReasonOptions(next);
      }
      setReason(v);
      return;
    }
    setReason(value);
  };

  // 삭제 모드
  const [deleteMode, setDeleteMode] = useState(false);
  const [deleteChecks, setDeleteChecks] = useState<string[]>([]);
  const toggleDeleteMode = () => {
    setDeleteMode((v) => !v);
    setDeleteChecks([]);
  };
  const handleDeleteApply = () => {
    if (!deleteChecks.length) {
      setDeleteMode(false);
      return;
    }
    const next = reasonOptions.filter((opt) => !deleteChecks.includes(opt));
    setReasonOptions(next);
    saveReasonOptions(next);
    setDeleteChecks([]);
    setDeleteMode(false);
    if (next.indexOf(reason) === -1 && reason !== '') setReason('');
  };

  const parsedAmount = parseAmount(amountStr);
  const due = makeDate(dueY, dueM, dueD);

  const disabled =
    !Number.isFinite(days) ||
    days <= 0 ||
    !due ||
    parsedAmount < 0 ||
    !reason.trim();

  return (
    <div className="fixed inset-0 z-[1000]">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div
        ref={boxRef}
        className="absolute bg-white w-[360px] max-w-[92vw] rounded shadow border"
        style={{ top: pos.y, left: pos.x }}
      >
        <div
          className="cursor-move px-3 py-2 border-b bg-gray-100 text-sm font-semibold flex items-center justify-between select-none"
          onMouseDown={(e) => {
            const rect = boxRef.current?.getBoundingClientRect();
            if (rect) {
              setDragging(true);
              setOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top });
            }
          }}
        >
          연장 입력
          <button
            onClick={onClose}
            className="text-xs px-2 py-1 border rounded hover:bg-gray-50"
          >
            닫기
          </button>
        </div>

        <div className="p-3 space-y-3 text-sm">
          {/* 연장일수 */}
          <div>
            <div className="mb-1">연장일수</div>
            <input
              type="number"
              min={0}
              step={1}
              value={Number.isFinite(days) ? String(days) : ''}
              onChange={(e) => setDays(Number(e.target.value || 0))}
              className="w-full border rounded px-2 py-1"
            />
          </div>

          {/* 사유 */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span>사유</span>
              <button
                onClick={toggleDeleteMode}
                className="px-2 py-1 text-[11px] border rounded hover:bg-gray-50 text-red-600"
              >
                {deleteMode ? '삭제 취소' : '삭제'}
              </button>
            </div>

            {deleteMode && (
              <div className="border p-2 mb-2 rounded">
                <div className="mb-1 text-xs text-gray-600">삭제할 사유 선택</div>
                {reasonOptions.map((opt) => (
                  <label key={opt} className="block text-sm">
                    <input
                      type="checkbox"
                      className="mr-2"
                      checked={deleteChecks.includes(opt)}
                      onChange={(e) => {
                        if (e.target.checked)
                          setDeleteChecks((prev) => [...prev, opt]);
                        else setDeleteChecks((prev) => prev.filter((x) => x !== opt));
                      }}
                    />
                    {opt}
                  </label>
                ))}
                <button
                  onClick={handleDeleteApply}
                  className="mt-2 px-2 py-1 text-xs border rounded bg-red-100 hover:bg-red-200 text-red-700"
                >
                  선택 삭제 적용
                </button>
              </div>
            )}

            <select
              className="w-full border rounded px-2 py-1"
              value={reasonOptions.includes(reason) || reason === '' ? reason : ''}
              onChange={(e) => handleSelectReason(e.target.value)}
            >
              <option value="" disabled>
                사유 선택
              </option>
              {reasonOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
              <option value="__CUSTOM__">직접입력…</option>
              <option value="__ADD__">입력추가…</option>
            </select>
          </div>

          {/* 금액 */}
          <div>
            <div className="mb-1">금액</div>
            <input
              inputMode="numeric"
              value={amountStr}
              onChange={(e) =>
                setAmountStr(formatAmount(parseAmount(e.target.value)))
              }
              className="w-full border rounded px-2 py-1"
              placeholder="예: 50,000"
            />
          </div>

          {/* 만기일 */}
          <div>
            <div className="mb-1">만기일 (년/월/일)</div>
            <div className="flex gap-2">
              <input
                className="w-[90px] border rounded px-2 py-1"
                placeholder="YYYY"
                value={dueY}
                onChange={(e) =>
                  setDueY(e.target.value.replace(/\D/g, '').slice(0, 4))
                }
              />
              <input
                className="w-[60px] border rounded px-2 py-1"
                placeholder="MM"
                value={dueM}
                onChange={(e) =>
                  setDueM(e.target.value.replace(/\D/g, '').slice(0, 2))
                }
              />
              <input
                className="w-[60px] border rounded px-2 py-1"
                placeholder="DD"
                value={dueD}
                onChange={(e) =>
                  setDueD(e.target.value.replace(/\D/g, '').slice(0, 2))
                }
              />
            </div>
          </div>
        </div>

        <div className="px-3 py-2 border-t flex justify-end gap-2">
          <button
            className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50"
            onClick={onClose}
          >
            취소
          </button>
          <button
            className={`px-3 py-1.5 text-sm rounded text-white ${
              disabled
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
            onClick={() => {
              if (disabled) return;
              const payload = {
                days: Math.max(0, Math.floor(days)),
                reasons: [reason.trim()],
                amount: parsedAmount,
                due: due ?? '',
              };
              onSave(payload);
              onClose();
            }}
            disabled={disabled}
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}






