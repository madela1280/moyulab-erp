'use client';
import { useEffect, useMemo, useState } from 'react';
import LockScreen from './LockScreen';

const ADMIN_ID_FIXED = 'medela1280';
type UserRow = { id: string; name: string; phone: string; username: string; pwHash: string; pwSalt: string; createdAt: number };

async function sha256(text: string) {
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}
function randomSalt(len=16) {
  const b = new Uint8Array(len); crypto.getRandomValues(b);
  return Array.from(b).map(x=>x.toString(16).padStart(2,'0')).join('');
}

export default function UserAdd() {
  // --- 권한 체크: 로그인 + 관리자 ID 여부
  const userIdFromSession = typeof window !== 'undefined' ? sessionStorage.getItem('erp_user') : null;
  const userIdFromLocal   = typeof window !== 'undefined' ? localStorage.getItem('erp_user') : null;
  const authed            = typeof window !== 'undefined' ? sessionStorage.getItem('erp_auth') === '1' : false;
  const currentId         = userIdFromSession || userIdFromLocal || '';
  const isAdmin           = authed && currentId === ADMIN_ID_FIXED;

  // 비관리자는 잠금화면
  if (!isAdmin) return <LockScreen />;

  // --- 상태
  const [rows, setRows] = useState<UserRow[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  // 초기 로드
  useEffect(() => {
    try {
      const raw = localStorage.getItem('erp_users');
      const data: UserRow[] = raw ? JSON.parse(raw) : [];
      setRows(data);
    } catch {}
  }, []);

  const resetForm = () => {
    setName(''); setPhone(''); setUsername(''); setPw(''); setPw2(''); setEditIdx(null);
  };

  const saveList = (list: UserRow[]) => {
    setRows(list);
    localStorage.setItem('erp_users', JSON.stringify(list));
  };

  const pickForEdit = (i: number) => {
    const u = rows[i];
    setEditIdx(i);
    setName(u.name);
    setPhone(u.phone);
    setUsername(u.username);
    setPw(''); setPw2('');
    setStatus(null);
  };

  const handleSave = async () => {
    setStatus(null);
    if (!name.trim()) { setStatus('이름을 입력하세요.'); return; }
    if (!phone.trim()) { setStatus('전화번호를 입력하세요.'); return; }
    if (!username.trim()) { setStatus('아이디를 입력하세요.'); return; }
    if (editIdx === null && !pw) { setStatus('비밀번호를 입력하세요.'); return; }
    if (pw && pw !== pw2) { setStatus('비밀번호가 서로 다릅니다.'); return; }

    // 아이디 중복 체크
    const dup = rows.some((r, i) => r.username === username && i !== editIdx);
    if (dup) { setStatus('이미 존재하는 아이디입니다.'); return; }

    const now = Date.now();
    if (editIdx === null) {
      const salt = randomSalt();
      const hash = await sha256(`${salt}|${pw}`);
      const newRow: UserRow = {
        id: crypto.randomUUID(),
        name: name.trim(),
        phone: phone.trim(),
        username: username.trim(),
        pwHash: hash,
        pwSalt: salt,
        createdAt: now,
      };
      saveList([newRow, ...rows]);
      resetForm();
      setStatus('사용자가 추가되었습니다.');
    } else {
      const next = rows.slice();
      const cur = { ...next[editIdx] };
      cur.name = name.trim();
      cur.phone = phone.trim();
      cur.username = username.trim();
      if (pw) {
        const salt = randomSalt();
        const hash = await sha256(`${salt}|${pw}`);
        cur.pwSalt = salt; cur.pwHash = hash;
      }
      next[editIdx] = cur;
      saveList(next);
      setStatus('사용자 정보가 수정되었습니다.');
    }
  };

  const handleDelete = () => {
    if (editIdx === null) { setStatus('삭제할 사용자를 먼저 선택하세요.'); return; }
    const u = rows[editIdx];
    if (!confirm(`정말 삭제하시겠습니까?\n사용자: ${u.name} (${u.username})`)) return;
    const next = rows.filter((_, i) => i !== editIdx);
    saveList(next);
    resetForm();
    setStatus('삭제되었습니다.');
  };

return (
  <div className="p-4">
    {/* 전체 폭 70%로 축소 + 가운데 정렬 */}
    <div className="mx-auto w-[70%]">
      <div className="grid gap-4 [grid-template-columns:0.35fr_0.65fr]">
        {/* 좌: 사용자 추가 폼 / 우: 사용자 목록 */}
        <h3 className="font-semibold mb-4">
          {editIdx === null ? '사용자 추가' : '사용자 수정'}
        </h3>

        <div className="space-y-3">
          <input
            className="w-full border rounded px-3 py-2"
            placeholder="이름"
            value={name}
            onChange={e => setName(e.target.value)}
          />
          <input
            className="w-full border rounded px-3 py-2"
            placeholder="전화번호"
            value={phone}
            onChange={e => setPhone(e.target.value)}
          />
          <input
            className="w-full border rounded px-3 py-2"
            placeholder="아이디"
            value={username}
            onChange={e => setUsername(e.target.value)}
          />
          <input
            type="password"
            className="w-full border rounded px-3 py-2"
            placeholder={editIdx === null ? "비밀번호" : "새 비밀번호(변경 시)"}
            value={pw}
            onChange={e => setPw(e.target.value)}
          />
          <input
            type="password"
            className="w-full border rounded px-3 py-2"
            placeholder={editIdx === null ? "비밀번호 확인" : "새 비밀번호 확인"}
            value={pw2}
            onChange={e => setPw2(e.target.value)}
          />
        </div>

        {status && (
          <div
            className={`text-sm mt-3 ${
              status.includes('삭제') || status.includes('다릅니다')
                ? 'text-red-600'
                : 'text-green-600'
            }`}
          >
            {status}
          </div>
        )}

        {/* 버튼 영역 30% 축소 */}
        <div className="mt-4">
          <div className="flex gap-2 scale-[0.7] origin-left">
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              {editIdx === null ? '추가' : '수정 저장'}
            </button>
            <button
              onClick={handleDelete}
              className="px-4 py-2 bg-gray-100 rounded border hover:bg-gray-50"
            >
              삭제
            </button>
            <button
              onClick={resetForm}
              className="px-4 py-2 bg-gray-100 rounded border hover:bg-gray-50"
            >
              새로 입력
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
);

      {/* 목록 */}
      <div className="bg-white rounded-lg shadow p-5">
        <h3 className="font-semibold mb-4">사용자 목록</h3>
        <div className="divide-y">
          {rows.length === 0 && <div className="text-sm text-gray-500">등록된 사용자가 없습니다.</div>}
          {rows.map((u, i) => (
            <button key={u.id} onClick={()=>pickForEdit(i)}
                    className={`w-full text-left py-2 px-2 hover:bg-gray-50 ${i===editIdx ? 'bg-blue-50' : ''}`}>
              <div className="font-medium">{u.name} <span className="text-gray-400 text-xs">({u.username})</span></div>
              <div className="text-xs text-gray-500">{u.phone}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
