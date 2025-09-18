'use client';
import { useState } from "react";

const CATEGORIES = ["통합관리","기기관리","데이터 업로드","대여관리","유축기현황","문자","합포장","집계"];

export default function Permission() {
  const [checked, setChecked] = useState<Record<string,boolean>>({});

  return (
    <div className="p-4 bg-white rounded shadow">
      <h2 className="font-bold mb-2">권한 설정</h2>
      {CATEGORIES.map(c=>(
        <label key={c} className="block">
          <input type="checkbox"
            checked={!!checked[c]}
            onChange={e=>setChecked({...checked,[c]:e.target.checked})}/>
          {c}
        </label>
      ))}
      <button className="border px-2 py-1 mt-2">저장</button>
    </div>
  );
}
