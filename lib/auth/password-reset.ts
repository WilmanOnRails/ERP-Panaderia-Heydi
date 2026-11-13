import bcrypt from "bcryptjs"
import { createHash, randomBytes } from "node:crypto"
import { prisma } from "@/lib/prisma"

const TOKEN_TTL_MS = 30 * 60 * 1000

export async function createPasswordResetToken(email: string) {
  const user = await prisma.erpUser.findFirst({
    where: { email: { equals: email, mode: "insensitive" }, status: "approved" },
    select: { id: true, email: true, fullName: true },
  })
  if (!user) return null

  const token = randomBytes(32).toString("base64url")
  const tokenHash = hashToken(token)
  await prisma.passwordResetToken.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    },
    update: {
      tokenHash,
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
      usedAt: null,
      createdAt: new Date(),
    },
  })

  return { token, email: user.email, fullName: user.fullName }
}

export async function invalidatePasswordResetToken(token: string) {
  await prisma.passwordResetToken.deleteMany({ where: { tokenHash: hashToken(token) } })
}

export async function resetPassword(token: string, password: string) {
  const tokenHash = hashToken(token)
  const resetRecord = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    select: { id: true, userId: true, expiresAt: true, usedAt: true, user: { select: { status: true } } },
  })
  if (!isUsableToken(resetRecord)) throw new InvalidResetTokenError()

  const passwordHash = await bcrypt.hash(password, 12)
  const now = new Date()
  await prisma.$transaction(async (transaction) => {
    const consumed = await transaction.passwordResetToken.updateMany({
      where: { id: resetRecord.id, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    })
    if (consumed.count !== 1) throw new InvalidResetTokenError()

    const updatedUser = await transaction.erpUser.updateMany({
      where: { id: resetRecord.userId, status: "approved" },
      data: { passwordHash },
    })
    if (updatedUser.count !== 1) throw new InvalidResetTokenError()
  })
}

export class InvalidResetTokenError extends Error {
  constructor() {
    super("El enlace de recuperación no es válido o ya venció.")
  }
}

function isUsableToken(
  token: { id: number; userId: number; expiresAt: Date; usedAt: Date | null; user: { status: string } } | null,
): token is { id: number; userId: number; expiresAt: Date; usedAt: Date | null; user: { status: string } } {
  return token !== null
    && token.usedAt === null
    && token.expiresAt.getTime() > Date.now()
    && token.user.status === "approved"
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex")
}
