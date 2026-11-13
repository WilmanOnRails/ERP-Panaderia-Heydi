import { desc, eq } from "drizzle-orm"
import { z } from "zod"
import { db } from "@/lib/db"
import {
  customers,
  inventoryMovements,
  products,
  productionOrders,
  rawMaterials,
  recipes,
  routes,
  suppliers,
  warehouses,
} from "@/lib/db/schema"

type ApiResource = {
  allowUpdate: boolean
  allowDelete: boolean
  list(limit: number, offset: number): Promise<unknown[]>
  get(id: number): Promise<unknown | undefined>
  create(input: unknown): Promise<unknown>
  update(id: number, input: unknown): Promise<unknown | undefined>
  delete(id: number): Promise<boolean>
}

function defineResource(
  operations: Omit<ApiResource, "allowUpdate" | "allowDelete">,
  options: { allowUpdate?: boolean; allowDelete?: boolean } = {},
): ApiResource {
  return {
    allowUpdate: options.allowUpdate ?? true,
    allowDelete: options.allowDelete ?? true,
    ...operations,
  }
}

const text = z.string().trim().min(1)
const optionalText = z.string().trim().optional()
const nonNegative = z.number().finite().nonnegative().transform(String)
const positiveDecimal = z.number().finite().positive().transform(String)
const positiveInt = z.number().int().positive()
const nonNegativeInt = z.number().int().nonnegative()
const email = z.email().or(z.literal(""))
const nonEmptyUpdate = <T extends z.ZodRawShape>(shape: T) =>
  z.object(shape).partial().strict().refine((value) => Object.keys(value).length > 0, "Envía al menos un campo.")

const productCreate = z.object({
  code: text,
  name: text,
  breadType: text,
  units: positiveInt,
  price: nonNegative,
  active: z.boolean().optional(),
}).strict()
const productUpdate = nonEmptyUpdate({
  code: text,
  name: text,
  breadType: text,
  units: positiveInt,
  price: nonNegative,
  active: z.boolean(),
})

const rawMaterialCreate = z.object({
  code: text,
  name: text,
  stock: nonNegative,
  availableUnits: nonNegative,
  active: z.boolean().optional(),
}).strict()
const rawMaterialUpdate = nonEmptyUpdate({
  code: text,
  name: text,
  stock: nonNegative,
  availableUnits: nonNegative,
  active: z.boolean(),
})

const recipeCreate = z.object({
  code: text,
  name: text,
  bomUnits: nonNegative,
  description: z.string().trim().optional(),
}).strict()
const recipeUpdate = nonEmptyUpdate({
  code: text,
  name: text,
  bomUnits: nonNegative,
  description: z.string().trim(),
})

const routeCreate = z.object({
  code: text,
  name: text,
  operations: text,
  durationMinutes: nonNegativeInt,
  active: z.boolean().optional(),
}).strict()
const routeUpdate = nonEmptyUpdate({
  code: text,
  name: text,
  operations: text,
  durationMinutes: nonNegativeInt,
  active: z.boolean(),
})

const warehouseCreate = z.object({
  code: text,
  name: text,
  warehouseType: text,
  location: optionalText,
  active: z.boolean().optional(),
}).strict()
const warehouseUpdate = nonEmptyUpdate({
  code: text,
  name: text,
  warehouseType: text,
  location: z.string().trim(),
  active: z.boolean(),
})

const supplierCreate = z.object({
  name: text,
  lastName: optionalText,
  identityNumber: optionalText,
  phone: optionalText,
  email: email.optional(),
}).strict()
const supplierUpdate = nonEmptyUpdate({
  name: text,
  lastName: z.string().trim(),
  identityNumber: z.string().trim(),
  phone: z.string().trim(),
  email,
})

const customerCreate = z.object({
  code: text,
  name: text,
  phone: optionalText,
  address: optionalText,
  email: email.optional(),
}).strict()
const customerUpdate = nonEmptyUpdate({
  code: text,
  name: text,
  phone: z.string().trim(),
  address: z.string().trim(),
  email,
})

