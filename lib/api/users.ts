import bcrypt from "bcryptjs"
import { randomBytes } from "node:crypto"
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

const registerUserSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  username: usernameSchema,
  phone: z.string().trim().max(40).optional(),
  email: emailSchema,
  password: passwordSchema,
}).strict()

const updateUserSchema = z.object({
  fullName: z.string().trim().min(2).max(100).optional(),
  username: usernameSchema.optional(),
  code: z.string().trim().min(1).max(64).optional(),
  phone: z.string().trim().max(40).optional(),
  email: emailSchema.optional(),
  role: z.enum(["administrador", "usuario"]).optional(),
  status: z.enum(["pending", "approved", "rejected"]).optional(),
  password: passwordSchema.optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "Envía al menos un campo.")

const profileSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  username: usernameSchema,
  email: emailSchema,
  phone: z.string().trim().max(40),
  currentPassword: z.string().min(1).refine(
    (value) => Buffer.byteLength(value, "utf8") <= 72,
    "La contraseña actual no es válida.",
  ),
  newPassword: passwordSchema.optional().or(z.literal("")),
}).strict()

const safeUserSelect = {
  id: true,
  fullName: true,
  username: true,
  code: true,
  phone: true,
  email: true,
  role: true,
  status: true,
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

export async function registerUser(input: unknown) {
  const data = registerUserSchema.parse(input)
  const passwordHash = await bcrypt.hash(data.password, 12)
  const code = `REG-${randomBytes(12).toString("hex")}`

  return prisma.$transaction(async (transaction) => {
    await assertUniqueUserFields(transaction, { username: data.username, email: data.email })
    return transaction.erpUser.create({
      data: {
        fullName: data.fullName,
        username: data.username,
        code,
        phone: data.phone ?? "",
        email: data.email,
        role: "usuario",
        status: "pending",
        passwordHash,
      },
      select: safeUserSelect,
    })
  }, { isolationLevel: "Serializable" })
}

export async function updateUser(id: number, input: unknown, actorId: number) {
  const data = updateUserSchema.parse(input)
  if (id === actorId) {
    throw new UserManagementError(403, "self_update_forbidden", "No puedes modificar tu propia cuenta desde el módulo de usuarios.")
  }

  return prisma.$transaction(async (transaction) => {
    const current = await transaction.erpUser.findUnique({
      where: { id },
      select: { id: true, role: true, status: true },
    })
    if (!current) return null
    if (current.role === "administrador") {
      throw new UserManagementError(403, "administrator_protected", "Las cuentas administradoras no se pueden editar.")
    }
    await assertUniqueUserFields(transaction, data, id)

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

export async function updateOwnProfile(userId: number, input: unknown) {
  const data = profileSchema.parse(input)
  return prisma.$transaction(async (transaction) => {
    const user = await transaction.erpUser.findUnique({
      where: { id: userId },
      select: { id: true, role: true, status: true, passwordHash: true },
    })
    if (!user || user.status !== "approved") {
      throw new UserManagementError(401, "unauthorized", "La sesión ya no es válida.")
    }
    if (user.role === "administrador") {
      throw new UserManagementError(403, "forbidden", "Esta opción solo está disponible para usuarios.")
    }
    if (!await bcrypt.compare(data.currentPassword, user.passwordHash)) {
      throw new UserManagementError(400, "invalid_current_password", "La contraseña actual es incorrecta.")
    }

    await assertUniqueUserFields(transaction, {
      username: data.username,
      email: data.email,
    }, userId)

    const updated = await transaction.erpUser.update({
      where: { id: userId },
      data: {
        fullName: data.fullName,
        username: data.username,
        email: data.email,
        phone: data.phone,
        ...(data.newPassword ? { passwordHash: await bcrypt.hash(data.newPassword, 12) } : {}),
      },
      select: safeUserSelect,
    })
    return updated
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
      select: { id: true, role: true, status: true },
    })
    if (!current) return false
    if (current.role === "administrador") {
      throw new UserManagementError(403, "administrator_protected", "Las cuentas administradoras no se pueden eliminar.")
    }

    await transaction.erpUser.delete({ where: { id } })
    return true
  }, { isolationLevel: "Serializable" })
}
