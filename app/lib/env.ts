// app/lib/env.ts
export function getEnv() {
  const url = process.env.DATABASE_URL;
  // ❗ 빌드 시에는 throw 하지 않음. 라우트/요청 시에만 호출됨.
  if (!url) {
    // 런타임에만 에러 발생시켜 빌드 통과
    throw new Error("DATABASE_URL is missing at runtime.");
  }
  return { DATABASE_URL: url };
}
