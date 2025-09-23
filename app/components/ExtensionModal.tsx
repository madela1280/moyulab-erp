'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

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
  /** 선택 사항: 최초 위치 지정 */
  anchorPoint?: { x: number; y: number };
};

const LS_REASON_OPTIONS = 'extension_reason_options';
const DEFAULT_OPTIONS = ['스토어', '계좌', '서비스', '이벤트', '조리원'];

function loadReasonOptions(): string[] {
  try {
    const raw = localStorage.getItem(LS_REASON_OPTIONS);
    const arr = raw ? JSON.parse(raw) : null;
    if (Array.isArray(arr) && arr.length) return arr;
  } catch {}
  return DEFAULT_OPTIONS.slice();
}
function saveReasonOptions(list: string[]) {
  localStorage.setItem(LS_REASON_OPTIONS, JSON.stringify(list));
}

export default function ExtensionModal({
  open,
  onClose,
  onSave,
  initial,
  anchorPoint,
}: Props) {
  const [days, setDays] = useState<number>(initial?.days ?? 0);

  // 사유: 여러 개 입력/삭제
  const [reasons, setReasons] = useState<string[]>(
    initial?.reasons && initial.reasons.length ? initial.reasons : ['']
  );

  // 사유 선택지(드롭다운에 표시). "입력추가"로 확장 가능
  const [reasonOptions, setReasonOptions] = useState<string[]>([]);

  // 금액: 입력은 문자열(콤마 포함)로 받고, 저장 시 숫자 변환
  const [amountStr, setAmountStr] = useState<string>(() =>
    formatAmount(initial?.amount ?? 0)
  );

  // 만기일: YYYY-MM-DD
  const [dueY, setDueY] = useState<string>('');
  const [dueM, setDueM] = useState<string>('');
  const [dueD, setDueD] = useState<string>('');
  useEffect(() => {
    const d = (initial?.due ?? '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      setDueY(d.slice(0, 4));
      setDueM(d.slice(5, 7));
      setDueD(d.slice(8, 10));
    }
  }, [initial?.due]);

  // 옵션 로드
  useEffect(() => {
    if (open) setReasonOptions(loadReasonOptions());
  }, [open]);

  // 모달 드래그 이동(+ 30% 축소: w-[@360px])
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

  const addReasonField = () => setReasons((r) => [...r, '']);
  const removeReasonField = (idx: number) =>
    setReasons((r) => r.filter((_, i) => i !== idx));
  const updateReason = (idx: number, value: string) =>
    setReasons((r) => r.map((v, i) => (i === idx ? value : v)));

  // 드롭다운에서 "입력추가…" 선택 시 커스텀 추가
  const handleSelectReason = (idx: number, value: string) => {
    if (value === '__ADD__') {
      const label = prompt('새 사유를 입력하세요.');
      const v = (label ?? '').trim();
      if (!v) return;
      if (!reasonOptions.includes(v)) {
        const next = [...reasonOptions, v];
        setReasonOptions(next);
        saveReasonOptions(next);
      }
      updateReason(idx, v);
      return;
    }
    updateReason(idx, value);
  };

  const parsedAmount = parseAmount(amountStr);
  const due = makeDate(dueY, dueM, dueD);

  const disabled =
    !Number.isFinite(days) ||
    days <= 0 ||
    !due ||
    parsedAmount < 0 ||
    reasons.some((r) => !r.trim());

  return (
    <div className="fixed inset-0 z-[1000]">
      {/* dim */}
      <div
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
        aria-hidden
      />
      {/* box (draggable) */}
      <div
        ref={boxRef}
        className="absolute bg-white w-[360px] max-w-[92vw] rounded shadow border"
        style={{ top: pos.y, left: pos.x }}
      >
        {/* 헤더(드래그 핸들) */}
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

        {/* 바디 */}
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
              placeholder="예: 7"
            />
          </div>

          {/* 사유(여러 개) */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span>사유</span>
              <button
                onClick={addReasonField}
                className="px-2 py-1 text-[11px] border rounded hover:bg-gray-50"
              >
                + 사유 입력 추가
              </button>
            </div>
            <div className="space-y-2">
              {reasons.map((r, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <select
                    className="min-w-[120px] border rounded px-2 py-1"
                    value={reasonOptions.includes(r) ? r : ''}
                    onChange={(e) => handleSelectReason(idx, e.target.value)}
                  >
                    <option value="" disabled>
                      사유 선택
                    </option>
                    {reasonOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                    <option value="__ADD__">+ 입력추가…</option>
                  </select>
                  {/* 사용자가 직접 텍스트로 덮어쓸 수도 있게 입력칸 제공 */}
                  <input
                    className="flex-1 border rounded px-2 py-1"
                    value={r}
                    onChange={(e) => updateReason(idx, e.target.value)}
                    placeholder="사유 직접 입력 가능"
                  />
                  <button
                    onClick={() => removeReasonField(idx)}
                    className="px-2 py-1 text-xs border rounded hover:bg-red-50 text-red-600"
                  >
                    삭제
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* 금액(콤마 자동) */}
          <div>
            <div className="mb-1">금액</div>
            <input
              inputMode="numeric"
              value={amountStr}
              onChange={(e) => setAmountStr(formatAmount(parseAmount(e.target.value)))}
              className="w-full border rounded px-2 py-1"
              placeholder="예: 50,000"
            />
          </div>

          {/* 만기일 (년/월/일 개별) */}
          <div>
            <div className="mb-1">만기일 (년/월/일)</div>
            <div className="flex gap-2">
              <input
                className="w-[90px] border rounded px-2 py-1"
                placeholder="YYYY"
                value={dueY}
                onChange={(e) => setDueY(e.target.value.replace(/\D/g, '').slice(0, 4))}
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

        {/* 푸터 */}
        <div className="px-3 py-2 border-t flex justify-end gap-2">
          <button className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50" onClick={onClose}>
            취소
          </button>
          <button
            className={`px-3 py-1.5 text-sm rounded text-white ${
              disabled ? 'bg-gray-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
            }`}
            onClick={() => {
              if (disabled) return;
              const payload = {
                days: Math.max(0, Math.floor(days)),
                reasons: reasons.map((v) => v.trim()),
                amount: parsedAmount,
                due: due!,
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

/* ---------- 유틸 ---------- */
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


