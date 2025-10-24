'use client';

import React from 'react';

/**
 * ✅ 더미 모달 컴포넌트 (빌드용)
 * 실제 규칙 설정 기능은 추후 DB 기반으로 연결 예정
 */

export function GuideRuleModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-4 w-[360px] text-center">
        <h2 className="font-semibold text-gray-700 mb-3">안내분류 규칙 설정</h2>
        <p className="text-sm text-gray-600 mb-4">현재는 DB 버전에서 규칙 편집 기능이 비활성화되어 있습니다.</p>
        <button
          onClick={onClose}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
        >
          닫기
        </button>
      </div>
    </div>
  );
}

export function CategoryRuleModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-4 w-[360px] text-center">
        <h2 className="font-semibold text-gray-700 mb-3">카테고리 규칙 설정</h2>
        <p className="text-sm text-gray-600 mb-4">DB ERP 전환 중입니다. 추후 활성화 예정입니다.</p>
        <button
          onClick={onClose}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
        >
          닫기
        </button>
      </div>
    </div>
  );
}
