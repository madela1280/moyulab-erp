// app/lib/auth.ts
import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET || "super_secret_key";

// 토큰 생성
export function createToken(payload: object) {
  return jwt.sign(payload, SECRET, { expiresIn: "7d" }); // 7일 유지
}

// 토큰 검증
export function verifyToken(token: string) {
  try {
    return jwt.verify(token, SECRET);
  } catch {
    return null;
  }
}
