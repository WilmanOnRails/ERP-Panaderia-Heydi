import { NextResponse } from "next/server"
import { z, ZodError } from "zod"
import { apiError, handleApiError, readJsonBody } from "@/lib/api/http"
import { InvalidResetTokenError, resetPassword } from "@/lib/auth/password-reset"

export const runtime = "nodejs"

const passwordSchema = z.string().min(12).refine(
  (value) => Buffer.byteLength(value, "utf8") <= 72,
  "La contraseña no puede superar 72 bytes.",
)
const resetSchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  password: passwordSchema,
  confirmPassword: z.string(),
}).strict().refine((value) => value.password === value.confirmPassword, {
  path: ["confirmPassword"],
  message: "Las contraseñas no coinciden.",
})

export async function POST(request: Request) {
  try {
    const data = resetSchema.parse(await readJsonBody(request))
    await resetPassword(data.token, data.password)
    return NextResponse.json({ message: "Tu contraseña se actualizó. Ya puedes iniciar sesión." })
  } catch (error) {
    if (error instanceof ZodError) {
      return apiError(400, "validation_error", "Revisa los datos: la contraseña debe tener al menos 12 caracteres y ambas deben coincidir.")
    }
    if (error instanceof InvalidResetTokenError) {
      return apiError(400, "invalid_reset_token", error.message)
    }
    return handleApiError(error)
  }
}
