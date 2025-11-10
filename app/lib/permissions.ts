export async function getCurrentUser() {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    const data = await res.json();
    if (data.ok && data.username) {
      return { username: data.username, role: data.role ?? 'user' };
    }
    return null;
  } catch (err) {
    console.error('❌ 사용자 정보 불러오기 실패:', err);
    return null;
  }
}

