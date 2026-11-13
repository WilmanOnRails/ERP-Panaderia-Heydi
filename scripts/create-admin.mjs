import bcrypt from "bcryptjs"
import { config } from "dotenv"
import { createInterface } from "node:readline/promises"
import { stdin, stdout } from "node:process"
import { PrismaClient } from "@prisma/client"

config({ path: ".env.local" })
config({ path: ".env" })

const prisma = new PrismaClient()

function promptSecret(label) {
  return new Promise((resolve, reject) => {
    if (!stdin.isTTY || !stdout.isTTY) {
      reject(new Error("La contraseña debe ingresarse en una terminal interactiva."))
      return
    }

    stdout.write(`${label}: `)
    stdin.setRawMode(true)
    stdin.resume()
    stdin.setEncoding("utf8")
    let value = ""

    const cleanup = () => {
      stdin.setRawMode(false)
      stdin.pause()
      stdin.removeListener("data", onData)
      stdout.write("\n")
    }

    const onData = (chunk) => {
      for (const character of chunk) {
        if (character === "\u0003") {
          cleanup()
          reject(new Error("Operación cancelada."))
          return
        }
        if (character === "\r" || character === "\n") {
          cleanup()
          resolve(value)
          return
        }
        if (character === "\u007f" || character === "\b") {
          value = value.slice(0, -1)
          continue
        }
        if (character >= " ") {
          value += character
        }
      }
    }

    stdin.on("data", onData)
  })
}

async function main() {
  const prompt = createInterface({ input: stdin, output: stdout })
  try {
    const fullName = (await prompt.question("Nombre completo: ")).trim()
    const username = (await prompt.question("Usuario (3-32 caracteres): ")).trim().toLowerCase()
    const code = (await prompt.question("Código de usuario: ")).trim()
    const email = (await prompt.question("Correo electrónico: ")).trim().toLowerCase()
    prompt.close()

    if (fullName.length < 2 || fullName.length > 100) throw new Error("El nombre debe tener entre 2 y 100 caracteres.")
    if (!/^[a-z0-9._-]{3,32}$/.test(username)) throw new Error("El usuario debe tener entre 3 y 32 caracteres: letras, números, punto, guion o guion bajo.")
    if (!code || code.length > 64) throw new Error("El código de usuario es obligatorio y no puede superar 64 caracteres.")
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error("Ingresa un correo electrónico válido.")

    const password = await promptSecret("Contraseña (mínimo 12 caracteres; no se mostrará)")
    if (password.length < 12 || Buffer.byteLength(password, "utf8") > 72) {
      throw new Error("La contraseña debe tener entre 12 caracteres y 72 bytes.")
    }

    const existing = await prisma.erpUser.findFirst({
      where: { OR: [{ username }, { code }, { email }] },
      select: { id: true },
    })
    if (existing) throw new Error("Ya existe un usuario con ese nombre, código o correo. No se modificó ningún usuario.")

    const passwordHash = await bcrypt.hash(password, 12)
    await prisma.erpUser.create({
      data: { fullName, username, code, email, role: "administrador", passwordHash },
    })
    console.log(`Administrador "${username}" creado correctamente. Guarda la contraseña en un gestor seguro.`)
  } finally {
    prompt.close()
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "No se pudo crear el administrador.")
  process.exitCode = 1
})
