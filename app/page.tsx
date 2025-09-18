'use client';

import Image from "next/image";
import React, { useMemo, useRef, useState } from "react";
import UnifiedManagement from "./components/UnifiedManagement";
import NewSignup from "./components/NewSignup";
import OnlineManagement from './components/OnlineManagement'
import HealthCenterManagement from './components/HealthCenterManagement'
import PostpartumManagement from './components/PostpartumManagement'
import DeviceSymphony from "./components/DeviceSymphony";
import DeviceLactina from "./components/DeviceLactina";
import DeviceSwing from "./components/DeviceSwing";
import DeviceSwingMaxi from "./components/DeviceSwingMaxi";
import DeviceFreestyle from "./components/DeviceFreestyle";
import DeviceSirilac from "./components/DeviceSirilac";
import DeviceGaksimil from "./components/DeviceGaksimil";


type MenuNode = { label: string; children?: MenuNode[] };

const MENUS: MenuNode[] = [
  { label: "사용자 관리", children: [{ label: "사용자 추가" }, { label: "권한설정" }, { label: "관리자 설정" }] },
  { label: "통합관리", children: [{ label: "통합관리" }, { label: "온라인" }, { label: "보건소" }, { label: "조리원" }] },
  {
    label: "기기관리",
    children: [
    { label: "락티나" },
    { label: "심포니" },
    { label: "스윙" },
    { label: "스윙맥시" },
    { label: "프리스타일" },
    { label: "시밀래" },
    { label: "각시밀" },
  ],
},

  // ⬇️ 변경: "신규가입"을 "데이터 업로드"로 개명하고 하위 2개로 분리
  { label: "데이터 업로드", children: [{ label: "신규가입" }, { label: "반품접수" }] },

  {
    label: "대여관리",
    children: [
      { label: "만기문자", children: [{ label: "만기3일전" }, { label: "만기지남" }] },
      { label: "회수중" },
      { label: "미회수" }
    ]
  },
  { label: "유축기현황", children: [{ label: "대여중" }, { label: "회수중" }, { label: "재고" }, { label: "수리중" }, { label: "문제기기" }, { label: "폐기" }] },
  { label: "문자", children: [{ label: "입금" }, { label: "보건소대여접수" }] },
  { label: "합포장", children: [{ label: "접수완료" }, { label: "송장출력" }] },

  // ⬇️ 변경: "데이터" → "집계"
  { label: "집계", children: [{ label: "매출", children: [{ label: "거래처별" }, { label: "기간별" }, { label: "유축기별" }] }] },
];

// 화면 매핑: "대카테고리>소카테고리" 또는 "대카테고리" 키 사용
const VIEW_MAP: Record<string, React.ComponentType<any>> = {
  // 통합관리
  "통합관리": UnifiedManagement,
  "통합관리>온라인": OnlineManagement,
  "통합관리>보건소": HealthCenterManagement,
  "통합관리>조리원": PostpartumManagement,
  "기기관리>심포니": DeviceSymphony,
  "기기관리>락티나": DeviceLactina,
  "기기관리>스윙": DeviceSwing,
  "기기관리>스윙맥시": DeviceSwingMaxi,
  "기기관리>프리스타일": DeviceFreestyle,
  "기기관리>시밀래": DeviceSirilac,
  "기기관리>각시밀": DeviceGaksimil,

  // 데이터 업로드
  "데이터 업로드>신규가입": NewSignup,
  // "데이터 업로드>반품접수": ReturnsIntake, // 추후 구현 시 주석 해제
};

// (옵션) 반품접수 자리 표시자 — 실제 화면 만들기 전 임시 표시
function ReturnsIntake() {
  return (
    <div className="bg-white border rounded shadow-sm mt-8">
      <div className="px-4 py-3 font-semibold border-b">반품접수</div>
      <div className="p-6 text-sm text-gray-500">반품 접수 화면은 추후 연결합니다.</div>
    </div>
  );
}

