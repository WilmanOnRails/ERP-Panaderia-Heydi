import { NextResponse } from "next/server"
import { ZodError } from "zod"
import { UserManagementError } from "@/lib/api/errors"

const MAX_BODY_BYTES = 1_000_000

export function apiError(status: number, code: string, message: string, details?: unknown) {
  return NextResponse.json(
    { error: { code, message, ...(details === undefined ? {} : { details }) } },
    { status },
  )
}

export async function readJsonBody(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type") ?? ""
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new RequestBodyError(415, "content_type", "El contenido debe ser JSON.")
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0)
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    throw new RequestBodyError(413, "body_too_large", "El cuerpo de la solicitud supera el límite permitido.")
  }

  try {
    const body = await request.json()
    if (Buffer.byteLength(JSON.stringify(body), "utf8") > MAX_BODY_BYTES) {
      throw new RequestBodyError(413, "body_too_large", "El cuerpo de la solicitud supera el límite permitido.")
    }
    return body
  } catch (error) {
    if (error instanceof RequestBodyError) throw error
    throw new RequestBodyError(400, "invalid_json", "El cuerpo de la solicitud no contiene JSON válido.")
  }
}

export function handleApiError(error: unknown) {
  if (error instanceof UserManagementError) {
    return apiError(error.status, error.code, error.message)
  }

  if (error instanceof RequestBodyError) {
    return apiError(error.status, error.code, error.message)
  }

  if (error instanceof ZodError) {
    const details = error.issues.map(({ code, path, message }) => ({ code, path, message }))
    return apiError(400, "validation_error", "Los datos enviados no son válidos.", details)
  }

  if (hasDatabaseCode(error, "23505")) {
    return apiError(409, "conflict", "Ya existe un registro con uno de los valores únicos enviados.")
  }

  if (hasDatabaseCode(error, "23503")) {
    return apiError(409, "reference_conflict", "El registro está relacionado con otros datos y no se puede eliminar.")
  }

  if (hasPrismaCode(error, "P2002")) {
    return apiError(409, "conflict", "Ya existe un usuario con uno de los valores únicos enviados.")
  }
  if (hasPrismaCode(error, "P2034")) {
    return apiError(409, "concurrent_update", "Hubo un cambio concurrente. Vuelve a intentarlo.")
  }

  console.error("API request failed", error)
  return apiError(500, "internal_error", "Ocurrió un error interno al procesar la solicitud.")
}

export class RequestBodyError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

function hasDatabaseCode(error: unknown, code: string): boolean {
  if (typeof error !== "object" || error === null) return false
  if ("code" in error && error.code === code) return true
  return "cause" in error ? hasDatabaseCode(error.cause, code) : false
}

function hasPrismaCode(error: unknown, code: string): boolean {
  if (typeof error !== "object" || error === null) return false
  if ("code" in error && error.code === code) return true
  return "cause" in error ? hasPrismaCode(error.cause, code) : false
}
