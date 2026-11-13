import { timingSafeEqual } from "node:crypto"
import { NextResponse } from "next/server"

export function authorizeApiRequest(request: Request) {
  const expectedKey = process.env.API_KEY
  if (!expectedKey || expectedKey.length < 32) {
    console.error("API_KEY must be configured with at least 32 characters")
    return NextResponse.json(
      { error: { code: "api_not_configured", message: "La API no está configurada." } },
      { status: 503 },
    )
  }

  const authorization = request.headers.get("authorization") ?? ""
  const suppliedKey = /^Bearer ([^\s]+)$/i.exec(authorization)?.[1] ?? ""
  const expected = Buffer.from(expectedKey)
  const supplied = Buffer.from(suppliedKey)
  const valid = expected.length === supplied.length && timingSafeEqual(expected, supplied)

  if (!valid) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Se requiere una clave API válida." } },
      { status: 401, headers: { "WWW-Authenticate": "Bearer" } },
    )
  }

  return null
}