export default function Home() {
  // 선택된 대/소 카테고리
  const [openTop, setOpenTop] = useState<string>("통합관리");
  const [activeSub, setActiveSub] = useState<string | null>(null);
  const [activeKey, setActiveKey] = useState<string>("통합관리"); // ✅ (1) 추가

  // 어떤 대카테고리의 소카테고리 바가 보이는지 (마우스 벗어난 뒤 2초 후 숨김)
  const [visibleSubOf, setVisibleSubOf] = useState<string | null>("통합관리");
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTimer = () => { if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null; } };
  const startHide = () => { clearTimer(); hideTimer.current = setTimeout(() => setVisibleSubOf(null), 2000); };

  // 현재 메뉴 데이터
  const topMenu = useMemo(() => MENUS.find(m => m.label === openTop) || null, [openTop]);
  const subItems = topMenu?.children ?? [];
  const subMenu = useMemo(() => subItems.find(s => s.label === activeSub) || null, [subItems, activeSub]);

  // 소카테고리 pill 스타일 (20% 작게)
  const pillBase = "px-[0.6rem] h-[1.6rem] leading-[1.6rem] text-[0.62rem] rounded-full border";
  const pillIdle = "bg-white border-gray-300 text-gray-700 hover:bg-gray-50";
  const pillActive = "bg-[#e7eef8] border-[#b7c4dd] text-[#2b4a7f] font-medium";

  // 본문에 렌더할 컴포넌트 선택: "대카테고리>소카테고리" 우선, 없으면 "대카테고리"
  // const viewKey = activeSub ? `${openTop}>${activeSub}` : openTop;
  // const ActiveView = VIEW_MAP[viewKey] ?? UnifiedManagement;
  const ActiveView = VIEW_MAP[activeKey] ?? UnifiedManagement; // ✅ (2) 교체

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-gray-100 border-b px-6 pt-3 pb-2">
        <div className="flex items-center">
          <div className="flex items-center space-x-3">
            <Image src="/moyulogo.jpg" alt="Moyulab Logo" width={36} height={36} priority />
            <h1 className="text-xl font-bold text-gray-700">Moyulab Rental ERP</h1>
          </div>

          {/* 대카테고리: 간격 20% 확대 */}
          <nav className="hidden md:flex items-center gap-[2.4rem] ml-[380px]">
            {MENUS.map((m) => (
              <div
                key={m.label}
                className="relative"
                onMouseEnter={() => { clearTimer(); if (m.children?.length) setVisibleSubOf(m.label); }}
                onMouseLeave={startHide}
              >
                <button
                  onClick={() => {
                    setOpenTop(m.label);
                    setActiveSub(null);
                    if (m.children?.length) setVisibleSubOf(m.label);
                    else setVisibleSubOf(null);
                    setActiveKey(m.label); // ✅ (3) 추가: 대카테고리 즉시 렌더
                  }}
                  className={`text-[0.95rem] font-semibold ${
                    openTop === m.label ? "text-black" : "text-gray-700 hover:text-black"
                  }`}
                >
                  {m.label}
                </button>

                {/* 소카테고리: 해당 대카테고리 바로 아래, 가로 고정 */}
                {visibleSubOf === m.label && (m.children ?? []).length > 0 && (
                  <div
                    className="absolute left-0 top-full mt-2 z-30"
                    onMouseEnter={clearTimer}
                    onMouseLeave={startHide}
                  >
                    {/* 가로 고정: inline-flex + whitespace-nowrap */}
                    <div className="inline-flex whitespace-nowrap items-center gap-2 bg-white border rounded-full shadow px-3 py-1">
                      {m.children!.map((s) => (
                        <button
                          key={s.label}
                          onClick={() => {
                            if (openTop !== m.label) setOpenTop(m.label);
                            setActiveSub(s.label);
                            setActiveKey(`${m.label}>${s.label}`); // ✅ (4) 교체: 즉시 렌더
                            setVisibleSubOf(m.label);
                          }}
                          className={`${pillBase} ${activeSub === s.label ? pillActive : pillIdle}`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>

                    {/* 소소카테고리 (있을 때) - 동일하게 가로 고정 */}
                    {activeSub && m.children!.find(c => c.label === activeSub && (c.children ?? []).length > 0) && (
                      <div className="mt-2" onMouseEnter={clearTimer} onMouseLeave={startHide}>
                        <div className="inline-flex whitespace-nowrap items-center gap-2 bg-white border rounded-full shadow px-3 py-1">
                          {m.children!.find(c => c.label === activeSub)!.children!.map(t => (
                            <button key={t.label} className={`${pillBase} ${pillIdle}`} onClick={() => {}}>
                              {t.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </nav>

          <div className="flex-1" />
        </div>
      </header>

      {/* 본문: 선택된 화면 렌더 */}
      <main className="p-6">
        <ActiveView />
      </main>
    </div>
  );
}







