'use client';

export type RouteKey = string; // "통합관리", "통합관리>온라인" 등

export type RW = { r: boolean; w: boolean };
export type PermissionMap = Record<RouteKey, RW>;
export type AllUserPerms = Record<string, PermissionMap>; // userId -> 권한맵

const PERM_KEY = 'erp_permissions';
const USER_KEY = 'erp_user';   // 로그인 시 ID 저장
const ADMIN_ID = 'medela1280';

// 현재 로그인 사용자 가져오기
export function getCurrentUser() {
  try {
    const uid =
      sessionStorage.getItem(USER_KEY) ||
      localStorage.getItem(USER_KEY);

    if (!uid) return null;
    return { id: uid };
  } catch {
    return null;
  }
}

// 관리자 여부 확인
export function isAdmin(user?: { id?: string }) {
  return !!user && user.id === ADMIN_ID;
}

export function loadAllPerms(): AllUserPerms {
  try {
    const raw = localStorage.getItem(PERM_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveAllPerms(all: AllUserPerms) {
  localStorage.setItem(PERM_KEY, JSON.stringify(all));
}

export function getUserPerms(userId: string): PermissionMap {
  const all = loadAllPerms();
  return all[userId] ?? {};
}

export function setUserPerms(userId: string, perms: PermissionMap) {
  const all = loadAllPerms();
  all[userId] = perms;
  saveAllPerms(all);
}

export function canRead(userId: string, routeKey: RouteKey): boolean {
  if (userId === ADMIN_ID) return true; // ✅ 관리자 무조건 통과
  const p = getUserPerms(userId)[routeKey];
  return !!p?.r;
}

export function canWrite(userId: string, routeKey: RouteKey): boolean {
  if (userId === ADMIN_ID) return true; // ✅ 관리자 무조건 통과
  const p = getUserPerms(userId)[routeKey];
  return !!p?.w;
}

// VIEW_MAP에서 카테고리 키 추출
export function extractRouteKeysFromViewMap(viewMap: Record<RouteKey, any>): RouteKey[] {
  const keys = Object.keys(viewMap);
  return Array.from(new Set(keys));
}

// "통합관리>온라인" → "통합관리 > 온라인"
export function prettyLabelOf(routeKey: RouteKey) {
  return routeKey.split('>').join(' > ');
}

// 관리자 전용 라우트
export const ADMIN_ONLY_KEYS = new Set<string>([
  "사용자 관리>권한설정",
  "사용자 관리>관리자 설정",
  "사용자 관리>사용자 추가",
]);

