'use client';

import React, { useState } from 'react';

type ExtensionData = {
  days: string;    // 연장일수
  reason: string;  // 사유
  amount: string;  // 금액 (콤마 표시)
  endDate: string; // 만기일 YYYY-MM-DD
};

type Props = {
  open: boolean;
  initial?: ExtensionData;
  reasons: string[];
  onAddReason: (r: string) => void;
  onSave: (data: ExtensionData) => void;
  onClose: () => void;
};

export default function ExtensionModal({
  open, initial, reasons, onAddReason, onSave, onClose
}: Props) {
  const [days, setDays] = useState(initial?.days ?? '');
  const [reason, setReason] = useState(initial?.reason ?? '');
  const [amount, setAmount] = useState(initial?.amount ?? '');
  const [endDate, setEndDate] = useState(initial?.endDate ?? '');

  if (!open) return null;

  const handleAmountChange = (v: string) => {
    const num = v.replace(/[^0-9]/g, '');
    if (!num) { setAmount(''); return; }
    setAmount(Number(num).toLocaleString());
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
      <div className="bg-white rounded shadow w-[420px] max-w-[95vw]">
        <div className="px-4 py-3 border-b font-semibold">연장 입력</div>
        <div className="p-4 space-y-3 text-sm">
          <div>
            <div className="mb-1">연장일수</div>
            <input
              className="w-full border rounded px-2 py-1"
              value={days}
              onChange={(e)=>setDays(e.target.value)}
              placeholder="예: 30"
            />
          </div>

          <div>
            <div className="mb-1">사유</div>
            <select
              className="w-full border rounded px-2 py-1 mb-2"
              value={reason}
              onChange={(e)=>setReason(e.target.value)}
            >
              <option value="">선택하세요</option>
              {reasons.map(r=><option key={r} value={r}>{r}</option>)}
            </select>
            <div className="flex gap-2">
              <input
                className="flex-1 border rounded px-2 py-1"
                placeholder="새 사유 입력 후 Enter"
                onKeyDown={(e)=>{
                  if (e.key==='Enter') {
                    e.preventDefault();
                    const val = (e.target as HTMLInputElement).value.trim();
                    if (val) {
                      onAddReason(val);
                      setReason(val);
                      (e.target as HTMLInputElement).value='';
                    }
                  }
                }}
              />
              <button
                className="px-2 py-1 border rounded hover:bg-gray-50"
                onClick={()=>{
                  const input = prompt('추가할 사유를 입력하세요');
                  const val = (input||'').trim();
                  if (val) { onAddReason(val); setReason(val); }
                }}
              >입력추가</button>
            </div>
          </div>

          <div>
            <div className="mb-1">금액</div>
            <input
              className="w-full border rounded px-2 py-1"
              value={amount}
              onChange={(e)=>handleAmountChange(e.target.value)}
              placeholder="예: 10,000"
            />
          </div>

          <div>
            <div className="mb-1">만기일</div>
            <input
              type="date"
              className="w-full border rounded px-2 py-1"
              value={endDate}
              onChange={(e)=>setEndDate(e.target.value)}
            />
            <div className="text-[11px] text-gray-500 mt-1">
              * 저장 시 해당 만기일은 “종료일” 칸에도 자동 반영됩니다.
            </div>
          </div>
        </div>

        <div className="px-4 py-3 border-t flex justify-end gap-2">
          <button className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50" onClick={onClose}>취소</button>
          <button
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
            onClick={()=>onSave({days, reason, amount, endDate})}
          >저장</button>
        </div>
      </div>
    </div>
  );
}

