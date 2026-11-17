// Signed session token: proves who registered, so emails only go to that person's own address.
// Nothing is stored on the server; each user's dashboard lives in their own browser.
import { createHmac, timingSafeEqual } from "crypto";

const secret = () => {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("SESSION_SECRET is not set (see README).");
  return s;
};
const b64 = (s) => Buffer.from(s).toString("base64url");
const sig = (p) => createHmac("sha256", secret()).update(p).digest("base64url");

export function sign(user) {
  const p = b64(JSON.stringify({ id: user.id, name: user.name, email: user.email, iat: Date.now() }));
  return `${p}.${sig(p)}`;
}

export function verify(token) {
  const [p, s] = String(token || "").split(".");
  if (!p || !s) return null;
  const a = Buffer.from(sig(p)), b = Buffer.from(s);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try { return JSON.parse(Buffer.from(p, "base64url").toString()); } catch { return null; }
}
