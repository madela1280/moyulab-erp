// app/[category]/page.tsx
import { redirect } from 'next/navigation';
import { getFirstSub } from '../lib/nav';

export default function CategoryPage({
  params,
}: {
  params: { category: string };
}) {
  const category = params.category;
  const first = getFirstSub(category);

  // 소카테고리가 있으면 첫 번째로 즉시 이동
  if (first) {
    // 한글 경로 안전 처리
    const to = `/${encodeURIComponent(category)}/${encodeURIComponent(first)}`;
    redirect(to);
  }

  // 소카테고리가 없으면 빈 화면(요청사항)
  return <div style={{ padding: 16 }} />;
}
