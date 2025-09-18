'use client';
import { useState } from "react";

export default function AdminSetting() {
  const [admins, setAdmins] = useState<{name:string;phone:string;id:string;pw:string}[]>([]);

  return (
    <div className="p-4 bg-white rounded shadow">
      <h2 className="font-bold mb-2">관리자 설정</h2>
      <button className="border px-2 py-1 mb-2">관리자 추가</button>
      <ul>
        {admins.map((a,i)=>(
          <li key={i}>{a.name} ({a.id}) {a.phone}</li>
        ))}
      </ul>
    </div>
  );
}
