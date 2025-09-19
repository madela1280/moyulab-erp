'use client';

export type RouteKey = string; // "통합관리", "통합관리>온라인" 등
export type RW = { r: boolean; w: boolean };
export type PermissionMap = Record<RouteKey, RW>;
export type AllUserPerms = Record<string, PermissionMap>; // userId -> 권한맵

const PERM_KEY = 'erp_permissions';
const USER_KEY = 'erp_user';     // 로그인 시 저장되는 값(과거에 id/전화번호 혼용 가능)
const USERS_KEY = 'erp_users';   // UserAdd.tsx가 저장하는 전체 사용자 목록
const ADMIN_ID = 'medela1280';

type StoredUser = { id: string; name?: string; phone?: string };

// ---- 내부 유틸 --------------------------------------------------------------

// erp_users에서 사용자 검색
function getAllUsers(): StoredUser[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// 과거 로그인 저장값(raw)이 id가 아닐 수도 있어(전화번호/이름 등).
// 가능한 케이스를 모두 매칭해서 "정식 userId" 로 정규화한다.
function resolveUserIdFromRaw(raw: string | null): string | null {
  if (!raw) return null;

  const users = getAllUsers();

  // 1) raw가 정확히 id인 경우
  const byId = users.find(u => u.id === raw);
  if (byId) return byId.id;

  // 2) 전화번호로 저장된 경우
  const byPhone = users.find(u => u.phone && u.phone === raw);
  if (byPhone) return byPhone.id;

  // 3) 이름으로 저장된 경우(안전 장치)
  const byName = users.find(u => u.name && u.name === raw);
  if (byName) return byName.id;

  // 4) ADMIN 계정(과거 하드코딩 예외)
  if (raw === ADMIN_ID) return ADMIN_ID;

  return null;
}

// ---- 공개 API --------------------------------------------------------------

export function getCurrentUser(): { id: string } | null {
  try {
    const raw =
      (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(USER_KEY) : null) ||
      (typeof localStorage !== 'undefined' ? localStorage.getItem(USER_KEY) : null);

    // 정규화(전화번호/이름 저장돼 있어도 실제 userId로 환원)
    const resolvedId = resolveUserIdFromRaw(raw);
    if (!resolvedId) return null;
    return { id: resolvedId };
  } catch {
    return null;
  }
}

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

// 특정 routeKey 읽기 권한
export function canRead(userId: string, routeKey: RouteKey): boolean {
  if (userId === ADMIN_ID) return true; // 관리자 무조건 통과
  const perms = getUserPerms(userId);

  // 1) 정확히 일치하는 키
  const p = perms[routeKey];
  if (p?.r) return true;

  // 2) 상위 카테고리로 저장만 되어 있고, 하위로 퍼짐이 안 된 경우 방어
  //    예: "기기관리>심포니" 체크 시 부모 "기기관리"에만 저장되어 있거나,
  //    또는 반대로 부모 체크 시 하위 저장이 누락된 케이스를 방어.
  const top = routeKey.split('>')[0];
  if (perms[top]?.r) return true;

  // 3) 해당 카테고리의 어떤 하위라도 읽기 권한이 있는지 체크(누락 방어)
  const hasChildRead = Object.entries(perms).some(([k, v]) => k.startsWith(`${top}>`) && v?.r);
  if (hasChildRead) return true;

  return false;
}

// 특정 routeKey 쓰기 권한
export function canWrite(userId: string, routeKey: RouteKey): boolean {
  if (userId === ADMIN_ID) return true; // 관리자 무조건 통과
  const perms = getUserPerms(userId);

  const p = perms[routeKey];
  if (p?.w) return true;

  const top = routeKey.split('>')[0];
  if (perms[top]?.w) return true;

  const hasChildWrite = Object.entries(perms).some(([k, v]) => k.startsWith(`${top}>`) && v?.w);
  if (hasChildWrite) return true;

  return false;
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


