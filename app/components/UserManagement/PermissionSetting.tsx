'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { getCurrentUser, isAdmin, getUserPerms, setUserPerms } from '@/app/lib/permissions';
import LockScreen from './LockScreen';
import { VIEW_MAP } from '../AppShell';

type User = { id: string; name: string; phone?: string };

// 사용자 목록 로드 (관리자 제외)
function loadUsers(): User[] {
  try {
    const raw = localStorage.getItem('erp_users');
    const arr = raw ? JSON.parse(raw) : [];
    // 관리자 제거
    return arr.filter((u: User) => u.id !== 'medela1280');
  } catch {
    return [];
  }
}

// 대카테고리 키 추출
function extractTopLevelKeys(viewMap: Record<string, any>): string[] {
  const keys = Object.keys(viewMap);
  const topLevels = new Set<string>();
  keys.forEach(k => {
    const top = k.split('>')[0];
    topLevels.add(top);
  });
  return Array.from(topLevels);
}

export default function PermissionSetting() {
  const me = getCurrentUser();
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [permDraft, setPermDraft] = useState<Record<string, { r: boolean; w: boolean }>>({});

  const topLevelKeys = useMemo(() => extractTopLevelKeys(VIEW_MAP), []);

  useEffect(() => {
    setUsers(loadUsers());
  }, []);

  useEffect(() => {
    if (!selectedUserId) return;
    const current = getUserPerms(selectedUserId);
    // 대카테고리만 초기화
    const initial = topLevelKeys.reduce((acc, k) => {
      // 만약 하위 route 중 하나라도 r/w true면 상위도 체크된 것으로 표시
      const childKeys = Object.keys(VIEW_MAP).filter(v => v.startsWith(k));
      const hasRead = childKeys.some(ck => current[ck]?.r);
      const hasWrite = childKeys.some(ck => current[ck]?.w);
      acc[k] = { r: hasRead, w: hasWrite };
      return acc;
    }, {} as Record<string, { r: boolean; w: boolean }>);
    setPermDraft(initial);
  }, [selectedUserId, topLevelKeys]);

  if (!me || !isAdmin(me)) {
    return <LockScreen />;
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-semibold">권한 설정</h1>

      {/* 사용자 선택 */}
      <div>
        <label className="text-sm text-gray-600">사용자 선택</label>
        <select
          className="w-full border rounded p-2"
          value={selectedUserId}
          onChange={(e) => setSelectedUserId(e.target.value)}
        >
          <option value="" disabled>사용자를 선택하세요</option>
          {users.map(u => (
            <option key={u.id} value={u.id}>
              {u.name ?? u.id} ({u.id})
            </option>
          ))}
        </select>
      </div>

      {selectedUserId && (
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
                        onChange={(e) => {
                          const next = { ...val, r: e.target.checked };
                          setPermDraft({ ...permDraft, [key]: next });
                        }}
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={val.w}
                        onChange={(e) => {
                          const next = { ...val, w: e.target.checked };
                          setPermDraft({ ...permDraft, [key]: next });
                        }}
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
                // 저장 시: 대카테고리 → 하위 전체에 적용
                const newPerms: Record<string, { r: boolean; w: boolean }> = {};
                topLevelKeys.forEach(top => {
                  const topVal = permDraft[top] ?? { r: false, w: false };
                  const childKeys = Object.keys(VIEW_MAP).filter(v => v.startsWith(top));
                  childKeys.forEach(ck => {
                    newPerms[ck] = { r: topVal.r, w: topVal.w };
                  });
                });
                setUserPerms(selectedUserId, newPerms);
                alert('권한이 저장되었습니다.');
              }}
            >
              저장
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

