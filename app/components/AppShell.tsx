'use client';

import Image from "next/image";
import React, { useEffect, useMemo, useRef, useState } from "react";

import UserAdd from "./UserManagement/UserAdd";
import AdminSettingCentered from "./UserManagement/AdminSettingCentered";

import UnifiedManagement from "./UnifiedManagement";
import NewSignup from "./NewSignup";
import OnlineManagement from "./OnlineManagement";
import HealthCenterManagement from "./HealthCenterManagement";
import PostpartumManagement from "./PostpartumManagement";
import DeviceSymphony from "./DeviceSymphony";
import DeviceLactina from "./DeviceLactina";
import DeviceSwing from "./DeviceSwing";
import DeviceSwingMaxi from "./DeviceSwingMaxi";
import DeviceFreestyle from "./DeviceFreestyle";
import DeviceSirilac from "./DeviceSirilac";
import DeviceGaksimil from "./DeviceGaksimil";

import PermissionSetting from './UserManagement/PermissionSetting';
import LockScreen from './UserManagement/LockScreen';

import { canRead, getCurrentUser, ADMIN_ONLY_KEYS, isAdmin } from '@/app/lib/permissions';

// 내용 없는 경우 비어 있는 뷰
const EmptyView = () => null; // 완전 빈 화면 (원하면 안내문으로 바꿔도 됨)

type MenuNode = { label: string; children?: MenuNode[] };

export const MENUS: MenuNode[] = [
  { label: "사용자 관리", children: [{ label: "사용자 추가" }, { label: "권한설정" }, { label: "관리자 설정" }] },
  { label: "통합관리", children: [{ label: "통합관리" }, { label: "온라인" }, { label: "보건소" }, { label: "조리원" }] },
  {
    label: "기기관리",
    children: [
      { label: "락티나" }, { label: "심포니" }, { label: "스윙" },
      { label: "스윙맥시" }, { label: "프리스타일" }, { label: "시밀래" }, { label: "각시밀" },
    ],
  },
  { label: "데이터 업로드", children: [{ label: "신규가입" }, { label: "반품접수" }] },
  {
    label: "대여관리",
    children: [
      { label: "만기문자", children: [{ label: "만기3일전" }, { label: "만기지남" }] },
      { label: "회수중" }, { label: "미회수" },
    ],
  },
  { label: "유축기현황", children: [{ label: "대여중" }, { label: "회수중" }, { label: "재고" }, { label: "수리중" }, { label: "문제기기" }, { label: "폐기" }] },
  { label: "문자", children: [{ label: "입금" }, { label: "보건소대여접수" }] },
  { label: "합포장", children: [{ label: "접수완료" }, { label: "송장출력" }] },
  { label: "집계", children: [{ label: "매출", children: [{ label: "거래처별" }, { label: "기간별" }, { label: "유축기별" }] }] },
];

export const VIEW_MAP: Record<string, React.ComponentType<any>> = {
  // 통합관리
  "통합관리": UnifiedManagement,
  "통합관리>온라인": OnlineManagement,
  "통합관리>보건소": HealthCenterManagement,
  "통합관리>조리원": PostpartumManagement,

  // 기기관리
  "기기관리>심포니": DeviceSymphony,
  "기기관리>락티나": DeviceLactina,
  "기기관리>스윙": DeviceSwing,
  "기기관리>스윙맥시": DeviceSwingMaxi,
  "기기관리>프리스타일": DeviceFreestyle,
  "기기관리>시밀래": DeviceSirilac,
  "기기관리>각시밀": DeviceGaksimil,

  // 데이터 업로드
  "데이터 업로드>신규가입": NewSignup,

  // 사용자 관리(관리자 전용)
  "사용자 관리>사용자 추가": UserAdd,
  "사용자 관리>관리자 설정": AdminSettingCentered,
  "사용자 관리>권한설정": PermissionSetting,
};

// 대카테고리의 첫 소카테고리 라벨
function getFirstSub(top: string): string | null {
  const node = MENUS.find(m => m.label === top);
  return node?.children?.[0]?.label ?? null;
}

