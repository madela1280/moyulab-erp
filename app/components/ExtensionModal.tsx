'use client';

import React from 'react';

/**
 * ✅ 더미 연장 모달 (빌드 통과용)
 * 실제 ERP에서는 연장 처리 조건 입력창 역할
 */

export default function ExtensionModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-5 w-[380px] text-center">
        <h2 className="text-lg font-semibold text-gray-700 mb-3">연장 조건 입력</h2>
        <p className="text-sm text-gray-600 mb-5">
          현재는 클라우드 ERP 전환 중으로, 실제 연장 입력 기능은 비활성화되어 있습니다.
        </p>
        <button
          onClick={onClose}
          className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
        >
          닫기
        </button>
      </div>
    </div>
  );
}
