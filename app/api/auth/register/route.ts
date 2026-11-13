import { NextResponse } from "next/server"
import { ZodError } from "zod"
import { apiError, handleApiError, readJsonBody } from "@/lib/api/http"
import { registerUser } from "@/lib/api/users"

export const runtime = "nodejs"

const MAX_ATTEMPTS = 5
const WINDOW_MS = 60 * 60 * 1000
const attempts = new Map<string, { count: number; resetAt: number }>()

function isRateLimited(request: Request) {
  const key = request.headers.get("x-real-ip")?.trim()
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "unknown"
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
    return false
  }
  if (current.count >= MAX_ATTEMPTS) return true
  current.count += 1
  return false
}

export async function POST(request: Request) {
  if (isRateLimited(request)) {
    return apiError(429, "too_many_requests", "Se alcanzó el límite de registros. Inténtalo más tarde.")
  }

  try {
    const user = await registerUser(await readJsonBody(request))
    return NextResponse.json({
      data: { id: user.id, status: user.status },
      message: "Solicitud recibida. Un administrador debe aprobar tu cuenta antes de iniciar sesión.",
    }, { status: 201 })
  } catch (error) {
    if (error instanceof ZodError) {
      return apiError(400, "validation_error", "Revisa los datos: usuario válido, correo y contraseña de al menos 12 caracteres.")
    }
    return handleApiError(error)
  }
}
