import jwt from "jsonwebtoken";
import { env } from "./env.js";

export type AccessTokenPayload = {
  sub: string; // user_id
  email: string;
  typ: "access";
};

export function signAccessToken(user: { id: string; email: string }): string {
  const payload: AccessTokenPayload = { sub: user.id, email: user.email, typ: "access" };
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.ACCESS_TOKEN_TTL_SECONDS });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET) as any;
  if (decoded?.typ !== "access") throw new Error("Invalid token type");
  return decoded as AccessTokenPayload;
}
