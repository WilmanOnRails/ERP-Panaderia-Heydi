import { NextResponse } from "next/server"
import { handleApiError, readJsonBody } from "@/lib/api/http"
import { updateOwnProfile } from "@/lib/api/users"
import { getAuthenticatedUser } from "@/lib/auth/session"

export const runtime = "nodejs"

export async function PATCH(request: Request) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) {
      return NextResponse.json({ error: { code: "unauthorized", message: "Inicia sesión para actualizar tu cuenta." } }, { status: 401 })
    }

    const profile = await updateOwnProfile(user.id, await readJsonBody(request))
    return NextResponse.json({ data: profile })
  } catch (error) {
    return handleApiError(error)
  }
}
