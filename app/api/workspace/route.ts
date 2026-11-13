import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { getAuthenticatedUser } from "@/lib/auth/session"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

const workspaceId = 1

export async function GET() {
  try {
    const user = await getAuthenticatedUser()
    if (!user) return NextResponse.json({ error: { code: "unauthorized", message: "Inicia sesión para consultar los datos del ERP." } }, { status: 401 })

    const workspace = await prisma.erpWorkspace.upsert({
      where: { id: workspaceId },
      create: { id: workspaceId },
      update: {},
    })
    return NextResponse.json({ data: workspace.data, version: workspace.version })
  } catch (error) {
    console.error("GET /api/workspace failed", error)
    return NextResponse.json({ error: { code: "internal_error", message: "No se pudieron cargar los datos del ERP." } }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) return NextResponse.json({ error: { code: "unauthorized", message: "Inicia sesión para guardar los datos del ERP." } }, { status: 401 })

    const contentLength = Number(request.headers.get("content-length") ?? 0)
    if (contentLength > 4_000_000) {
      return NextResponse.json({ error: { code: "payload_too_large", message: "El estado del ERP supera el tamaño permitido." } }, { status: 413 })
    }

    const body: unknown = await request.json()
    if (!isWorkspaceUpdate(body)) {
      return NextResponse.json({ error: { code: "invalid_body", message: "Se requiere un estado JSON y una versión entera no negativa." } }, { status: 400 })
    }
    if (JSON.stringify(body.data).length > 4_000_000) {
      return NextResponse.json({ error: { code: "payload_too_large", message: "El estado del ERP supera el tamaño permitido." } }, { status: 413 })
    }

    await prisma.erpWorkspace.upsert({
      where: { id: workspaceId },
      create: { id: workspaceId },
      update: {},
    })
    const updated = await prisma.erpWorkspace.updateMany({
      where: { id: workspaceId, version: body.version },
      data: { data: body.data as Prisma.InputJsonValue, version: { increment: 1 } },
    })
    if (updated.count !== 1) {
      return NextResponse.json({ error: { code: "version_conflict", message: "Los datos cambiaron en otra sesión. Recarga el ERP antes de continuar." } }, { status: 409 })
    }

    return NextResponse.json({ version: body.version + 1 })
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: { code: "invalid_json", message: "El cuerpo de la solicitud debe ser JSON válido." } }, { status: 400 })
    }
    console.error("PUT /api/workspace failed", error)
    return NextResponse.json({ error: { code: "internal_error", message: "No se pudieron guardar los datos del ERP." } }, { status: 500 })
  }
}

function isWorkspaceUpdate(value: unknown): value is { version: number; data: Prisma.InputJsonObject } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  return Number.isSafeInteger(record.version)
    && Number(record.version) >= 0
    && typeof record.data === "object"
    && record.data !== null
    && !Array.isArray(record.data)
}
