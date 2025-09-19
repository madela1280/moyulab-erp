'use client';

export type RouteKey = string; // e.g. "통합관리", "통합관리>온라인", "데이터 업로드>신규가입"

export type RW = { r: boolean; w: boolean };
export type PermissionMap = Record<RouteKey, RW>;
export type AllUserPerms = Record<string, PermissionMap>; // userId -> per route

const PERM_KEY = 'erp_permissions';
const AUTH_KEY = 'erp_auth';        // { id, name, isAdmin, ... } 형태라 가정
const ADMIN_ID = 'medela1280';

export function getCurrentUser() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function isAdmin(user?: { id?: string }) {
  const u = user ?? getCurrentUser();
  return !!u && u.id === ADMIN_ID;
}

export function loadAllPerms(): AllUserPerms {
  try {
    const raw = localStorage.getItem(PERM_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
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
  if (userId === ADMIN_ID) return true;
  const p = getUserPerms(userId)[routeKey];
  return !!p?.r;
}

export function canWrite(userId: string, routeKey: RouteKey): boolean {
  if (userId === ADMIN_ID) return true;
  const p = getUserPerms(userId)[routeKey];
  return !!p?.w;
}

/** VIEW_MAP에서 자동으로 모든 routeKey(카테고리 및 서브카테고리) 추출 */
export function extractRouteKeysFromViewMap(viewMap: Record<RouteKey, any>): RouteKey[] {
  const keys = Object.keys(viewMap);
  // 중복 제거
  return Array.from(new Set(keys));
}

/** 라벨 표시용: "통합관리>온라인" 을 ["통합관리","온라인"]로 나눠 보기 좋게 */
export function prettyLabelOf(routeKey: RouteKey) {
  return routeKey.split('>').join(' > ');
}

// 관리자 전용 라우트 키 모음
export const ADMIN_ONLY_KEYS = new Set<string>([
  "사용자 관리>권한설정",
  "사용자 관리>관리자 설정",
  "사용자 관리>사용자 추가",
]);
