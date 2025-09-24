'use client';

import { useEffect, useState } from "react";

export default function LoginPage() {
  const [username, setU] = useState("");
  const [password, setP] = useState("");
  const [remember, setR] = useState(false);
  const [msg, setMsg] = useState("");

  // 저장값 불러오기
  useEffect(() => {
    const r = localStorage.getItem("erp_remember") === "1";
    setR(r);
    if (r) {
      setU(localStorage.getItem("erp_saved_id") || "");
      setP(localStorage.getItem("erp_saved_pw") || "");
    }
  }, []);

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");

    try {
      const r = await fetch("/api/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
        headers: { "Content-Type": "application/json" },
      });

      if (r.ok) {
        if (remember) {
          localStorage.setItem("erp_remember", "1");
          localStorage.setItem("erp_saved_id", username);
          localStorage.setItem("erp_saved_pw", password);
        } else {
          localStorage.removeItem("erp_remember");
          localStorage.removeItem("erp_saved_id");
          localStorage.removeItem("erp_saved_pw");
        }

        // ✅ 쿠키 저장이 반영된 후 홈으로 이동
        window.location.href = "/";
      } else {
        setMsg("아이디 또는 비밀번호가 올바르지 않습니다.");
      }
    } catch (err) {
      setMsg("로그인 처리 중 오류가 발생했습니다.");
    }
  }

  return (
    <div className="min-h-screen grid place-items-center p-8 bg-gray-50">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow p-6">
        <h1 className="text-xl font-bold mb-4 text-center">ERP 로그인</h1>

        <form onSubmit={onLogin} className="space-y-3">
          <input
            className="w-full border rounded p-2"
            placeholder="아이디"
            value={username}
            onChange={(e) => setU(e.target.value)}
          />
          <input
            className="w-full border rounded p-2"
            placeholder="비밀번호"
            type="password"
            value={password}
            onChange={(e) => setP(e.target.value)}
          />

          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setR(e.target.checked)}
            />
            아이디/비밀번호 저장
          </label>

          <button className="w-full rounded bg-black text-white py-2">
            로그인
          </button>
        </form>

        {msg && <p className="mt-3 text-center text-red-600">{msg}</p>}
      </div>
    </div>
  );
}