// ✅ 권한 게이트: 권한 변경 브로드캐스트 수신 시 재평가
function PermissionGate({ routeKey, children }: { routeKey: string; children: React.ReactNode }) {
  const [, force] = useState(0);            // 리렌더 트리거
  const me = getCurrentUser();

  useEffect(() => {
    const bump = () => force(v => v + 1);
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'erp_permissions' || e.key === 'erp_permissions_version') bump();
    };
    window.addEventListener('erp:perms-updated', bump as EventListener);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('erp:perms-updated', bump as EventListener);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  if (!me) return <LockScreen />;

  // 관리자 무조건 통과
  if (isAdmin(me)) return <>{children}</>;

  // 관리자 전용 라우트는 관리자 외 차단
  if (ADMIN_ONLY_KEYS.has(routeKey)) return <LockScreen />;

  // 정확히 일치하는 키로 읽기 권한
  if (canRead(me.id, routeKey)) return <>{children}</>;

  // 부모(대카테고리) 권한만 있어도 통과
  const top = routeKey.split('>')[0];
  if (canRead(me.id, top)) return <>{children}</>;

  return <LockScreen />;
}

export default function AppShell() {
  // ✅ 로그인 상태 확인 (쿠키 기반)
useEffect(() => {
  const checkAuth = async () => {
    try {
      const res = await fetch("/api/auth/me", {
        method: "GET",
        credentials: "include", // ← 쿠키 포함 (핵심)
      });
      const data = await res.json();
      if (!data.ok) {
        window.location.href = "/login";
      }
    } catch (err) {
      console.error("auth check failed:", err);
      window.location.href = "/login";
    }
  };
  checkAuth();
}, []);

  // 기본 랜딩: 통합관리의 첫 소카테고리
  const [openTop, setOpenTop] = useState<string>("통합관리");
  const initialFirstSub = getFirstSub("통합관리");
  const [activeSub, setActiveSub] = useState<string | null>(initialFirstSub);
  const [activeKey, setActiveKey] = useState<string>(
    initialFirstSub ? `통합관리>${initialFirstSub}` : "통합관리"
  );

  const [visibleSubOf, setVisibleSubOf] = useState<string | null>(openTop);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTimer = () => { if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null; } };
  const startHide = () => { clearTimer(); hideTimer.current = setTimeout(() => setVisibleSubOf(null), 2000); };

  const topMenu = useMemo(() => MENUS.find(m => m.label === openTop) || null, [openTop]);
  const subItems = topMenu?.children ?? [];
  const subMenu = useMemo(() => subItems.find(s => s.label === activeSub) || null, [subItems, activeSub]);

  const pillBase = "px-[0.6rem] h-[1.6rem] leading-[1.6rem] text-[0.62rem] rounded-full border";
  const pillIdle = "bg-white border-gray-300 text-gray-700 hover:bg-gray-50";
  const pillActive = "bg-[#e7eef8] border-[#b7c4dd] text-[#2b4a7f] font-medium";

  const ActiveView = (VIEW_MAP[activeKey] ?? UnifiedManagement) as React.ComponentType<any>;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-gray-100 border-b px-6 pt-3 pb-2">
        <div className="flex items-center">
          <div className="flex items-center space-x-3">
            <Image src="/moyulogo.jpg" alt="Moulab Logo" width={36} height={36} priority />
            <h1 className="text-xl font-bold text-gray-700">Moulab Rental ERP</h1>
          </div>

          {/* 대카테고리 */}
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
                    // ★ 클릭한 대카테고리의 첫 소카테고리로 즉시 전환
                    setOpenTop(m.label);
                    const first = getFirstSub(m.label);
                    setActiveSub(first);
                    setActiveKey(first ? `${m.label}>${first}` : m.label);
                    if (m.children?.length) setVisibleSubOf(m.label);
                    else setVisibleSubOf(null);
                  }}
                  className={`text-[0.95rem] font-semibold ${openTop === m.label ? "text-black" : "text-gray-700 hover:text-black"}`}
                >
                  {m.label}
                </button>

                {/* 소카테고리 */}
                {visibleSubOf === m.label && (m.children ?? []).length > 0 && (
                  <div className="absolute left-0 top-full mt-2 z-30" onMouseEnter={clearTimer} onMouseLeave={startHide}>
                    <div className="inline-flex whitespace-nowrap items-center gap-2 bg-white border rounded-full shadow px-3 py-1">
                      {m.children!.map((s) => (
                        <button
                          key={s.label}
                          onClick={() => {
                            if (openTop !== m.label) setOpenTop(m.label);
                            setActiveSub(s.label);
                            setActiveKey(`${m.label}>${s.label}`);
                            setVisibleSubOf(m.label);
                          }}
                          className={`${pillBase} ${activeSub === s.label ? pillActive : pillIdle}`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </nav>

          <div className="flex-1" />
        </div>
      </header>

      {/* 본문 */}
      <main className="p-6">
        <PermissionGate routeKey={activeKey}>
          <ActiveView />
        </PermissionGate>
      </main>
    </div>
  );
}