const movementCreate = z.object({
  movementType: text,
  productId: positiveInt.optional(),
  rawMaterialId: positiveInt.optional(),
  quantity: positiveDecimal,
  reference: optionalText,
}).strict().refine(
  (value) => Number(value.productId !== undefined) + Number(value.rawMaterialId !== undefined) === 1,
  "Indica exactamente uno de productId o rawMaterialId.",
)

const orderCreate = z.object({
  orderNumber: text,
  productId: positiveInt,
  plannedUnits: positiveInt,
}).strict()
const orderUpdate = z.object({
  status: z.enum(["Pendiente", "En proceso", "Finalizada", "Cancelada"]),
}).strict()

async function assertProductExists(productId: number) {
  const product = await db.select({ id: products.id }).from(products).where(eq(products.id, productId)).limit(1)
  if (product.length === 0) throw new z.ZodError([{ code: "custom", path: ["productId"], message: "El producto no existe." }])
}

async function assertMovementTargetExists(input: z.infer<typeof movementCreate>) {
  if (input.productId !== undefined) {
    await assertProductExists(input.productId)
    return
  }

  if (input.rawMaterialId === undefined) {
    throw new z.ZodError([{ code: "custom", path: ["rawMaterialId"], message: "Indica un producto o una materia prima." }])
  }

  const material = await db.select({ id: rawMaterials.id }).from(rawMaterials)
    .where(eq(rawMaterials.id, input.rawMaterialId)).limit(1)
  if (material.length === 0) {
    throw new z.ZodError([{ code: "custom", path: ["rawMaterialId"], message: "La materia prima no existe." }])
  }
}

