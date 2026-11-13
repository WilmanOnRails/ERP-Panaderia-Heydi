import bcrypt from "bcryptjs"
import { NextResponse } from "next/server"
import { z } from "zod"
import { createSessionToken, sessionCookieName, sessionCookieOptions } from "@/lib/auth/session"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

const loginSchema = z.object({
  identifier: z.string().trim().min(1).max(254),
  password: z.string().min(1).refine((value) => Buffer.byteLength(value, "utf8") <= 72),
}).strict()

const DUMMY_PASSWORD_HASH = "$2b$12$DpLP8xXJj4cnh/qmON0rZOsVPpm.jW8hk1XxM/M84pkDUNFQUb0cu"
const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000
const attempts = new Map<string, { count: number; resetAt: number }>()

function clientKey(request: Request) {
  const trustedProxyIp = request.headers.get("x-real-ip")
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  return trustedProxyIp?.trim() || forwardedFor || "unknown"
}

function takeLoginAttempt(key: string) {
  const now = Date.now()
  const current = attempts.get(key)
  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS })
    if (attempts.size > 10_000) {
      for (const [entry, value] of attempts) {
        if (value.resetAt <= now) attempts.delete(entry)
      }
      if (attempts.size > 10_000) {
        const oldest = attempts.keys().next()
        if (!oldest.done) attempts.delete(oldest.value)
      }
    }
    return true
  }
  if (current.count >= MAX_ATTEMPTS) return false
  current.count += 1
  return true
}

export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return NextResponse.json({ error: "Se requiere contenido JSON." }, { status: 415 })
  }

  let body: unknown
  try {
    const raw = await request.text()
    if (Buffer.byteLength(raw, "utf8") > 8_192) {
      return NextResponse.json({ error: "La solicitud es demasiado grande." }, { status: 413 })
    }
    body = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: "La solicitud no contiene JSON válido." }, { status: 400 })
  }

  const parsed = loginSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Ingresa un usuario o correo y una contraseña válida." }, { status: 400 })
  }

  const key = clientKey(request)
  if (!takeLoginAttempt(key)) {
    return NextResponse.json(
      { error: "Demasiados intentos. Espera 15 minutos antes de volver a intentarlo." },
      { status: 429, headers: { "Retry-After": "900" } },
    )
  }

  const identifier = parsed.data.identifier.toLowerCase()
  let user
  try {
    user = await prisma.erpUser.findFirst({
      where: {
        OR: [
          { username: { equals: identifier, mode: "insensitive" } },
          { email: { equals: identifier, mode: "insensitive" } },
        ],
      },
      select: { id: true, fullName: true, username: true, email: true, role: true, passwordHash: true },
    })
  } catch (error) {
    console.error("Login database lookup failed", error)
    return NextResponse.json({ error: "No fue posible verificar el acceso en este momento." }, { status: 503 })
  }

  let validPassword: boolean
  try {
    validPassword = await bcrypt.compare(parsed.data.password, user?.passwordHash ?? DUMMY_PASSWORD_HASH)
  } catch (error) {
    console.error("Login password verification failed", error)
    return NextResponse.json({ error: "No fue posible verificar el acceso en este momento." }, { status: 500 })
  }

  if (!user || !validPassword) {
    return NextResponse.json({ error: "Usuario o contraseña incorrectos." }, { status: 401 })
  }

  let token: string
  try {
    token = createSessionToken(user.id)
  } catch (error) {
    console.error("Login session signing is not configured", error)
    return NextResponse.json({ error: "El inicio de sesión no está configurado." }, { status: 503 })
  }

  const response = NextResponse.json({
    data: {
      user: { id: user.id, fullName: user.fullName, username: user.username, email: user.email, role: user.role },
    },
  })
  response.cookies.set(sessionCookieName, token, sessionCookieOptions())
  attempts.delete(key)
  return response
}
