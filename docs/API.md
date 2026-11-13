# API REST y Swagger

La documentación interactiva está en `/api-docs`; el documento OpenAPI está
disponible en `/api/openapi`.

El inicio/cierre de sesión, la administración de usuarios y el asistente para
crear el administrador inicial están descritos en [AUTENTICACION.md](./AUTENTICACION.md).

## Proteger y probar la API

Las rutas de datos generales requieren una clave Bearer de al menos 32 caracteres.
Genérala localmente desde la raíz del proyecto:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

Configura el resultado como `API_KEY` en `.env.local` para desarrollo y en
**Environment** del servicio web de Render para producción. No la guardes en el
código ni la publiques. Abre `/api-docs`, pulsa **Authorize** y pega la clave
sin escribir el prefijo `Bearer`; Swagger lo añade automáticamente.

## Endpoints disponibles

Los recursos devuelven registros en JSON. Las listas usan `page` (predeterminado
1) y `limit` (predeterminado 50, máximo 100).

| Recurso | Endpoints |
| --- | --- |
| Productos (`/api/products`) | GET, POST; GET, PATCH, DELETE por `/{id}` |
| Materias primas (`/api/raw-materials`) | GET, POST; GET, PATCH, DELETE por `/{id}` |
| Recetas (`/api/recipes`) | GET, POST; GET, PATCH, DELETE por `/{id}` |
| Rutas (`/api/routes`) | GET, POST; GET, PATCH, DELETE por `/{id}` |
| Almacenes (`/api/warehouses`) | GET, POST; GET, PATCH, DELETE por `/{id}` |
| Proveedores (`/api/suppliers`) | GET, POST; GET, PATCH, DELETE por `/{id}` |
| Clientes (`/api/customers`) | GET, POST; GET, PATCH, DELETE por `/{id}` |
| Movimientos (`/api/inventory-movements`) | GET, POST; GET por `/{id}` |
| Órdenes de producción (`/api/production-orders`) | GET, POST; GET, PATCH por `/{id}` |
| Dashboard (`/api/dashboard`) | GET |
| Salud (`/api/health`) | GET; comprueba la conexión a PostgreSQL |
| Usuarios (`/api/users`) | GET, POST; GET, PATCH, DELETE por `/{id}`; requiere sesión de administrador |

Los movimientos son inmutables: solo se pueden consultar o crear. Las órdenes
de producción se actualizan únicamente cambiando `status` (`Pendiente`, `En
proceso`, `Finalizada` o `Cancelada`); no se eliminan por API. Las respuestas de
errores siguen el formato `{ "error": { "code": "...", "message": "..." } }`.

Los endpoints de usuarios usan la sesión HttpOnly obtenida al iniciar sesión y
no la API key general. Solo administradores pueden usarlos. Las contraseñas se
guardan con bcrypt; los hashes nunca aparecen en las respuestas. Las reglas y
protecciones están detalladas en [AUTENTICACION.md](./AUTENTICACION.md).

La API implementa los demás recursos que tienen tablas en `lib/db/schema.ts`.
Compras, ventas y calidad aún no tienen endpoints persistentes.
