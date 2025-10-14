'use client';

import React, { useState } from 'react';

export default function LoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();

      if (data.ok) {
        // 로그인 성공 처리
        localStorage.setItem('loggedInUser', JSON.stringify(data));
        window.location.href = '/'; // 메인으로 이동
      } else {
        setError('로그인 실패: 아이디나 비밀번호를 확인하세요.');
      }
    } catch (err) {
      console.error(err);
      setError('서버 오류가 발생했습니다.');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <form
        onSubmit={handleLogin}
        className="flex flex-col gap-4 bg-white p-8 rounded-lg shadow-md w-80"
      >
        <h2 className="text-2xl font-bold text-center">로그인</h2>
        <input
          type="text"
          placeholder="아이디"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="border p-2 rounded"
        />
        <input
          type="password"
          placeholder="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border p-2 rounded"
        />
        {error && <p className="text-red-500 text-sm text-center">{error}</p>}
        <button
          type="submit"
          className="bg-blue-500 text-white p-2 rounded hover:bg-blue-600"
        >
          로그인
        </button>
      </form>
    </div>
  );
}
