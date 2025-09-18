// app/components/RuleModals.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  loadGuideMap, saveGuideMap, uniqueVendorsFromUnified,
  loadCategoryMap, saveCategoryMap, rebuildCategoryViewsFromRules,
  applyGuideToUnifiedRows, type Category
} from '../lib/rules';

function useVendors() {
  const [list, setList] = useState<string[]>([]);
  useEffect(() => {
    const load = () => setList(uniqueVendorsFromUnified());
    load();
    const h = () => load();
    window.addEventListener('unified_rows_updated', h);
    window.addEventListener('storage', h as any);
    return () => { window.removeEventListener('unified_rows_updated', h); window.removeEventListener('storage', h as any); };
  }, []);
  return list;
}

export function GuideRuleModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const vendors = useVendors();
  const [query, setQuery] = useState('');
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [guideName, setGuideName] = useState('');
  const [map, setMap] = useState<Record<string, string>>({});

  useEffect(() => { setMap(loadGuideMap()); }, [open]);

  const filtered = useMemo(
    () => vendors.filter(v => v.toLowerCase().includes(query.toLowerCase())),
    [vendors, query]
  );
  const toggle = (v: string, val: boolean) => setChecked(prev => ({ ...prev, [v]: val }));

  const apply = () => {
    const name = guideName.trim();
    if (!name) { alert('안내분류명을 입력하세요.'); return; }
    const m = { ...map };
    Object.keys(checked).forEach(v => { if (checked[v]) m[v] = name; });
    saveGuideMap(m);
    applyGuideToUnifiedRows();
    onClose();
  };

  const remove = () => {
    const m = { ...map };
    let changed = false;
    Object.keys(checked).forEach(v => {
      if (checked[v] && m[v]) { delete m[v]; changed = true; }
    });
    if (!changed) { alert('삭제할 항목을 체크하세요.'); return; }
    saveGuideMap(m);
    applyGuideToUnifiedRows();
    onClose();
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
      <div className="bg-white w-[720px] max-w-[95vw] rounded shadow">
        <div className="px-4 py-3 border-b font-semibold">안내분류 관리</div>
        <div className="p-4 grid grid-cols-2 gap-4">
          <div>
            <div className="mb-2 flex gap-2">
              <input
                className="flex-1 border rounded px-2 py-1 text-sm"
                placeholder="거래처 검색"
                value={query}
                onChange={(e)=>setQuery(e.target.value)}
              />
            </div>
            <div className="h-[340px] overflow-auto border rounded p-2">
              {filtered.map(v => (
                <label key={v} className="flex items-center gap-2 text-sm py-0.5">
                  <input type="checkbox" checked={!!checked[v]} onChange={(e)=>toggle(v,e.target.checked)} />
                  <span className="truncate" title={v}>{v}</span>
                  <span className="ml-auto text-xs text-gray-500">{map[v] ? `→ ${map[v]}` : ''}</span>
                </label>
              ))}
              {filtered.length===0 && <div className="text-xs text-gray-500">결과 없음</div>}
            </div>
          </div>
          <div>
            <div className="text-sm mb-1">적용할 안내분류명</div>
            <input
              className="w-full border rounded px-2 py-1 text-sm mb-3"
              placeholder="예) @메델라유축기"
              value={guideName}
              onChange={(e)=>setGuideName(e.target.value)}
            />
            <div className="flex gap-2">
              <button className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700" onClick={apply}>저장(적용)</button>
              <button className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50" onClick={remove}>선택 삭제</button>
              <button className="ml-auto px-3 py-1.5 text-sm border rounded hover:bg-gray-50" onClick={onClose}>닫기</button>
            </div>
            <div className="text-xs text-gray-500 mt-3">
              * 저장 시 선택된 거래처의 <b>안내분류</b>가 통합관리 데이터에 즉시 반영됩니다.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CategoryRuleModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const vendors = useVendors();
  const [query, setQuery] = useState('');
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [map, setMap] = useState<Record<string, Category>>({});
  const [dest, setDest] = useState<Category>('온라인');

  useEffect(() => { setMap(loadCategoryMap()); }, [open]);

  const filtered = useMemo(
    () => vendors.filter(v => v.toLowerCase().includes(query.toLowerCase())),
    [vendors, query]
  );
  const toggle = (v: string, val: boolean) => setChecked(prev => ({ ...prev, [v]: val }));

  const apply = () => {
    const m = { ...map };
    Object.keys(checked).forEach(v => { if (checked[v]) m[v] = dest; });
    saveCategoryMap(m);
    rebuildCategoryViewsFromRules();
    onClose();
  };

  const remove = () => {
    const m = { ...map };
    let changed = false;
    Object.keys(checked).forEach(v => {
      if (checked[v] && m[v]) { delete m[v]; changed = true; }
    });
    if (!changed) { alert('삭제할 항목을 체크하세요.'); return; }
    saveCategoryMap(m);
    rebuildCategoryViewsFromRules();
    onClose();
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
      <div className="bg-white w-[720px] max-w-[95vw] rounded shadow">
        <div className="px-4 py-3 border-b font-semibold">분류 관리(온라인/보건소/조리원)</div>
        <div className="p-4 grid grid-cols-2 gap-4">
          <div>
            <div className="mb-2 flex gap-2">
              <input
                className="flex-1 border rounded px-2 py-1 text-sm"
                placeholder="거래처 검색"
                value={query}
                onChange={(e)=>setQuery(e.target.value)}
              />
            </div>
            <div className="h-[340px] overflow-auto border rounded p-2">
              {filtered.map(v => (
                <label key={v} className="flex items-center gap-2 text-sm py-0.5">
                  <input type="checkbox" checked={!!checked[v]} onChange={(e)=>toggle(v,e.target.checked)} />
                  <span className="truncate" title={v}>{v}</span>
                  <span className="ml-auto text-xs text-gray-500">{map[v] ? `→ ${map[v]}` : ''}</span>
                </label>
              ))}
              {filtered.length===0 && <div className="text-xs text-gray-500">결과 없음</div>}
            </div>
          </div>
          <div>
            <div className="text-sm mb-2">대상 카테고리</div>
            <div className="flex gap-4 mb-3 text-sm">
              {(['온라인','보건소','조리원'] as Category[]).map(c => (
                <label key={c} className="flex items-center gap-2">
                  <input type="radio" name="dest" checked={dest===c} onChange={()=>setDest(c)} />
                  {c}
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <button className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700" onClick={apply}>저장(적용)</button>
              <button className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50" onClick={remove}>선택 삭제</button>
              <button className="ml-auto px-3 py-1.5 text-sm border rounded hover:bg-gray-50" onClick={onClose}>닫기</button>
            </div>
            <div className="text-xs text-gray-500 mt-3">
              * 저장 시 규칙에 따라 <b>온라인/보건소/조리원</b> 뷰가 즉시 재구성됩니다. (통합관리 데이터는 그대로)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