export const apiResources: Record<string, ApiResource> = {
  products: defineResource({
    list: async (limit, offset) => db.select().from(products).orderBy(desc(products.createdAt)).limit(limit).offset(offset),
    get: async (id) => (await db.select().from(products).where(eq(products.id, id)).limit(1))[0],
    create: async (input) => (await db.insert(products).values(productCreate.parse(input)).returning())[0],
    update: async (id, input) => (await db.update(products).set({ ...productUpdate.parse(input), updatedAt: new Date() }).where(eq(products.id, id)).returning())[0],
    delete: async (id) => (await db.delete(products).where(eq(products.id, id)).returning({ id: products.id })).length > 0,
  }),
  "raw-materials": defineResource({
    list: async (limit, offset) => db.select().from(rawMaterials).orderBy(desc(rawMaterials.createdAt)).limit(limit).offset(offset),
    get: async (id) => (await db.select().from(rawMaterials).where(eq(rawMaterials.id, id)).limit(1))[0],
    create: async (input) => (await db.insert(rawMaterials).values(rawMaterialCreate.parse(input)).returning())[0],
    update: async (id, input) => (await db.update(rawMaterials).set(rawMaterialUpdate.parse(input)).where(eq(rawMaterials.id, id)).returning())[0],
    delete: async (id) => (await db.delete(rawMaterials).where(eq(rawMaterials.id, id)).returning({ id: rawMaterials.id })).length > 0,
  }),
  recipes: defineResource({
    list: async (limit, offset) => db.select().from(recipes).orderBy(desc(recipes.createdAt)).limit(limit).offset(offset),
    get: async (id) => (await db.select().from(recipes).where(eq(recipes.id, id)).limit(1))[0],
    create: async (input) => (await db.insert(recipes).values(recipeCreate.parse(input)).returning())[0],
    update: async (id, input) => (await db.update(recipes).set(recipeUpdate.parse(input)).where(eq(recipes.id, id)).returning())[0],
    delete: async (id) => (await db.delete(recipes).where(eq(recipes.id, id)).returning({ id: recipes.id })).length > 0,
  }),
  routes: defineResource({
    list: async (limit, offset) => db.select().from(routes).orderBy(desc(routes.createdAt)).limit(limit).offset(offset),
    get: async (id) => (await db.select().from(routes).where(eq(routes.id, id)).limit(1))[0],
    create: async (input) => (await db.insert(routes).values(routeCreate.parse(input)).returning())[0],
    update: async (id, input) => (await db.update(routes).set(routeUpdate.parse(input)).where(eq(routes.id, id)).returning())[0],
    delete: async (id) => (await db.delete(routes).where(eq(routes.id, id)).returning({ id: routes.id })).length > 0,
  }),
  warehouses: defineResource({
    list: async (limit, offset) => db.select().from(warehouses).orderBy(desc(warehouses.createdAt)).limit(limit).offset(offset),
    get: async (id) => (await db.select().from(warehouses).where(eq(warehouses.id, id)).limit(1))[0],
    create: async (input) => (await db.insert(warehouses).values(warehouseCreate.parse(input)).returning())[0],
    update: async (id, input) => (await db.update(warehouses).set(warehouseUpdate.parse(input)).where(eq(warehouses.id, id)).returning())[0],
    delete: async (id) => (await db.delete(warehouses).where(eq(warehouses.id, id)).returning({ id: warehouses.id })).length > 0,
  }),
  suppliers: defineResource({
    list: async (limit, offset) => db.select().from(suppliers).orderBy(desc(suppliers.createdAt)).limit(limit).offset(offset),
    get: async (id) => (await db.select().from(suppliers).where(eq(suppliers.id, id)).limit(1))[0],
    create: async (input) => (await db.insert(suppliers).values(supplierCreate.parse(input)).returning())[0],
    update: async (id, input) => (await db.update(suppliers).set(supplierUpdate.parse(input)).where(eq(suppliers.id, id)).returning())[0],
    delete: async (id) => (await db.delete(suppliers).where(eq(suppliers.id, id)).returning({ id: suppliers.id })).length > 0,
  }),
  customers: defineResource({
    list: async (limit, offset) => db.select().from(customers).orderBy(desc(customers.createdAt)).limit(limit).offset(offset),
    get: async (id) => (await db.select().from(customers).where(eq(customers.id, id)).limit(1))[0],
    create: async (input) => (await db.insert(customers).values(customerCreate.parse(input)).returning())[0],
    update: async (id, input) => (await db.update(customers).set(customerUpdate.parse(input)).where(eq(customers.id, id)).returning())[0],
    delete: async (id) => (await db.delete(customers).where(eq(customers.id, id)).returning({ id: customers.id })).length > 0,
  }),
  "inventory-movements": defineResource({
    list: async (limit, offset) => db.select().from(inventoryMovements).orderBy(desc(inventoryMovements.createdAt)).limit(limit).offset(offset),
    get: async (id) => (await db.select().from(inventoryMovements).where(eq(inventoryMovements.id, id)).limit(1))[0],
    create: async (input) => {
      const data = movementCreate.parse(input)
      await assertMovementTargetExists(data)
      return (await db.insert(inventoryMovements).values(data).returning())[0]
    },
    update: async () => undefined,
    delete: async () => false,
  }, {
    allowUpdate: false,
    allowDelete: false,
  }),
  "production-orders": defineResource({
    list: async (limit, offset) => db.select().from(productionOrders).orderBy(desc(productionOrders.createdAt)).limit(limit).offset(offset),
    get: async (id) => (await db.select().from(productionOrders).where(eq(productionOrders.id, id)).limit(1))[0],
    create: async (input) => {
      const data = orderCreate.parse(input)
      await assertProductExists(data.productId)
      return (await db.insert(productionOrders).values(data).returning())[0]
    },
    update: async (id, input) => (await db.update(productionOrders).set(orderUpdate.parse(input)).where(eq(productionOrders.id, id)).returning())[0],
    delete: async () => false,
  }, {
    allowDelete: false,
  }),
}
