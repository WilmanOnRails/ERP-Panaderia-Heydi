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

En `/login`, cualquier persona puede solicitar una cuenta con **Regístrate**.
La solicitud crea un usuario `pending` con rol `usuario`; no puede acceder al
ERP hasta que un administrador lo apruebe en el módulo **Usuarios**. El
administrador también puede rechazar solicitudes, aprobarlas posteriormente o
eliminarlas. Los registros existentes conservan acceso mediante la migración
que los marca como aprobados.

Las respuestas nunca incluyen el hash de contraseña. Las cuentas con rol
administrador están protegidas: no pueden editarse ni eliminarse desde el módulo
ni desde la API. Tampoco se puede modificar desde el módulo la cuenta de la
sesión actual.

Los usuarios no administradores pueden abrir **Mi cuenta** desde la navegación
del ERP para cambiar su nombre, usuario, correo, teléfono o contraseña. Para
guardar cualquier cambio deben confirmar su contraseña actual; la nueva
contraseña, si se cambia, debe tener al menos 12 caracteres y máximo 72 bytes.

## Recuperar contraseña por correo

En `/login`, selecciona **¿Olvidaste tu contraseña?** e ingresa el correo de la
cuenta. Si existe una cuenta aprobada asociada a ese correo, recibirá un enlace
válido durante 30 minutos. La respuesta no confirma si el correo está
registrado. El enlace es de un solo uso; al generar otro, los enlaces anteriores
quedan invalidados. La nueva contraseña debe tener al menos 12 caracteres y
como máximo 72 bytes.

Configura estas variables en `.env` para desarrollo y en el servicio web de
Render para producción. Obtén `RESEND_API_KEY` desde el panel de Resend y
verifica el dominio remitente antes de usarlo con destinatarios reales:

| Variable | Descripción |
| --- | --- |
| `RESEND_API_KEY` | Clave de API de Resend; mantenla privada |
| `RESEND_FROM` | Remitente verificado en Resend, por ejemplo `Repostería Heydi <no-reply@tu-dominio.com>` |
| `APP_URL` | URL base pública de la aplicación, por ejemplo `https://tu-app.onrender.com` |

No agregues la clave al repositorio. En desarrollo, usa `APP_URL=http://localhost:3000`;
en Render, configura la URL pública HTTPS del servicio. Aplica la migración de
tokens con `npm run db:migrate:deploy` antes de usar el flujo. El endpoint
limita las solicitudes por dirección IP y correo; en despliegues con varias
instancias, usa también un limitador compartido en el proxy o proveedor.

Al aprobar una solicitud de registro desde **Usuarios y roles**, el sistema
envía un correo al usuario con un enlace para iniciar sesión. Este envío usa
`RESEND_API_KEY`, `RESEND_FROM` y `APP_URL`. Si Resend no está disponible, la
cuenta queda aprobada y el administrador recibe un aviso para que pueda revisar
el envío. Para enviar a otras direcciones además de la cuenta propietaria de
Resend, verifica un dominio en Resend y configura `RESEND_FROM` con una
dirección de ese dominio.

El asistente solo crea una cuenta con el rol `administrador`. Si el usuario,
código o correo ya existe, se detiene sin cambiar cuentas existentes. No se
incluyen credenciales predeterminadas ni se almacena la contraseña en el
repositorio.

## Límites

El limitador de intentos de inicio de sesión vive en memoria del proceso; en
instancias múltiples o serverless no sustituye un limitador compartido. Para
exponer el acceso públicamente, agrega también rate limiting en el proxy o
proveedor de hosting.
