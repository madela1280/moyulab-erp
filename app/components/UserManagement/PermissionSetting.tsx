'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { extractRouteKeysFromViewMap, getCurrentUser, isAdmin, getUserPerms, setUserPerms, prettyLabelOf } from '@/app/lib/permissions';
import LockScreen from './LockScreen';
import { ShieldCheck } from 'lucide-react';

// 👇 AppShell에서 export 하게 만들거나, 별도 경로에서 import
import { VIEW_MAP } from '../AppShell'; 

type User = { id: string; name: string; phone?: string };

function loadUsers(): User[] {
  try {
    const raw = localStorage.getItem('erp_users'); // UserAdd.tsx가 쓰는 저장소 가정
    const arr = raw ? JSON.parse(raw) : [];
    // 관리자도 목록에 포함(권한표시 의미는 없지만, 일관성 위해 표시만 가능)
    // 필요 시 필터링 가능
    if (!arr.find((u: User) => u.id === 'medela1280')) {
      arr.unshift({ id: 'medela1280', name: '관리자(마스터)' });
    }
    return arr;
  } catch {
    return [{ id: 'medela1280', name: '관리자(마스터)' }];
  }
}

export default function PermissionSetting() {
  const me = getCurrentUser();
  const routeKeys = useMemo(() => extractRouteKeysFromViewMap(VIEW_MAP), []);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [permDraft, setPermDraft] = useState<Record<string, { r: boolean; w: boolean }>>({});

  useEffect(() => { setUsers(loadUsers()); }, []);

  useEffect(() => {
    if (!selectedUserId) return;
    const current = getUserPerms(selectedUserId);
    // routeKey가 추가/삭제돼도 자동 반영: 존재하지 않으면 false로 기본 세팅
    const initial = routeKeys.reduce((acc, k) => {
      acc[k] = current[k] ?? { r: false, w: false };
      return acc;
    }, {} as Record<string, { r: boolean; w: boolean }>);
    setPermDraft(initial);
  }, [selectedUserId, routeKeys]);

  if (!me || !isAdmin(me)) {
    return <LockScreen />;
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-6 h-6" />
        <h1 className="text-xl font-semibold">권한 설정</h1>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
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
          <p className="text-xs text-gray-500 mt-1">※ 신규 사용자 추가 시 자동으로 목록에 표시됩니다.</p>
        </div>
        <div className="border rounded p-3 bg-gray-50">
          <p className="text-sm">안내</p>
          <ul className="list-disc list-inside text-xs text-gray-600">
            <li>관리자(medela1280)는 모든 권한을 기본 부여하며 설정이 필요 없습니다.</li>
            <li>카테고리/화면 목록은 ERP의 메뉴(VIEW_MAP)를 기반으로 자동 갱신됩니다.</li>
          </ul>
        </div>
      </div>

      {selectedUserId && (
        <div className="overflow-auto border rounded">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="text-left px-3 py-2">카테고리 / 화면</th>
                <th className="text-center px-3 py-2">읽기</th>
                <th className="text-center px-3 py-2">쓰기</th>
              </tr>
            </thead>
            <tbody>
              {routeKeys.map((key) => {
                const val = permDraft[key] ?? { r: false, w: false };
                return (
                  <tr key={key} className="border-t">
                    <td className="px-3 py-2">{prettyLabelOf(key)}</td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={val.r}
                        onChange={(e) => {
                          const next = { ...permDraft[key], r: e.target.checked };
                          setPermDraft({ ...permDraft, [key]: next });
                        }}
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={val.w}
                        onChange={(e) => {
                          const next = { ...permDraft[key], w: e.target.checked };
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
                // 읽기만 체크된 항목에서 쓰기 체크 해제 유지
                const normalized = Object.fromEntries(
                  Object.entries(permDraft).map(([k, v]) => [k, { r: !!v.r, w: !!v.w }])
                );
                setUserPerms(selectedUserId, normalized);
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
