export function getCurrentUser() {
  try {
    const stored = localStorage.getItem('erp_user');
    if (!stored) return null;
    return { username: stored };
  } catch {
    return null;
  }
}
