'use client';
import { useState } from "react";

export default function UserAdd() {
  const [users, setUsers] = useState<{name:string;phone:string;id:string;pw:string}[]>([]);

  return (
    <div className="p-4 bg-white rounded shadow">
      <h2 className="font-bold mb-2">사용자 추가</h2>
      <button className="border px-2 py-1 mb-2">사용자 추가</button>
      <ul>
        {users.map((u,i)=>(
          <li key={i}>{u.name} ({u.id}) {u.phone}</li>
        ))}
      </ul>
    </div>
  );
}
