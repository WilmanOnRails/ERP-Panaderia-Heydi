import { createHmac, timingSafeEqual } from "node:crypto"
import { cookies } from "next/headers"
import { prisma } from "@/lib/prisma"

const COOKIE_NAME = "erp_session"
const SESSION_TTL_SECONDS = 60 * 60 * 8

export type AuthenticatedUser = {
  id: number
  fullName: string
  username: string
  email: string
  role: string
}

function sessionSecret() {
  const secret = process.env.SESSION_SECRET
  if (!secret || Buffer.byteLength(secret) < 32) {
    throw new Error("SESSION_SECRET must contain at least 32 bytes")
  }
  return secret
}

function sign(payload: string) {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url")
}

export function createSessionToken(userId: number) {
  const payload = Buffer.from(JSON.stringify({
    sub: userId,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  })).toString("base64url")

  return `${payload}.${sign(payload)}`
}

function sessionUserId(token: string): number | null {
  const [payload, signature, extra] = token.split(".")
  if (!payload || !signature || extra !== undefined) return null

  let expectedSignature: Buffer
  let suppliedSignature: Buffer
  try {
    expectedSignature = Buffer.from(sign(payload), "base64url")
    suppliedSignature = Buffer.from(signature, "base64url")
  } catch {
    return null
  }
  if (expectedSignature.length !== suppliedSignature.length || !timingSafeEqual(expectedSignature, suppliedSignature)) return null

  try {
    const claims: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))
    if (typeof claims !== "object" || claims === null || !("sub" in claims) || !("exp" in claims)) return null
    const { sub, exp } = claims
    if (typeof sub !== "number" || !Number.isSafeInteger(sub) || typeof exp !== "number" || exp <= Math.floor(Date.now() / 1000)) return null
    return sub
  } catch {
    return null
  }
}

export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value
  if (!token) return null

  const userId = sessionUserId(token)
  if (userId === null) return null

  const user = await prisma.erpUser.findUnique({
    where: { id: userId },
    select: { id: true, fullName: true, username: true, email: true, role: true },
  })

  return user
}

export async function requireAuthenticatedUser() {
  const user = await getAuthenticatedUser()
  if (!user) throw new Error("No autorizado")
  return user
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  }
}

export const sessionCookieName = COOKIE_NAME
