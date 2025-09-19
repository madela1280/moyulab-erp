'use client';

export type RouteKey = string;                 // "통합관리", "기기관리>심포니" 등
export type RW = { r: boolean; w: boolean };
export type PermissionMap = Record<RouteKey, RW>;

// ✅ username(로그인 아이디)를 키로 씁니다.
export type AllUserPerms = Record<string, PermissionMap>; // username -> 권한맵

const PERM_KEY  = 'erp_permissions';
const USERS_KEY = 'erp_users';
const ADMIN_USERNAME = 'medela1280';

// 과거/환경별로 저장 키가 다를 수 있어 넓게 탐색
const LOGIN_KEYS = [
  'erp_user',      // (권장) 로그인 아이디(username)
  'erp_user_id',
  'erp_login',
  'erp_phone',
  'erp_id',
];

type StoredUser = { id: string; username: string; name?: string; phone?: string };

function getAllUsers(): StoredUser[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

// 세션/로컬에 들어있는 문자열(raw)을 확실한 username으로 정규화
function resolveUsername(raw: string | null): string | null {
  if (!raw) return null;
  if (raw === ADMIN_USERNAME) return ADMIN_USERNAME;

  const users = getAllUsers();

  // 이미 username인 경우
  if (users.some(u => u.username === raw)) return raw;

  // 전화번호 저장된 케이스
  const byPhone = users.find(u => u.phone && u.phone === raw);
  if (byPhone) return byPhone.username;

  // 이름 저장된 케이스
  const byName = users.find(u => u.name && u.name === raw);
  if (byName) return byName.username;

  // 내부 uuid(id) 저장된 케이스
  const byId = users.find(u => u.id === raw);
  if (byId) return byId.username;

  return null;
}

export function getCurrentUser(): { id: string } | null {
  try {
    let raw: string | null = null;
    for (const k of LOGIN_KEYS) {
      raw = (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(k) : null) ?? raw;
    }
    for (const k of LOGIN_KEYS) {
      raw = raw ?? (typeof localStorage !== 'undefined' ? localStorage.getItem(k) : null);
    }
    const username = resolveUsername(raw);
    return username ? { id: username } : null;
  } catch {
    return null;
  }
}

export function isAdmin(user?: { id?: string }) {
  return !!user && user.id === ADMIN_USERNAME; // username 비교
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

export function getUserPerms(username: string): PermissionMap {
  const all = loadAllPerms();
  return all[username] ?? {};
}

export function setUserPerms(username: string, perms: PermissionMap) {
  const all = loadAllPerms();
  const prev = all[username] ?? {};
  all[username] = { ...prev, ...perms }; // 병합 저장
  saveAllPerms(all);
}

// 상·하위 어느 쪽에 저장돼 있어도 읽기/쓰기를 허용(방어적)
export function canRead(username: string, routeKey: RouteKey): boolean {
  if (username === ADMIN_USERNAME) return true;
  const perms = getUserPerms(username);

  if (perms[routeKey]?.r) return true;

  const top = routeKey.split('>')[0];
  if (perms[top]?.r) return true;

  const anyChild = Object.entries(perms).some(([k, v]) => k.startsWith(`${top}>`) && v?.r);
  if (anyChild) return true;

  return false;
}

export function canWrite(username: string, routeKey: RouteKey): boolean {
  if (username === ADMIN_USERNAME) return true;
  const perms = getUserPerms(username);

  if (perms[routeKey]?.w) return true;

  const top = routeKey.split('>')[0];
  if (perms[top]?.w) return true;

  const anyChild = Object.entries(perms).some(([k, v]) => k.startsWith(`${top}>`) && v?.w);
  if (anyChild) return true;

  return false;
}

export function extractRouteKeysFromViewMap(viewMap: Record<RouteKey, any>): RouteKey[] {
  return Array.from(new Set(Object.keys(viewMap)));
}

export function prettyLabelOf(routeKey: RouteKey) {
  return routeKey.split('>').join(' > ');
}

// 관리자 전용 라우트
export const ADMIN_ONLY_KEYS = new Set<string>([
  "사용자 관리>권한설정",
  "사용자 관리>관리자 설정",
  "사용자 관리>사용자 추가",
]);




