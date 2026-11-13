import { sql } from "drizzle-orm"
import { NextResponse } from "next/server"
import { authorizeApiRequest } from "@/lib/api/auth"
import { handleApiError } from "@/lib/api/http"
import { db } from "@/lib/db"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const authorizationError = authorizeApiRequest(request)
  if (authorizationError) return authorizationError

  try {
    await db.execute(sql`select 1`)
    return NextResponse.json({ data: { status: "ok", database: "connected" } })
  } catch (error) {
    return handleApiError(error)
  }
}
