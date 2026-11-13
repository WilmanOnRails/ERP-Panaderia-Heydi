import { Resend } from "resend"

const RESET_TOKEN_TTL_MINUTES = 30

export function createResetMailer() {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM
  const appUrl = process.env.APP_URL

  if (!apiKey || !from || !appUrl) {
    throw new Error("RESEND_API_KEY, RESEND_FROM y APP_URL deben estar configurados.")
  }

  let baseUrl: URL
  try {
    baseUrl = new URL(appUrl)
  } catch {
    throw new Error("APP_URL debe ser una URL válida.")
  }
  if (!["http:", "https:"].includes(baseUrl.protocol)
    || (process.env.NODE_ENV === "production" && baseUrl.protocol !== "https:")
    || baseUrl.username
    || baseUrl.password) {
    throw new Error("APP_URL debe usar HTTP o HTTPS y no puede contener credenciales.")
  }

  return {
    resend: new Resend(apiKey),
    from,
    appUrl: baseUrl.origin,
  }
}

export async function sendPasswordResetEmail(input: {
  to: string
  fullName: string
  token: string
  appUrl: string
  from: string
  resend: Resend
}) {
  const resetUrl = new URL("/reset-password", input.appUrl)
  resetUrl.searchParams.set("token", input.token)
  const safeName = escapeHtml(input.fullName)
  const expiry = `${RESET_TOKEN_TTL_MINUTES} minutos`

  const { error } = await input.resend.emails.send({
    from: input.from,
    to: input.to,
    subject: "Recuperación de contraseña - Repostería Heydi",
    text: `Hola ${input.fullName},\n\nRecibimos una solicitud para cambiar la contraseña de tu cuenta. Abre este enlace dentro de ${expiry}:\n${resetUrl.toString()}\n\nSi no solicitaste este cambio, puedes ignorar este mensaje.`,
    html: `<p>Hola ${safeName},</p><p>Recibimos una solicitud para cambiar la contraseña de tu cuenta.</p><p><a href="${escapeHtml(resetUrl.toString())}">Crear una contraseña nueva</a></p><p>Este enlace vence en ${expiry} y solo se puede usar una vez.</p><p>Si no solicitaste este cambio, puedes ignorar este mensaje.</p>`,
  })
  if (error) throw new Error(`Resend no pudo enviar el correo: ${error.message}`)
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]!)
}
