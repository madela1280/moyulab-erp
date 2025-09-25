// app/lib/nav.ts
// 대카테고리 → 소카테고리 목록 정의

export const SUBNAV: Record<string, string[]> = {
  // ✅ 통합관리: 기존 소카테고리 그대로
  '통합관리': ['통합관리', '온라인', '보건소', '조리원'],

  // ✅ 기기관리: 요청하신 대로 첫 소카테고리를 '락티나'로 설정
  '기기관리': ['락티나'],

  // 아래 카테고리는 현재 소카테고리 정보가 없어서 빈 배열로 둡니다.
  // (비어 있으면 대카테고리 클릭 시 빈 페이지 표시)
  '사용자관리': [],
  '데이터업로드': [],
  '대여관리': [],
  '유축기현황': [],
  '문자': [],
  '합포장': [],
  '집계': [],
};

// 첫 소카테고리 얻기
export function getFirstSub(category: string): string | null {
  const list = SUBNAV[category] || [];
  return list.length > 0 ? list[0] : null;
}
