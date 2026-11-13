# Prisma y PostgreSQL en Render

El proyecto conserva Drizzle como ORM de las operaciones actuales. Prisma se usa
para definir el mismo esquema PostgreSQL y administrar sus migraciones; no se
cambiaron las consultas existentes. El esquema incluye las diez tablas `erp_*`
que utiliza la aplicación.

## Conexión local

1. En Render, abre tu PostgreSQL y copia su **External Database URL** para
   conectarte desde tu computadora.
2. Crea un archivo `.env` en la raíz (no lo subas a Git) con:

   ```env
   DATABASE_URL="postgresql://USUARIO:CONTRASEÑA@HOST:PUERTO/BASE?schema=public&sslmode=verify-full"
   ```

3. Si la contraseña contiene caracteres especiales, codifícala para URL. Para
   la **External Database URL**, conserva `sslmode=verify-full`; si ya hay
   parámetros después de `?`, agrega `&sslmode=verify-full` en lugar de otro
   `?`. No compartas ni publiques la cadena de conexión.
4. Genera el cliente y verifica el estado:

   ```powershell
   npm run db:generate
   npm run db:migrate:status
   ```

## Aplicar la migración inicial

Antes de ejecutar una migración, confirma si la base ya tiene las tablas ERP.
En la consola SQL de Render puedes consultar:

```sql
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename LIKE 'erp_%'
ORDER BY tablename;
```

- **Base vacía (sin tablas `erp_*`):** ejecuta `npm run db:migrate:deploy`.
- **Las diez tablas ya existen y coinciden con `lib/db/schema.ts`:** no vuelvas
  a crear tablas. Registra la migración inicial como baseline y luego verifica:

  ```powershell
  npx prisma migrate resolve --applied 20261113041700_init_erp
  npm run db:migrate:status
  ```

- **Hay algunas tablas, faltan tablas/columnas o no sabes si coinciden:** no
  ejecutes `migrate deploy` ni `migrate resolve` todavía. Comparte únicamente la
  lista de nombres/columnas (nunca la URL ni la contraseña) para preparar una
  migración incremental segura.

Prisma Migrate no sustituye ni adopta automáticamente tablas existentes. Hacer
baseline solo es correcto si el esquema de Render ya coincide con la migración.

## Despliegue en Render

En el servicio web, configura `DATABASE_URL` con la **Internal Database URL**
del PostgreSQL (si ambos servicios están en Render y en la misma región). Para
despliegues posteriores agrega `npm run db:migrate:deploy` al paso de release
previo a iniciar la aplicación. Mantén `npm run db:generate` como parte de la
instalación/build y no uses `migrate dev` en producción.

Las migraciones futuras se generan en desarrollo con `npm run db:migrate:dev
-- --name descripcion_del_cambio`; revisa y guarda el SQL generado en Git.
