'use client';

import React, { useEffect, useState } from 'react';

const ADMIN_ID_FIXED = 'medela1280';

export default function AdminSetting() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  // ✅ 초기 로드: DB → 없으면 localStorage fallback
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/get');
        const data = await res.json();
        if (data.ok && data.row) {
          setName(data.row.name || '');
          setPhone(data.row.phone || '');
        } else {
          const savedName = localStorage.getItem('admin_name') || '';
          const savedPhone = localStorage.getItem('admin_phone') || '';
          setName(savedName);
          setPhone(savedPhone);
        }
      } catch (e) {
        console.error(e);
        const savedName = localStorage.getItem('admin_name') || '';
        const savedPhone = localStorage.getItem('admin_phone') || '';
        setName(savedName);
        setPhone(savedPhone);
      }
    })();
  }, []);

  // ✅ 저장 (DB + localStorage 모두 반영)
  const handleSave = async () => {
    setStatus(null);

    if (!name.trim()) { setStatus('이름을 입력하세요.'); return; }
    if (!phone.trim()) { setStatus('전화번호를 입력하세요.'); return; }
    if (pw && pw !== pw2) { setStatus('비밀번호가 서로 다릅니다.'); return; }

    try {
      // DB 저장 요청
      const saveRes = await fetch('/api/admin/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: ADMIN_ID_FIXED,
          name: name.trim(),
          phone: phone.trim(),
        }),
      });
      const saveData = await saveRes.json();
      if (!saveData.ok) {
        setStatus('서버 오류: 관리자 정보 저장 실패');
        return;
      }

      // localStorage에도 동일하게 반영 (백업용)
      localStorage.setItem('admin_name', name.trim());
      localStorage.setItem('admin_phone', phone.trim());
      localStorage.setItem('admin_id', ADMIN_ID_FIXED);

      // 비밀번호 변경 로직
      if (pw) {
        const pwRes = await fetch('/api/admin/set-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: ADMIN_ID_FIXED,
            password: pw,
          }),
        });
        const pwData = await pwRes.json();
        if (!pwData.ok) {
          setStatus('비밀번호 변경 실패');
          return;
        }

        setStatus('비밀번호가 변경되었습니다. 다시 로그인하세요.');
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = '/login';
        return;
      }

      setPw('');
      setPw2('');
      setStatus('저장되었습니다.');
    } catch (e) {
      console.error(e);
      setStatus('저장 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="min-h-[calc(100vh-80px)] flex items-start justify-center">
      <div className="mt-6 w-full max-w-lg bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-bold mb-4">관리자 설정</h2>

        <div className="space-y-3">
          <div>
            <label className="block text-sm text-gray-600 mb-1">관리자 ID (고정)</label>
            <input
              value={ADMIN_ID_FIXED}
              readOnly
              className="w-full border rounded px-3 py-2 bg-gray-100 text-gray-700"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">이름</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예) 홍길동"
              className="w-full border rounded px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">전화번호</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="예) 010-1234-5678"
              className="w-full border rounded px-3 py-2"
            />
          </div>

          <div className="pt-2">
            <label className="block text-sm text-gray-600 mb-1">
              비밀번호 (변경 시에만 입력)
            </label>
            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="새 비밀번호"
              className="w-full border rounded px-3 py-2"
            />
            <input
              type="password"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              placeholder="새 비밀번호 확인"
              className="w-full border rounded px-3 py-2 mt-2"
            />
            <p className="text-xs text-gray-500 mt-1">
              * 비밀번호를 비워두면 기존 비밀번호를 유지합니다.
            </p>
          </div>

          {status && (
            <div className={`text-sm mt-1 ${status.includes('저장') ? 'text-green-600' : 'text-red-600'}`}>
              {status}
            </div>
          )}

          <div className="pt-2">
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              저장
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


