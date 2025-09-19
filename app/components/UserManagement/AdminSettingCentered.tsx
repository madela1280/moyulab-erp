'use client';
import AdminSetting from './AdminSetting';

export default function AdminSettingCentered() {
  return (
    <div className="min-h-[calc(100vh-80px)] flex items-start justify-center">
      <div className="mt-6">
        <AdminSetting />
      </div>
    </div>
  );
}
