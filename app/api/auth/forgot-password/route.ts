import { createHash } from "node:crypto"
import { NextResponse } from "next/server"
import { z, ZodError } from "zod"
import { createPasswordResetToken, invalidatePasswordResetToken } from "@/lib/auth/password-reset"
import { createResetMailer, sendPasswordResetEmail } from "@/lib/auth/password-reset-email"
import { apiError, handleApiError, readJsonBody } from "@/lib/api/http"

export const runtime = "nodejs"

const emailSchema = z.object({
  email: z.email().max(254).transform((value) => value.toLowerCase()),
}).strict()
const WINDOW_MS = 60 * 60 * 1000
const attempts = new Map<string, { count: number; resetAt: number }>()

function isRateLimited(key: string, maxAttempts: number) {
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
  if (current.count >= maxAttempts) return true
  current.count += 1
  return false
}

export async function POST(request: Request) {
  try {
    const parsed = emailSchema.parse(await readJsonBody(request))
    const ip = request.headers.get("x-real-ip")?.trim()
      || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || "unknown"
    const emailKey = createHash("sha256").update(parsed.email).digest("hex")
    if (isRateLimited(`ip:${ip}`, 5) || isRateLimited(`email:${emailKey}`, 3)) {
      return apiError(429, "too_many_requests", "Se alcanzó el límite de solicitudes. Inténtalo más tarde.")
    }

    let mailer: ReturnType<typeof createResetMailer>
    try {
      mailer = createResetMailer()
    } catch {
      console.error("Password reset mail configuration is invalid")
      return apiError(503, "email_not_configured", "La recuperación por correo no está disponible en este momento.")
    }

    const reset = await createPasswordResetToken(parsed.email)
    if (reset) {
      try {
        await sendPasswordResetEmail({
          to: reset.email,
          fullName: reset.fullName,
          token: reset.token,
          ...mailer,
        })
      } catch (error) {
        try {
          await invalidatePasswordResetToken(reset.token)
        } catch (invalidationError) {
          console.error("Password reset token invalidation failed after mail failure", invalidationError)
        }
        console.error("Password reset email delivery failed", error)
      }
    }

    return NextResponse.json({
      message: "Si existe una cuenta aprobada con ese correo, recibirás instrucciones para recuperar la contraseña.",
    })
  } catch (error) {
    if (error instanceof ZodError) {
      return apiError(400, "validation_error", "Ingresa un correo electrónico válido.")
    }
    return handleApiError(error)
  }
}
