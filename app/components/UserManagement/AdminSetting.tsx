'use client';

import React, { useEffect, useState } from 'react';

/**
 * 관리자 단 한 명. ID는 고정(medela1280), 비밀번호는 변경 가능.
 * 로컬 저장 키
 *  - admin_name, admin_phone
 *  - admin_id         : 항상 'medela1280'
 *  - admin_pw_hash    : SHA-256 해시(텍스트 저장 방지)
 *  - admin_pw_salt    : 해시용 salt
 *  - admin_pw_set     : '1' 이면 비번 설정 완료(초기설정 페이지 재등장 방지용)
 */
const ADMIN_ID_FIXED = 'medela1280';

async function sha256(text: string) {
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function randomSalt(len = 16) {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export default function AdminSetting() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  // 초기 로드: 기존값 불러오기
  useEffect(() => {
    try {
      const savedName = localStorage.getItem('admin_name') || '';
      const savedPhone = localStorage.getItem('admin_phone') || '';
      setName(savedName);
      setPhone(savedPhone);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const handleSave = async () => {
  setStatus(null);

  if (!name.trim()) { setStatus('이름을 입력하세요.'); return; }
  if (!phone.trim()) { setStatus('전화번호를 입력하세요.'); return; }
  if (pw && pw !== pw2) { setStatus('비밀번호가 서로 다릅니다.'); return; }

  try {
    localStorage.setItem('admin_name', name.trim());
    localStorage.setItem('admin_phone', phone.trim());
    localStorage.setItem('admin_id', ADMIN_ID_FIXED);

    if (pw) {
      const res = await fetch('/api/admin/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: ADMIN_ID_FIXED,
          password: pw,
        }),
      });

      const data = await res.json();
      if (!data.ok) {
        setStatus('서버 오류: 비밀번호 변경 실패');
        return;
      }

      setStatus('비밀번호가 변경되었습니다. 다시 로그인하세요.');

      // 로그인 세션 제거 후 로그인 페이지로 이동
      localStorage.removeItem('erp_auth');
      localStorage.removeItem('erp_auth_exp');
      sessionStorage.removeItem('erp_auth');
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

