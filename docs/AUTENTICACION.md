# Inicio de sesión y primer administrador

El acceso se valida contra `erp_users` en PostgreSQL. Las contraseñas nuevas se
guardan con bcrypt; el navegador recibe una cookie `HttpOnly`, `SameSite=Lax`,
válida por 8 horas y marcada `Secure` en producción. La página del ERP y sus
acciones de servidor requieren una sesión válida.

## Variables de entorno

Genera un secreto distinto para cada entorno:

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

Configúralo como `SESSION_SECRET` (mínimo 32 bytes) en `.env.local` durante el
desarrollo y en las variables del servicio web de Render. Configura también
`DATABASE_URL` para Prisma. No incluyas ninguno de estos secretos en Git.

## Crear el administrador inicial

1. Verifica que `DATABASE_URL` apunte a la base correcta y que las migraciones
   estén aplicadas (`npm run db:migrate:deploy`).
2. Desde una terminal interactiva ejecuta `npm run admin:create`.
3. Ingresa nombre, usuario, código y correo. La contraseña se solicita sin
   mostrar caracteres; debe tener al menos 12 caracteres y máximo 72 bytes.
4. Inicia la aplicación, abre `/login` e ingresa el usuario o correo y la
   contraseña elegida.

## Administración de usuarios

En el ERP, las cuentas con rol `administrador` pueden crear, consultar,
actualizar y eliminar usuarios desde **Usuarios y roles**. La API ofrece las
mismas operaciones en `/api/users` y `/api/users/{id}`; estas rutas requieren
la sesión de administrador (no la API key de Swagger). Al crear una cuenta se
exige una contraseña de al menos 12 caracteres y máximo 72 bytes. Las cuentas
creadas pueden iniciar sesión con su nombre de usuario o correo. Al actualizar,
la contraseña es opcional; si no se envía, se conserva la existente.

Las respuestas nunca incluyen el hash de contraseña. El sistema impide que un
administrador elimine su propia cuenta o deje al sistema sin administradores.

El asistente solo crea una cuenta con el rol `administrador`. Si el usuario,
código o correo ya existe, se detiene sin cambiar cuentas existentes. No se
incluyen credenciales predeterminadas ni se almacena la contraseña en el
repositorio.

## Límites

El limitador de intentos de inicio de sesión vive en memoria del proceso; en
instancias múltiples o serverless no sustituye un limitador compartido. Para
exponer el acceso públicamente, agrega también rate limiting en el proxy o
proveedor de hosting.
