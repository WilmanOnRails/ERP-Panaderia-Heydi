import { NextResponse } from "next/server"
import { sql } from "drizzle-orm"
import { authorizeApiRequest } from "@/lib/api/auth"
import { apiError, handleApiError, readJsonBody } from "@/lib/api/http"
import { apiResources } from "@/lib/api/resources"
import { createUser, deleteUser, getUser, listUsers, updateUser } from "@/lib/api/users"
import { getAuthenticatedUser } from "@/lib/auth/session"
import { db } from "@/lib/db"
import { inventoryMovements, products, productionOrders } from "@/lib/db/schema"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ resource: string; id?: string[] }>
}

async function dispatch(request: Request, context: RouteContext, method: "GET" | "POST" | "PATCH" | "DELETE") {
  const { resource: resourceName, id: idParts = [] } = await context.params
  if (idParts.length > 1) return apiError(404, "not_found", "El endpoint solicitado no existe.")

  if (resourceName === "users") {
    let user
    try {
      user = await getAuthenticatedUser()
    } catch (error) {
      return handleApiError(error)
    }
    if (!user) return apiError(401, "unauthorized", "Inicia sesión para administrar usuarios.")
    if (user.role !== "administrador") {
      return apiError(403, "forbidden", "Solo un administrador puede administrar usuarios.")
    }

    const id = idParts.length === 0 ? undefined : parseId(idParts[0])
    if (idParts.length > 0 && id === undefined) {
      return apiError(400, "invalid_id", "El identificador debe ser un entero positivo.")
    }

    if (method === "GET") {
      try {
        if (id !== undefined) {
          const record = await getUser(id)
          return record ? NextResponse.json({ data: record }) : apiError(404, "not_found", "No se encontró el usuario.")
        }

        const url = new URL(request.url)
        const page = parsePositiveQuery(url.searchParams.get("page"), 1)
        const limit = parsePositiveQuery(url.searchParams.get("limit"), 50)
        if (page === undefined || limit === undefined || limit > 100 || !Number.isSafeInteger((page - 1) * limit)) {
          return apiError(400, "invalid_pagination", "page y limit deben ser enteros positivos; limit no puede superar 100.")
        }
        const records = await listUsers(limit + 1, (page - 1) * limit)
        const hasMore = records.length > limit
        return NextResponse.json({
          data: hasMore ? records.slice(0, limit) : records,
          pagination: { page, limit, hasMore },
        })
      } catch (error) {
        return handleApiError(error)
      }
    }

    if (method === "POST") {
      if (id !== undefined) return methodNotAllowed(["GET", "PATCH", "DELETE"])
      try {
        const record = await createUser(await readJsonBody(request))
        return NextResponse.json({ data: record }, { status: 201 })
      } catch (error) {
        return handleApiError(error)
      }
    }

    if (id === undefined) return methodNotAllowed(["GET", "POST"])
    if (method === "PATCH") {
      try {
        const record = await updateUser(id, await readJsonBody(request), user.id)
        return record ? NextResponse.json({ data: record }) : apiError(404, "not_found", "No se encontró el usuario.")
      } catch (error) {
        return handleApiError(error)
      }
    }

    try {
      const deleted = await deleteUser(id, user.id)
      return deleted ? new NextResponse(null, { status: 204 }) : apiError(404, "not_found", "No se encontró el usuario.")
    } catch (error) {
      return handleApiError(error)
    }
  }

  const authorizationError = authorizeApiRequest(request)
  if (authorizationError) return authorizationError

  if (resourceName === "dashboard") {
    if (method !== "GET" || idParts.length > 0) {
      return methodNotAllowed(["GET"])
    }

    try {
      const [productCount, movementCount, orderCount] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(products),
        db.select({ count: sql<number>`count(*)` }).from(inventoryMovements),
        db.select({ count: sql<number>`count(*)` }).from(productionOrders),
      ])
      return NextResponse.json({
        data: {
          products: Number(productCount[0]?.count ?? 0),
          movements: Number(movementCount[0]?.count ?? 0),
          orders: Number(orderCount[0]?.count ?? 0),
        },
      })
    } catch (error) {
      return handleApiError(error)
    }
  }

  const resource = Object.hasOwn(apiResources, resourceName) ? apiResources[resourceName] : undefined
  if (!resource) return apiError(404, "not_found", "El recurso solicitado no existe.")

  const id = idParts.length === 0 ? undefined : parseId(idParts[0])
  if (idParts.length > 0 && id === undefined) {
    return apiError(400, "invalid_id", "El identificador debe ser un entero positivo.")
  }

  if (method === "GET") {
    try {
      if (id !== undefined) {
        const record = await resource.get(id)
        return record ? NextResponse.json({ data: record }) : apiError(404, "not_found", "No se encontró el registro.")
      }

      const url = new URL(request.url)
      const page = parsePositiveQuery(url.searchParams.get("page"), 1)
      const limit = parsePositiveQuery(url.searchParams.get("limit"), 50)
      if (page === undefined || limit === undefined || limit > 100 || !Number.isSafeInteger((page - 1) * limit)) {
        return apiError(400, "invalid_pagination", "page y limit deben ser enteros positivos; limit no puede superar 100.")
      }
      const records = await resource.list(limit + 1, (page - 1) * limit)
      const hasMore = records.length > limit
      return NextResponse.json({
        data: hasMore ? records.slice(0, limit) : records,
        pagination: { page, limit, hasMore },
      })
    } catch (error) {
      return handleApiError(error)
    }
  }

  if (method === "POST") {
    if (id !== undefined) return methodNotAllowed(itemMethods(resource))
    try {
      const body = await readJsonBody(request)
      const record = await resource.create(body)
      return NextResponse.json({ data: record }, { status: 201 })
    } catch (error) {
      return handleApiError(error)
    }
  }

  if (method === "PATCH") {
    if (id === undefined) return methodNotAllowed(["GET", "POST"])
    if (!resource.allowUpdate) return methodNotAllowed(["GET"])
    try {
      const body = await readJsonBody(request)
      const record = await resource.update(id, body)
      return record ? NextResponse.json({ data: record }) : apiError(404, "not_found", "No se encontró el registro.")
    } catch (error) {
      return handleApiError(error)
    }
  }

  if (id === undefined) return methodNotAllowed(["GET", "POST"])
  if (!resource.allowDelete) return methodNotAllowed(["GET"])
  try {
    const deleted = await resource.delete(id)
    return deleted ? new NextResponse(null, { status: 204 }) : apiError(404, "not_found", "No se encontró el registro.")
  } catch (error) {
    return handleApiError(error)
  }
}

function parseId(value: string) {
  const id = Number(value)
  return Number.isSafeInteger(id) && id > 0 ? id : undefined
}

function parsePositiveQuery(value: string | null, fallback: number) {
  if (value === null) return fallback
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined
}

function methodNotAllowed(methods: string[]) {
  return NextResponse.json(
    { error: { code: "method_not_allowed", message: "El método HTTP no está permitido para este endpoint." } },
    { status: 405, headers: { Allow: methods.join(", ") } },
  )
}

function itemMethods(resource: (typeof apiResources)[string]) {
  return [
    "GET",
    ...(resource.allowUpdate ? ["PATCH"] : []),
    ...(resource.allowDelete ? ["DELETE"] : []),
  ]
}

export const GET = (request: Request, context: RouteContext) => dispatch(request, context, "GET")
export const POST = (request: Request, context: RouteContext) => dispatch(request, context, "POST")
export const PATCH = (request: Request, context: RouteContext) => dispatch(request, context, "PATCH")
export const DELETE = (request: Request, context: RouteContext) => dispatch(request, context, "DELETE")
