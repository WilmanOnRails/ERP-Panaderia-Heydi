import bcrypt from "bcryptjs"
import { z } from "zod"
import { UserManagementError } from "@/lib/api/errors"
import { prisma } from "@/lib/prisma"

const emailSchema = z.email().max(254).transform((value) => value.toLowerCase())
const usernameSchema = z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{3,32}$/)
const passwordSchema = z.string().min(12).refine(
  (value) => Buffer.byteLength(value, "utf8") <= 72,
  "La contraseña no puede superar 72 bytes.",
)

const createUserSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  username: usernameSchema,
  code: z.string().trim().min(1).max(64),
  phone: z.string().trim().max(40).optional(),
  email: emailSchema,
  role: z.enum(["administrador", "usuario"]).default("usuario"),
  password: passwordSchema,
}).strict()

const updateUserSchema = z.object({
  fullName: z.string().trim().min(2).max(100).optional(),
  username: usernameSchema.optional(),
  code: z.string().trim().min(1).max(64).optional(),
  phone: z.string().trim().max(40).optional(),
  email: emailSchema.optional(),
  role: z.enum(["administrador", "usuario"]).optional(),
  password: passwordSchema.optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "Envía al menos un campo.")

const safeUserSelect = {
  id: true,
  fullName: true,
  username: true,
  code: true,
  phone: true,
  email: true,
  role: true,
  createdAt: true,
} as const

export async function listUsers(limit: number, offset: number) {
  return prisma.erpUser.findMany({
    select: safeUserSelect,
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
  })
}

export async function getUser(id: number) {
  return prisma.erpUser.findUnique({ where: { id }, select: safeUserSelect })
}

export async function createUser(input: unknown) {
  const data = createUserSchema.parse(input)
  const passwordHash = await bcrypt.hash(data.password, 12)
  return prisma.$transaction(async (transaction) => {
    await assertUniqueUserFields(transaction, data)
    return transaction.erpUser.create({
      data: {
        fullName: data.fullName,
        username: data.username,
        code: data.code,
        phone: data.phone ?? "",
        email: data.email,
        role: data.role,
        passwordHash,
      },
      select: safeUserSelect,
    })
  }, { isolationLevel: "Serializable" })
}

export async function updateUser(id: number, input: unknown, actorId: number) {
  const data = updateUserSchema.parse(input)
  if (id === actorId && data.role === "usuario") {
    throw new UserManagementError(400, "self_role_change", "No puedes quitarte el rol de administrador.")
  }

  return prisma.$transaction(async (transaction) => {
    const current = await transaction.erpUser.findUnique({
      where: { id },
      select: { id: true, role: true },
    })
    if (!current) return null
    await assertUniqueUserFields(transaction, data, id)

    if (current.role === "administrador" && data.role === "usuario") {
      const adminCount = await transaction.erpUser.count({ where: { role: "administrador" } })
      if (adminCount <= 1) {
        throw new UserManagementError(409, "last_admin", "No se puede degradar al único administrador.")
      }
    }

    const { password, ...userData } = data
    return transaction.erpUser.update({
      where: { id },
      data: {
        ...userData,
        ...(password ? { passwordHash: await bcrypt.hash(password, 12) } : {}),
      },
      select: safeUserSelect,
    })
  }, { isolationLevel: "Serializable" })
}

  async function assertUniqueUserFields(
    transaction: Pick<typeof prisma, "erpUser">,
    data: { username?: string; email?: string; code?: string },
    excludeId?: number,
  ) {
    if (!data.username && !data.email && !data.code) return

    const duplicate = await transaction.erpUser.findFirst({
      where: {
        ...(excludeId === undefined ? {} : { id: { not: excludeId } }),
        OR: [
          ...(data.username ? [{ username: { equals: data.username, mode: "insensitive" as const } }] : []),
          ...(data.email ? [{ email: { equals: data.email, mode: "insensitive" as const } }] : []),
          ...(data.code ? [{ code: data.code }] : []),
        ],
      },
      select: { id: true },
    })
    if (duplicate) {
      throw new UserManagementError(409, "conflict", "El usuario, correo o código ya está registrado.")
    }
  }

export async function deleteUser(id: number, actorId: number) {
  if (id === actorId) {
    throw new UserManagementError(400, "self_delete", "No puedes eliminar tu propia cuenta.")
  }

  return prisma.$transaction(async (transaction) => {
    const current = await transaction.erpUser.findUnique({
      where: { id },
      select: { id: true, role: true },
    })
    if (!current) return false

    if (current.role === "administrador") {
      const adminCount = await transaction.erpUser.count({ where: { role: "administrador" } })
      if (adminCount <= 1) {
        throw new UserManagementError(409, "last_admin", "No se puede eliminar al único administrador.")
      }
    }

    await transaction.erpUser.delete({ where: { id } })
    return true
  }, { isolationLevel: "Serializable" })
}
