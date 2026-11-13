'use server'

import { desc, eq, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { requireAuthenticatedUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
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
} from '@/lib/db/schema'

const required = (value: unknown, label: string) => {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} es obligatorio`)
  return value.trim()
}

const numberValue = (value: unknown, label: string) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`${label} debe ser un número válido`)
  return String(parsed)
}

export async function listProducts() {
  await requireAuthenticatedUser()
  return db.select().from(products).orderBy(desc(products.createdAt))
}

export async function createProduct(input: { name: string; code: string; breadType: string; units: number; price: number }) {
  await requireAuthenticatedUser()
  const row = {
    name: required(input.name, 'Nombre'),
    code: required(input.code, 'Código'),
    breadType: required(input.breadType, 'Tipo de pan'),
    units: Math.max(1, Math.floor(Number(input.units))),
    price: numberValue(input.price, 'Precio'),
  }
  const result = await db.insert(products).values(row).returning()
  revalidatePath('/')
  return result[0]
}

export async function updateProduct(id: number, input: Partial<{ name: string; code: string; breadType: string; units: number; price: number }>) {
  await requireAuthenticatedUser()
  const result = await db.update(products).set({
    ...(input.name !== undefined && { name: required(input.name, 'Nombre') }),
    ...(input.code !== undefined && { code: required(input.code, 'Código') }),
    ...(input.breadType !== undefined && { breadType: required(input.breadType, 'Tipo de pan') }),
    ...(input.units !== undefined && { units: Math.max(1, Math.floor(Number(input.units))) }),
    ...(input.price !== undefined && { price: numberValue(input.price, 'Precio') }),
    updatedAt: new Date(),
  }).where(eq(products.id, id)).returning()
  revalidatePath('/')
  return result[0]
}

export async function deleteProduct(id: number) {
  await requireAuthenticatedUser()
  await db.delete(products).where(eq(products.id, id))
  revalidatePath('/')
}

export async function listInventoryMovements() {
  await requireAuthenticatedUser()
  return db.select().from(inventoryMovements).orderBy(desc(inventoryMovements.createdAt))
}

export async function createInventoryMovement(input: { movementType: string; productId?: number; rawMaterialId?: number; quantity: number; reference?: string }) {
  await requireAuthenticatedUser()
  const quantity = Number(input.quantity)
  if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('La cantidad debe ser mayor que cero')
  const result = await db.insert(inventoryMovements).values({
    movementType: required(input.movementType, 'Tipo'),
    productId: input.productId,
    rawMaterialId: input.rawMaterialId,
    quantity: String(quantity),
    reference: input.reference?.trim() ?? '',
  }).returning()
  revalidatePath('/')
  return result[0]
}

export async function listProductionOrders() {
  await requireAuthenticatedUser()
  return db.select().from(productionOrders).orderBy(desc(productionOrders.createdAt))
}

export async function createProductionOrder(input: { orderNumber: string; productId: number; plannedUnits: number }) {
  await requireAuthenticatedUser()
  const result = await db.insert(productionOrders).values({
    orderNumber: required(input.orderNumber, 'Número de orden'),
    productId: input.productId,
    plannedUnits: Math.max(1, Math.floor(Number(input.plannedUnits))),
  }).returning()
  revalidatePath('/')
  return result[0]
}

export async function updateProductionOrderStatus(id: number, status: 'Pendiente' | 'En proceso' | 'Finalizada' | 'Cancelada') {
  await requireAuthenticatedUser()
  const result = await db.update(productionOrders).set({ status }).where(eq(productionOrders.id, id)).returning()
  revalidatePath('/')
  return result[0]
}

export async function createRawMaterial(input: { name: string; code: string; stock: number; availableUnits: number }) {
  await requireAuthenticatedUser()
  const result = await db.insert(rawMaterials).values({
    name: required(input.name, 'Nombre'),
    code: required(input.code, 'Código'),
    stock: numberValue(input.stock, 'Stock'),
    availableUnits: numberValue(input.availableUnits, 'Unidades disponibles'),
  }).returning()
  revalidatePath('/')
  return result[0]
}

export async function updateRawMaterial(id: number, input: Partial<{ name: string; code: string; stock: number; availableUnits: number }>) {
  await requireAuthenticatedUser()
  const result = await db.update(rawMaterials).set({
    ...(input.name !== undefined && { name: required(input.name, 'Nombre') }),
    ...(input.code !== undefined && { code: required(input.code, 'Código') }),
    ...(input.stock !== undefined && { stock: numberValue(input.stock, 'Stock') }),
    ...(input.availableUnits !== undefined && { availableUnits: numberValue(input.availableUnits, 'Unidades disponibles') }),
  }).where(eq(rawMaterials.id, id)).returning()
  revalidatePath('/')
  return result[0]
}

export async function listRawMaterials() {
  await requireAuthenticatedUser()
  return db.select().from(rawMaterials).orderBy(desc(rawMaterials.createdAt))
}

export async function createRecipe(input: { name: string; code: string; bomUnits: number; description: string }) {
  await requireAuthenticatedUser()
  const result = await db.insert(recipes).values({
    name: required(input.name, 'Nombre'),
    code: required(input.code, 'Código'),
    bomUnits: numberValue(input.bomUnits, 'Unidades BOM'),
    description: input.description?.trim() ?? '',
  }).returning()
  revalidatePath('/')
  return result[0]
}

export async function updateRecipe(id: number, input: Partial<{ name: string; code: string; bomUnits: number; description: string }>) {
  await requireAuthenticatedUser()
  const result = await db.update(recipes).set({
    ...(input.name !== undefined && { name: required(input.name, 'Nombre') }),
    ...(input.code !== undefined && { code: required(input.code, 'Código') }),
    ...(input.bomUnits !== undefined && { bomUnits: numberValue(input.bomUnits, 'Unidades BOM') }),
    ...(input.description !== undefined && { description: input.description.trim() }),
  }).where(eq(recipes.id, id)).returning()
  revalidatePath('/')
  return result[0]
}

export async function listRecipes() {
  await requireAuthenticatedUser()
  return db.select().from(recipes).orderBy(desc(recipes.createdAt))
}

export async function createRoute(input: { name: string; code: string; operations: string; durationMinutes: number }) {
  await requireAuthenticatedUser()
  const result = await db.insert(routes).values({
    name: required(input.name, 'Nombre'),
    code: required(input.code, 'Código'),
    operations: required(input.operations, 'Operaciones'),
    durationMinutes: Math.max(0, Math.floor(Number(input.durationMinutes))),
  }).returning()
  revalidatePath('/')
  return result[0]
}

export async function updateRoute(id: number, input: Partial<{ name: string; code: string; operations: string; durationMinutes: number }>) {
  await requireAuthenticatedUser()
  const result = await db.update(routes).set({
    ...(input.name !== undefined && { name: required(input.name, 'Nombre') }),
    ...(input.code !== undefined && { code: required(input.code, 'Código') }),
    ...(input.operations !== undefined && { operations: required(input.operations, 'Operaciones') }),
    ...(input.durationMinutes !== undefined && { durationMinutes: Math.max(0, Math.floor(Number(input.durationMinutes))) }),
  }).where(eq(routes.id, id)).returning()
  revalidatePath('/')
  return result[0]
}

export async function listRoutes() {
  await requireAuthenticatedUser()
  return db.select().from(routes).orderBy(desc(routes.createdAt))
}

export async function createWarehouse(input: { name: string; code: string; warehouseType: string; location: string }) {
  await requireAuthenticatedUser()
  const result = await db.insert(warehouses).values({
    name: required(input.name, 'Nombre'),
    code: required(input.code, 'Código'),
    warehouseType: required(input.warehouseType, 'Tipo'),
    location: input.location?.trim() ?? '',
  }).returning()
  revalidatePath('/')
  return result[0]
}

export async function updateWarehouse(id: number, input: Partial<{ name: string; code: string; warehouseType: string; location: string }>) {
  await requireAuthenticatedUser()
  const result = await db.update(warehouses).set({
    ...(input.name !== undefined && { name: required(input.name, 'Nombre') }),
    ...(input.code !== undefined && { code: required(input.code, 'Código') }),
    ...(input.warehouseType !== undefined && { warehouseType: required(input.warehouseType, 'Tipo') }),
    ...(input.location !== undefined && { location: input.location.trim() }),
  }).where(eq(warehouses.id, id)).returning()
  revalidatePath('/')
  return result[0]
}

export async function listWarehouses() {
  await requireAuthenticatedUser()
  return db.select().from(warehouses).orderBy(desc(warehouses.createdAt))
}

export async function createSupplier(input: { name: string; lastName: string; identityNumber: string; phone: string; email: string }) {
  await requireAuthenticatedUser()
  const result = await db.insert(suppliers).values({
    name: required(input.name, 'Nombre'),
    lastName: input.lastName?.trim() ?? '',
    identityNumber: input.identityNumber?.trim() ?? '',
    phone: input.phone?.trim() ?? '',
    email: input.email?.trim() ?? '',
  }).returning()
  revalidatePath('/')
  return result[0]
}

export async function createCustomer(input: { name: string; phone: string; address: string; email: string; code: string }) {
  await requireAuthenticatedUser()
  const result = await db.insert(customers).values({
    name: required(input.name, 'Nombre'),
    phone: input.phone?.trim() ?? '',
    address: input.address?.trim() ?? '',
    email: input.email?.trim() ?? '',
    code: required(input.code, 'Código'),
  }).returning()
  revalidatePath('/')
  return result[0]
}

export async function listSuppliers() {
  await requireAuthenticatedUser()
  return db.select().from(suppliers).orderBy(desc(suppliers.createdAt))
}

export async function listCustomers() {
  await requireAuthenticatedUser()
  return db.select().from(customers).orderBy(desc(customers.createdAt))
}

export async function dashboardCounts() {
  await requireAuthenticatedUser()
  const [productCount, movementCount, orderCount] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(products),
    db.select({ count: sql<number>`count(*)` }).from(inventoryMovements),
    db.select({ count: sql<number>`count(*)` }).from(productionOrders),
  ])
  return {
    products: Number(productCount[0]?.count ?? 0),
    movements: Number(movementCount[0]?.count ?? 0),
    orders: Number(orderCount[0]?.count ?? 0),
  }
}
