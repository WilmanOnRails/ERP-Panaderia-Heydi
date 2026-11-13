const resources = [
  { slug: "products", name: "Productos", model: "Product", create: "ProductCreate", update: "ProductUpdate" },
  { slug: "raw-materials", name: "Materias primas", model: "RawMaterial", create: "RawMaterialCreate", update: "RawMaterialUpdate" },
  { slug: "recipes", name: "Recetas", model: "Recipe", create: "RecipeCreate", update: "RecipeUpdate" },
  { slug: "routes", name: "Rutas de producción", model: "Route", create: "RouteCreate", update: "RouteUpdate" },
  { slug: "warehouses", name: "Almacenes", model: "Warehouse", create: "WarehouseCreate", update: "WarehouseUpdate" },
  { slug: "suppliers", name: "Proveedores", model: "Supplier", create: "SupplierCreate", update: "SupplierUpdate" },
  { slug: "customers", name: "Clientes", model: "Customer", create: "CustomerCreate", update: "CustomerUpdate" },
  { slug: "inventory-movements", name: "Movimientos de inventario", model: "InventoryMovement", create: "InventoryMovementCreate", update: "InventoryMovementCreate", immutable: true },
  { slug: "production-orders", name: "Órdenes de producción", model: "ProductionOrder", create: "ProductionOrderCreate", update: "ProductionOrderUpdate", noDelete: true },
] as const

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` })
const jsonRequest = (schema: string) => ({ required: true, content: { "application/json": { schema: ref(schema) } } })
const dataResponse = (schema: string) => ({
  description: "Operación exitosa",
  content: { "application/json": { schema: { type: "object", properties: { data: ref(schema) }, required: ["data"] } } },
})
const listResponse = (schema: string) => ({
  description: "Lista paginada",
  content: {
    "application/json": {
      schema: {
        type: "object",
        properties: {
          data: { type: "array", items: ref(schema) },
          pagination: {
            type: "object",
            properties: { page: { type: "integer" }, limit: { type: "integer" }, hasMore: { type: "boolean" } },
            required: ["page", "limit", "hasMore"],
          },
        },
        required: ["data", "pagination"],
      },
    },
  },
})
const errorContent = { "application/json": { schema: ref("ApiError") } }
const errorResponses = {
  "400": { description: "Solicitud o datos no válidos", content: errorContent },
  "401": { description: "API key ausente o inválida", content: errorContent },
  "409": { description: "Conflicto de unicidad o referencia", content: errorContent },
  "500": { description: "Error interno", content: errorContent },
}

const paths: Record<string, unknown> = {
  "/api/auth/login": {
    post: {
      tags: ["Autenticación"],
      summary: "Iniciar sesión con usuario o correo",
      security: [],
      requestBody: {
        required: true,
        content: { "application/json": { schema: { type: "object", required: ["identifier", "password"], properties: { identifier: { type: "string", maxLength: 254 }, password: { type: "string", minLength: 1 } }, additionalProperties: false } } },
      },
      responses: {
        "200": { description: "Sesión creada; establece la cookie HttpOnly erp_session" },
        "400": { description: "Datos de inicio de sesión no válidos" },
        "401": { description: "Usuario o contraseña incorrectos" },
        "429": { description: "Demasiados intentos" },
      },
    },
  },
  "/api/auth/logout": {
    post: {
      tags: ["Autenticación"],
      summary: "Cerrar sesión",
      security: [],
      responses: { "200": { description: "Cookie de sesión eliminada" } },
    },
  },
  "/api/users": {
    get: {
      tags: ["Usuarios"],
      summary: "Listar usuarios (solo administradores)",
      description: "Requiere iniciar sesión en la aplicación con una cuenta administradora. Nunca incluye hashes ni contraseñas.",
      security: [{ SessionCookie: [] }],
      parameters: [
        { name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 } },
        { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 50 } },
      ],
      responses: { "200": listResponse("User"), ...errorResponses, "401": { description: "Se requiere una sesión" }, "403": { description: "Se requiere rol administrador" } },
    },
    post: {
      tags: ["Usuarios"],
      summary: "Crear usuario (solo administradores)",
      description: "La contraseña se almacena con bcrypt y nunca se devuelve. La cuenta creada puede iniciar sesión con su usuario o correo.",
      security: [{ SessionCookie: [] }],
      requestBody: jsonRequest("UserCreate"),
      responses: { "201": dataResponse("User"), ...errorResponses, "401": { description: "Se requiere una sesión" }, "403": { description: "Se requiere rol administrador" } },
    },
  },
  "/api/users/{id}": {
    get: {
      tags: ["Usuarios"],
      summary: "Obtener usuario (solo administradores)",
      security: [{ SessionCookie: [] }],
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer", minimum: 1 } }],
      responses: { "200": dataResponse("User"), "404": { description: "Usuario no encontrado" }, ...errorResponses, "401": { description: "Se requiere una sesión" }, "403": { description: "Se requiere rol administrador" } },
    },
    patch: {
      tags: ["Usuarios"],
      summary: "Actualizar usuario (solo administradores)",
      description: "La contraseña es opcional; si se envía, debe contener al menos 12 caracteres y no superar 72 bytes.",
      security: [{ SessionCookie: [] }],
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer", minimum: 1 } }],
      requestBody: jsonRequest("UserUpdate"),
      responses: { "200": dataResponse("User"), "404": { description: "Usuario no encontrado" }, ...errorResponses, "401": { description: "Se requiere una sesión" }, "403": { description: "Se requiere rol administrador" } },
    },
    delete: {
      tags: ["Usuarios"],
      summary: "Eliminar usuario (solo administradores)",
      description: "No permite eliminar la propia cuenta ni al único administrador.",
      security: [{ SessionCookie: [] }],
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer", minimum: 1 } }],
      responses: { "204": { description: "Usuario eliminado" }, "404": { description: "Usuario no encontrado" }, ...errorResponses, "401": { description: "Se requiere una sesión" }, "403": { description: "Se requiere rol administrador" } },
    },
  },
  "/api/health": {
    get: {
      tags: ["Sistema"],
      summary: "Comprobar el estado de la API y PostgreSQL",
      responses: {
        "200": { description: "API y base de datos disponibles", content: { "application/json": { schema: { type: "object", properties: { data: { type: "object", properties: { status: { type: "string" }, database: { type: "string" } } } } } } } },
        "401": errorResponses["401"],
        "503": { description: "API_KEY no está configurada", content: errorContent },
      },
    },
  },
  "/api/dashboard": {
    get: {
      tags: ["Sistema"],
      summary: "Obtener los conteos principales del ERP",
      responses: {
        "200": { description: "Conteo de productos, movimientos y órdenes", content: { "application/json": { schema: { type: "object", properties: { data: { type: "object", properties: { products: { type: "integer" }, movements: { type: "integer" }, orders: { type: "integer" } } } } } } } },
        ...errorResponses,
      },
    },
  },
}

for (const resource of resources) {
  const collectionMethods: Record<string, unknown> = {
    get: {
      tags: [resource.name],
      summary: `Listar ${resource.name.toLowerCase()}`,
      description: "Paginación con page (predeterminado 1) y limit (predeterminado 50, máximo 100).",
      parameters: [
        { name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 } },
        { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 50 } },
      ],
      responses: { "200": listResponse(resource.model), ...errorResponses },
    },
  }

  if (!("immutable" in resource)) {
    collectionMethods.post = {
      tags: [resource.name],
      summary: `Crear registro de ${resource.name.toLowerCase()}`,
      requestBody: jsonRequest(resource.create),
      responses: { "201": dataResponse(resource.model), ...errorResponses },
    }
  }

  const itemMethods: Record<string, unknown> = {
    get: {
      tags: [resource.name],
      summary: `Obtener registro de ${resource.name.toLowerCase()} por ID`,
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer", minimum: 1 } }],
      responses: { "200": dataResponse(resource.model), "404": { description: "Registro no encontrado" }, ...errorResponses },
    },
  }

  if (!("immutable" in resource)) {
    itemMethods.patch = {
      tags: [resource.name],
      summary: `Actualizar registro de ${resource.name.toLowerCase()}`,
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer", minimum: 1 } }],
      requestBody: jsonRequest(resource.update),
      responses: { "200": dataResponse(resource.model), "404": { description: "Registro no encontrado" }, ...errorResponses },
    }
  }

  if (!("noDelete" in resource) && !("immutable" in resource)) {
    itemMethods.delete = {
      tags: [resource.name],
      summary: `Eliminar registro de ${resource.name.toLowerCase()}`,
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer", minimum: 1 } }],
      responses: { "204": { description: "Registro eliminado" }, "404": { description: "Registro no encontrado" }, ...errorResponses },
    }
  }

  paths[`/api/${resource.slug}`] = collectionMethods
  paths[`/api/${resource.slug}/{id}`] = itemMethods
}

export const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "ERP Repostería Heydi API",
    version: "1.0.0",
    description: "API REST para los datos persistidos del ERP. Autoriza las solicitudes con un Bearer token configurado mediante API_KEY.",
  },
  servers: [{ url: "/", description: "Servidor actual" }],
  security: [{ ApiKey: [] }],
  tags: [{ name: "Sistema" }, { name: "Autenticación" }, { name: "Usuarios" }, ...resources.map(({ name }) => ({ name }))],
  paths,
  components: {
    securitySchemes: {
      ApiKey: { type: "http", scheme: "bearer", bearerFormat: "API key" },
      SessionCookie: { type: "apiKey", in: "cookie", name: "erp_session" },
    },
    schemas: {
      ApiError: {
        type: "object",
        properties: {
          error: {
            type: "object",
            properties: { code: { type: "string" }, message: { type: "string" }, details: { type: "array", items: { type: "object" } } },
            required: ["code", "message"],
          },
          User: {
            type: "object",
            properties: {
              id: { type: "integer" },
              fullName: { type: "string" },
              username: { type: "string" },
              code: { type: "string" },
              phone: { type: "string" },
              email: { type: "string", format: "email" },
              role: { type: "string", enum: ["administrador", "usuario"] },
              createdAt: { type: "string", format: "date-time" },
            },
            required: ["id", "fullName", "username", "code", "phone", "email", "role", "createdAt"],
          },
          UserCreate: {
            type: "object",
            required: ["fullName", "username", "code", "email", "password"],
            properties: {
              fullName: { type: "string", minLength: 2, maxLength: 100 },
              username: { type: "string", pattern: "^[a-z0-9._-]{3,32}$" },
              code: { type: "string", minLength: 1, maxLength: 64 },
              phone: { type: "string", maxLength: 40 },
              email: { type: "string", format: "email", maxLength: 254 },
              role: { type: "string", enum: ["administrador", "usuario"], default: "usuario" },
              password: { type: "string", minLength: 12, maxLength: 72 },
            },
            additionalProperties: false,
          },
          UserUpdate: {
            type: "object",
            minProperties: 1,
            properties: {
              fullName: { type: "string", minLength: 2, maxLength: 100 },
              username: { type: "string", pattern: "^[a-z0-9._-]{3,32}$" },
              code: { type: "string", minLength: 1, maxLength: 64 },
              phone: { type: "string", maxLength: 40 },
              email: { type: "string", format: "email", maxLength: 254 },
              role: { type: "string", enum: ["administrador", "usuario"] },
              password: { type: "string", minLength: 12, maxLength: 72 },
            },
            additionalProperties: false,
          },
        },
        required: ["error"],
      },
      Product: { type: "object", properties: { id: { type: "integer" }, code: { type: "string" }, name: { type: "string" }, breadType: { type: "string" }, units: { type: "integer" }, price: { type: "string" }, active: { type: "boolean" }, createdAt: { type: "string", format: "date-time" }, updatedAt: { type: "string", format: "date-time" } } },
      ProductCreate: { type: "object", required: ["code", "name", "breadType", "units", "price"], properties: { code: { type: "string" }, name: { type: "string" }, breadType: { type: "string" }, units: { type: "integer", minimum: 1 }, price: { type: "number", minimum: 0 }, active: { type: "boolean" } } },
      ProductUpdate: { type: "object", minProperties: 1, properties: { code: { type: "string" }, name: { type: "string" }, breadType: { type: "string" }, units: { type: "integer", minimum: 1 }, price: { type: "number", minimum: 0 }, active: { type: "boolean" } } },
      RawMaterial: { type: "object", properties: { id: { type: "integer" }, code: { type: "string" }, name: { type: "string" }, stock: { type: "string" }, availableUnits: { type: "string" }, active: { type: "boolean" }, createdAt: { type: "string", format: "date-time" } } },
      RawMaterialCreate: { type: "object", required: ["code", "name", "stock", "availableUnits"], properties: { code: { type: "string" }, name: { type: "string" }, stock: { type: "number", minimum: 0 }, availableUnits: { type: "number", minimum: 0 }, active: { type: "boolean" } } },
      RawMaterialUpdate: { type: "object", minProperties: 1, properties: { code: { type: "string" }, name: { type: "string" }, stock: { type: "number", minimum: 0 }, availableUnits: { type: "number", minimum: 0 }, active: { type: "boolean" } } },
      Recipe: { type: "object", properties: { id: { type: "integer" }, code: { type: "string" }, name: { type: "string" }, bomUnits: { type: "string" }, description: { type: "string" }, createdAt: { type: "string", format: "date-time" } } },
      RecipeCreate: { type: "object", required: ["code", "name", "bomUnits"], properties: { code: { type: "string" }, name: { type: "string" }, bomUnits: { type: "number", minimum: 0 }, description: { type: "string" } } },
      RecipeUpdate: { type: "object", minProperties: 1, properties: { code: { type: "string" }, name: { type: "string" }, bomUnits: { type: "number", minimum: 0 }, description: { type: "string" } } },
      Route: { type: "object", properties: { id: { type: "integer" }, code: { type: "string" }, name: { type: "string" }, operations: { type: "string" }, durationMinutes: { type: "integer" }, active: { type: "boolean" }, createdAt: { type: "string", format: "date-time" } } },
      RouteCreate: { type: "object", required: ["code", "name", "operations", "durationMinutes"], properties: { code: { type: "string" }, name: { type: "string" }, operations: { type: "string" }, durationMinutes: { type: "integer", minimum: 0 }, active: { type: "boolean" } } },
      RouteUpdate: { type: "object", minProperties: 1, properties: { code: { type: "string" }, name: { type: "string" }, operations: { type: "string" }, durationMinutes: { type: "integer", minimum: 0 }, active: { type: "boolean" } } },
      Warehouse: { type: "object", properties: { id: { type: "integer" }, code: { type: "string" }, name: { type: "string" }, warehouseType: { type: "string" }, location: { type: "string" }, active: { type: "boolean" }, createdAt: { type: "string", format: "date-time" } } },
      WarehouseCreate: { type: "object", required: ["code", "name", "warehouseType"], properties: { code: { type: "string" }, name: { type: "string" }, warehouseType: { type: "string" }, location: { type: "string" }, active: { type: "boolean" } } },
      WarehouseUpdate: { type: "object", minProperties: 1, properties: { code: { type: "string" }, name: { type: "string" }, warehouseType: { type: "string" }, location: { type: "string" }, active: { type: "boolean" } } },
      Supplier: { type: "object", properties: { id: { type: "integer" }, name: { type: "string" }, lastName: { type: "string" }, identityNumber: { type: "string" }, phone: { type: "string" }, email: { type: "string" }, createdAt: { type: "string", format: "date-time" } } },
      SupplierCreate: { type: "object", required: ["name"], properties: { name: { type: "string" }, lastName: { type: "string" }, identityNumber: { type: "string" }, phone: { type: "string" }, email: { type: "string", format: "email" } } },
      SupplierUpdate: { type: "object", minProperties: 1, properties: { name: { type: "string" }, lastName: { type: "string" }, identityNumber: { type: "string" }, phone: { type: "string" }, email: { type: "string", format: "email" } } },
      Customer: { type: "object", properties: { id: { type: "integer" }, code: { type: "string" }, name: { type: "string" }, phone: { type: "string" }, address: { type: "string" }, email: { type: "string" }, createdAt: { type: "string", format: "date-time" } } },
      CustomerCreate: { type: "object", required: ["code", "name"], properties: { code: { type: "string" }, name: { type: "string" }, phone: { type: "string" }, address: { type: "string" }, email: { type: "string", format: "email" } } },
      CustomerUpdate: { type: "object", minProperties: 1, properties: { code: { type: "string" }, name: { type: "string" }, phone: { type: "string" }, address: { type: "string" }, email: { type: "string", format: "email" } } },
      InventoryMovement: { type: "object", properties: { id: { type: "integer" }, movementType: { type: "string" }, productId: { type: "integer", nullable: true }, rawMaterialId: { type: "integer", nullable: true }, quantity: { type: "string" }, reference: { type: "string" }, createdAt: { type: "string", format: "date-time" } } },
      InventoryMovementCreate: { type: "object", description: "Indica exactamente uno de productId o rawMaterialId.", required: ["movementType", "quantity"], properties: { movementType: { type: "string" }, productId: { type: "integer", minimum: 1 }, rawMaterialId: { type: "integer", minimum: 1 }, quantity: { type: "number", exclusiveMinimum: 0 }, reference: { type: "string" } } },
      ProductionOrder: { type: "object", properties: { id: { type: "integer" }, orderNumber: { type: "string" }, productId: { type: "integer" }, plannedUnits: { type: "integer" }, status: { type: "string", enum: ["Pendiente", "En proceso", "Finalizada", "Cancelada"] }, createdAt: { type: "string", format: "date-time" } } },
      ProductionOrderCreate: { type: "object", required: ["orderNumber", "productId", "plannedUnits"], properties: { orderNumber: { type: "string" }, productId: { type: "integer", minimum: 1 }, plannedUnits: { type: "integer", minimum: 1 } } },
      ProductionOrderUpdate: { type: "object", required: ["status"], properties: { status: { type: "string", enum: ["Pendiente", "En proceso", "Finalizada", "Cancelada"] } } },
    },
  },
} as const
