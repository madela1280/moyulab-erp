'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { getCurrentUser, isAdmin, getUserPerms, setUserPerms } from '@/app/lib/permissions';
import LockScreen from './LockScreen';
import { VIEW_MAP, MENUS } from '../AppShell';

// ✅ username(로그인 아이디)을 권한 키로 사용
type User = { username: string; name: string; phone?: string };

function loadUsers(): User[] {
  try {
    const raw = localStorage.getItem('erp_users');
    const arr = raw ? JSON.parse(raw) : [];
    return arr
      .filter((u: any) => u.username !== 'medela1280') // 관리자 제외
      .map((u: any) => ({
        username: u.username,
        name: u.name ?? u.username,
        phone: u.phone,
      }));
  } catch {
    return [];
  }
}

// MENUS에서 대카테고리만 추출(사용자 관리 제외)
function extractTopLevelKeys(): string[] {
  return MENUS.map(m => m.label).filter(l => l !== '사용자 관리');
}

export default function PermissionSetting() {
  const me = getCurrentUser();
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUsername, setSelectedUsername] = useState<string>('');
  const [permDraft, setPermDraft] = useState<Record<string, { r: boolean; w: boolean }>>({});

  const topLevelKeys = useMemo(extractTopLevelKeys, []);

  useEffect(() => { setUsers(loadUsers()); }, []);

  // 선택 사용자 현재 권한 → 대카테고리로 역산 표기
  useEffect(() => {
    if (!selectedUsername) return;
    const current = getUserPerms(selectedUsername);
    const initial = topLevelKeys.reduce((acc, top) => {
      const childKeys = Object.keys(VIEW_MAP).filter(v => v.startsWith(top + '>'));
      const hasRead  = childKeys.some(ck => current[ck]?.r) || !!current[top]?.r;
      const hasWrite = childKeys.some(ck => current[ck]?.w) || !!current[top]?.w;
      acc[top] = { r: !!hasRead, w: !!hasWrite };
      return acc;
    }, {} as Record<string, { r: boolean; w: boolean }>);
    setPermDraft(initial);
  }, [selectedUsername, topLevelKeys]);

  if (!me || !isAdmin(me)) return <LockScreen />;

  return (
    <div className="p-4">
      {/* 가로폭 약 30% 축소, 중앙 정렬 */}
      <div className="mx-auto w-[70%] space-y-4">
        <h1 className="text-xl font-semibold">권한 설정</h1>

        {/* 사용자 선택 (이름 (전화)) — value는 username */}
        <div>
          <label className="text-sm text-gray-600">사용자 선택</label>
          <select
            className="w-full border rounded p-2"
            value={selectedUsername}
            onChange={(e) => setSelectedUsername(e.target.value)}
          >
            <option value="" disabled>사용자를 선택하세요</option>
            {users.map(u => (
              <option key={u.username} value={u.username}>
                {u.name}{u.phone ? ` (${u.phone})` : ''}
              </option>
            ))}
          </select>
        </div>

        {selectedUsername && (
          <div className="overflow-auto border rounded">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="text-left px-3 py-2">대카테고리</th>
                  <th className="text-center px-3 py-2">읽기</th>
                  <th className="text-center px-3 py-2">쓰기</th>
                </tr>
              </thead>
              <tbody>
                {topLevelKeys.map((key) => {
                  const val = permDraft[key] ?? { r: false, w: false };
                  return (
                    <tr key={key} className="border-t">
                      <td className="px-3 py-2">{key}</td>
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={val.r}
                          onChange={(e) =>
                            setPermDraft({ ...permDraft, [key]: { ...val, r: e.target.checked } })
                          }
                        />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={val.w}
                          onChange={(e) =>
                            setPermDraft({ ...permDraft, [key]: { ...val, w: e.target.checked } })
                          }
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="p-3 flex justify-end gap-2">
              <button
                className="px-3 py-2 border rounded"
                onClick={() => {
                  // 저장: 상위(top) 직접 저장 + 하위 전체 자동 반영
                  const merged: Record<string, { r: boolean; w: boolean }> = {};
                  topLevelKeys.forEach(top => {
                    const t = permDraft[top] ?? { r: false, w: false };

                    // 대카테고리 자체
                    merged[top] = { r: !!t.r, w: !!t.w };

                    // 하위 전체
                    const childKeys = Object.keys(VIEW_MAP).filter(k => k.startsWith(top + '>'));
                    childKeys.forEach(ck => { merged[ck] = { r: !!t.r, w: !!t.w }; });
                  });

                  setUserPerms(selectedUsername, merged);

                  // (선택) 즉시 반영을 위한 브로드캐스트
                  try {
                    localStorage.setItem('erp_permissions_version', String(Date.now()));
                    window.dispatchEvent(new Event('erp:perms-updated'));
                  } catch {}

                  alert('권한이 저장되었습니다.');
                }}
              >
                저장
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}






