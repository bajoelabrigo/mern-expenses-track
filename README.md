# Sistema Contable para Iglesias (MERN)

Aplicación para llevar ingresos y gastos personales y de iglesias. Cada cuenta
trabaja en **espacios** (uno personal y uno por iglesia o ministerio) que se
comparten con otras personas con un **rol**: propietario, tesorero, contador,
auditor o lector. Incluye categorías por espacio, movimientos con recurrencia,
anulación con motivo, historial de cambios, filtros, gráficos, exportación a
Excel, invitaciones por enlace y un panel de administración de la plataforma.

La hoja de ruta está en [ROADMAP.md](ROADMAP.md).

- **Backend:** Node + Express 4 + MongoDB (Mongoose), JWT.
- **Frontend:** React 19 + Vite + Redux Toolkit + React Query + Tailwind 4.

---

## Requisitos

- Node.js 20 o superior
- Una base de datos MongoDB (Atlas o local)

## Puesta en marcha

```bash
# 1. Backend
cd backend
cp .env.example .env          # completa MONGO_URL y JWT_SECRET
npm install
npm run dev                   # http://localhost:8000

# 2. Frontend (en otra terminal)
cd frontend
cp .env.example .env.local    # opcional: define VITE_API_URL
npm install
npm run dev                   # http://localhost:5173
```

Genera un `JWT_SECRET` seguro con:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

## Variables de entorno

### backend/.env

| Variable          | Obligatoria | Descripción                                                        |
| ----------------- | ----------- | ------------------------------------------------------------------ |
| `MONGO_URL`       | sí          | Cadena de conexión a MongoDB.                                      |
| `JWT_SECRET`      | sí          | Secreto para firmar los JWT. Mínimo 32 caracteres.                 |
| `NODE_ENV`        | no          | `development` (por defecto), `production` o `test`.                |
| `PORT`            | no          | Puerto del servidor. Por defecto `8000`.                           |
| `JWT_EXPIRES_IN`  | no          | Duración del token. Por defecto `7d`.                              |
| `CORS_ORIGINS`    | no          | Orígenes permitidos, separados por coma.                           |
| `SERVE_FRONTEND`  | no          | `true` si este servicio también sirve `frontend/dist`.             |
| `COOKIE_SAMESITE` | no          | `none` (por defecto en producción), `lax` o `strict`.              |
| `APP_URL`         | no          | URL pública del frontend, para los enlaces de los correos. Por defecto, el primer origen de `CORS_ORIGINS`. |
| `BREVO_API_KEY`, `MAIL_FROM` | no | Correo saliente por la API de Brevo (invitaciones y recuperar contraseña). Es la opción para Render: su plan gratuito bloquea los puertos SMTP. `MAIL_FROM` debe ser un remitente verificado en Brevo. |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | no | Comprobantes de los movimientos. Se guardan como *authenticated* (nunca públicos) en `control-gastos/<espacio>/` y se ven con un enlace firmado de 5 minutos. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | no | Correo por SMTP, para un hosting que lo permita (solo si no hay `BREVO_API_KEY`). Sin ninguno de los dos no se envía nada: el enlace sale en el log y las invitaciones se comparten copiando el enlace. |

La app **no arranca** si falta `MONGO_URL` o `JWT_SECRET`, o si el secreto es
demasiado corto: es intencional, evita desplegar con una configuración insegura.

### frontend/.env.local

| Variable       | Descripción                                                          |
| -------------- | -------------------------------------------------------------------- |
| `VITE_API_URL` | URL base de la API. Por defecto `http://localhost:8000/api/v1` en dev y `/api/v1` en producción. |

## Scripts

| Comando                       | Qué hace                                         |
| ----------------------------- | ------------------------------------------------ |
| `npm run dev --prefix backend`  | API con recarga automática (nodemon).          |
| `npm test --prefix backend`     | Pruebas de integración (MongoDB en memoria).   |
| `npm run dev --prefix frontend` | Servidor de desarrollo de Vite.                |
| `npm test --prefix frontend`    | Pruebas con Vitest.                            |
| `npm run lint --prefix frontend`| ESLint.                                        |
| `npm run build`                 | Instala dependencias y compila el frontend.    |
| `npm start`                     | Arranca la API en modo producción.             |
| `node backend/scripts/dev-memoria.js` | API contra un MongoDB en memoria, para probar en local sin tocar la base real. |
| `node backend/scripts/migrar-espacios.js` | Migración a espacios (simulación; con `--aplicar` escribe). |

## Pruebas

```bash
npm test --prefix backend    # 81 pruebas de integración sobre la API real
npm test --prefix frontend   # 36 pruebas de componentes, servicios y estado
```

El backend levanta un MongoDB en memoria: no toca la base de datos real y no
requiere configuración previa.

## Estructura

```
backend/
  app.js            # aplicación Express (exportable, sin listen: se usa en tests)
  server.js         # arranque: conexión a Mongo, listen y apagado ordenado
  config/env.js     # validación y lectura de variables de entorno
  controllers/      # usuarios, espacios, categorías, transacciones y admin
  middlewares/      # auth, espacio actual y permisos, rate limit, ids, errores
  model/            # esquemas de Mongoose con índices
  routes/           # routers montados bajo /api/v1
  services/         # alta de espacios y espacio predeterminado
  scripts/          # migraciones y API en memoria para desarrollo
  utils/            # fechas, dinero (centavos), permisos, auditoría, correo
  tests/            # pruebas de integración (node:test + supertest)
frontend/
  src/components/   # UI por dominio
  src/services/     # llamadas a la API
  src/lib/axios.js  # instancia con token y espacio, manejo de 401 y errores
  src/lib/money.js  # sumas en centavos y formato por moneda
  src/hooks/useWorkspace.js  # espacio actual, permisos y cambio de espacio
  src/redux/        # sesión (token + usuario) y espacio elegido
  src/utils/        # almacenamiento de sesión y URL base
  src/test/         # pruebas (Vitest + Testing Library)
```

## API

Todas las rutas cuelgan de `/api/v1`. Salvo las públicas, requieren el
encabezado `Authorization: Bearer <token>` o la cookie de sesión.

**Espacio actual.** Movimientos y categorías son de un espacio. El cliente lo
indica con la cabecera `X-Workspace-Id`; sin ella se usa el espacio
predeterminado del usuario. Pedir un espacio del que no se es miembro responde
`403` con `code: "NOT_A_MEMBER"`.

**Dinero.** La API habla en unidades (`150.5`); la base guarda centavos enteros.

### Usuarios

| Método | Ruta                             | Descripción                                        |
| ------ | -------------------------------- | -------------------------------------------------- |
| POST   | `/users/register`                | Crear cuenta (con `iglesia` opcional y `currency`). |
| POST   | `/users/login`                   | Iniciar sesión (devuelve token y cookie).          |
| POST   | `/users/logout`                  | Cerrar sesión (limpia la cookie).                  |
| POST   | `/users/forgot-password`         | Enviar el enlace para restablecer la contraseña.   |
| POST   | `/users/reset-password/:token`   | Fijar una contraseña nueva con el enlace.          |
| GET    | `/users/profile`                 | Perfil del usuario autenticado.                    |
| PUT    | `/users/change-password`         | Cambiar contraseña (exige la actual).              |
| PUT    | `/users/update-profile`          | Actualizar correo o nombre de usuario.             |
| PUT    | `/users/default-workspace`       | Elegir el espacio que se abre al entrar.           |

### Espacios

| Método | Ruta                                          | Permiso             |
| ------ | --------------------------------------------- | ------------------- |
| GET    | `/workspaces`                                 | mis espacios, con rol y permisos |
| POST   | `/workspaces`                                 | cualquiera (queda de propietario) |
| GET    | `/workspaces/:id`                             | miembro             |
| PUT    | `/workspaces/:id`                             | `workspace:manage`  |
| DELETE | `/workspaces/:id` (con `confirmName`)         | `workspace:delete`  |
| GET    | `/workspaces/:id/members`                     | miembro             |
| PUT    | `/workspaces/:id/members/:userId`             | `members:manage`    |
| DELETE | `/workspaces/:id/members/:userId`             | `members:manage`, o uno mismo para salir |
| GET    | `/workspaces/:id/invitations`                 | `members:manage`    |
| POST   | `/workspaces/:id/invitations`                 | `members:manage` (devuelve el enlace) |
| DELETE | `/workspaces/:id/invitations/:invitationId`   | `members:manage`    |
| GET    | `/workspaces/:id/audit`                       | `audit:read`        |
| GET    | `/invitations/:token`                         | pública (vista previa) |
| POST   | `/invitations/:token/accept`                  | sesión con el correo invitado |

| Rol          | Puede                                                               |
| ------------ | ------------------------------------------------------------------- |
| propietario  | todo, incluidos ajustes, borrar el espacio y borrar movimientos del todo |
| tesorero     | movimientos, categorías, historial e invitar contadores, auditores y lectores |
| contador     | movimientos y categorías                                            |
| auditor      | solo lectura, incluido el historial                                 |
| lector       | solo lectura                                                        |

Las reglas viven en `backend/utils/permissions.js`.

### Categorías (del espacio actual)

| Método | Ruta                       | Descripción                       |
| ------ | -------------------------- | --------------------------------- |
| POST   | `/categories/create`       | Crear categoría.                  |
| GET    | `/categories/lists`        | Listar las del espacio.           |
| GET    | `/categories/:id`          | Ver una categoría.                |
| PUT    | `/categories/update/:id`   | Editar (arrastra transacciones).  |
| DELETE | `/categories/delete/:id`   | Eliminar (reasigna transacciones).|

### Transacciones (del espacio actual)

| Método | Ruta                               | Descripción                                  |
| ------ | ---------------------------------- | -------------------------------------------- |
| POST   | `/transactions/create`             | Crear (soporta recurrencia).                 |
| GET    | `/transactions/lists`              | Listado paginado (`includeVoided=true` para ver anulados). |
| GET    | `/transactions/period`             | Por período o rango personalizado.           |
| GET    | `/transactions/balance`            | Ingresos, gastos y saldo (sin anulados).     |
| GET    | `/transactions/summary/monthly`    | Totales del mes en curso.                    |
| GET    | `/transactions/export/excel`       | Exportar a Excel respetando los filtros.     |
| GET    | `/transactions/:id`                | Ver una transacción.                         |
| PUT    | `/transactions/update/:id`         | Editar.                                      |
| POST   | `/transactions/:id/void`           | Anular con `reason` (lo normal en vez de borrar). |
| POST   | `/transactions/:id/restore`        | Deshacer la anulación.                       |
| DELETE | `/transactions/delete/:id`         | Compatibilidad: ahora **anula**.             |
| DELETE | `/transactions/:id/purge`          | Borrar del todo (solo propietario).          |
| PUT    | `/transactions/:id/receipt`        | Adjuntar o reemplazar el comprobante (`multipart`, campo `receipt`; JPG/PNG/WEBP/HEIC/PDF, 8 MB). |
| GET    | `/transactions/:id/receipt`        | Enlace temporal (5 min) para verlo.          |
| DELETE | `/transactions/:id/receipt`        | Quitar el comprobante.                       |

### Administración de la plataforma (`role: admin`)

| Método | Ruta                | Descripción                                  |
| ------ | ------------------- | -------------------------------------------- |
| GET    | `/admin/users`      | Usuarios con sus espacios y rol en cada uno. |
| GET    | `/admin/workspaces` | Espacios con miembros y movimientos.         |

Para revisar o corregir un espacio, el admin entra a él como soporte (misma
cabecera `X-Workspace-Id`) con permisos de propietario; cada cambio queda en el
historial de ese espacio con su nombre.

Para convertir a un usuario en administrador hay que cambiar su campo `role` a
`admin` directamente en la base de datos (no existe endpoint para hacerlo).

## Seguridad

- Contraseñas con bcrypt (coste 12) y nunca incluidas en las respuestas.
- JWT con expiración; al cambiar o restablecer la contraseña se invalidan las
  sesiones previas (versión de token, no fecha: no depende del reloj).
- Aislamiento por espacio: toda consulta filtra por el espacio actual y exige
  ser miembro; un recurso de otro espacio responde 404, sin revelar que existe.
- Los tokens de invitación y de recuperación se guardan solo como hash.
- El rol se lee de la base de datos en cada petición, no del token.
- `helmet`, límite de peticiones (`express-rate-limit`), saneado de operadores de
  Mongo y límite de tamaño del cuerpo de las peticiones.
- Los errores no exponen trazas en producción.
- Los `.env` están fuera del control de versiones (`.gitignore`).

## Despliegue

### Opción A: frontend en Netlify + API en Render (recomendada)

El frontend se sirve desde la CDN de Netlify (carga instantánea) y la API vive
en Render. `netlify.toml` ya trae la configuración del build y el redirect de
SPA; solo hay que definir las variables de entorno en cada panel.

**Netlify** (Site configuration → Environment variables):

| Variable       | Valor                                          |
| -------------- | ---------------------------------------------- |
| `VITE_API_URL` | `https://TU-API.onrender.com/api/v1`           |

**Render** (Environment):

| Variable         | Valor                                  |
| ---------------- | -------------------------------------- |
| `NODE_ENV`       | `production`                           |
| `MONGO_URL`      | cadena de conexión de Atlas            |
| `JWT_SECRET`     | secreto de 48 bytes                    |
| `CORS_ORIGINS`   | `https://TU-SITIO.netlify.app`         |
| `SERVE_FRONTEND` | `false`                                |
| `BREVO_API_KEY`  | clave de API de Brevo (correo)         |
| `MAIL_FROM`      | `Control de Gastos <remitente-verificado@…>` |
| `CLOUDINARY_*`   | credenciales de Cloudinary (comprobantes) |

**Render** (Settings): *Build Command* `npm install --prefix backend` y *Start
Command* `npm run start`. No uses `npm run build` en Render: con
`NODE_ENV=production` npm omite las dependencias de desarrollo, la compilación
del frontend falla (y además el frontend ya lo sirve Netlify).

Al estar en dominios distintos, la cookie de sesión se emite con
`SameSite=None; Secure`. Los navegadores que bloquean cookies de terceros
(Safari, Brave) la descartan, pero la sesión sigue funcionando porque el
frontend también envía el token en la cabecera `Authorization`.

### Opción B: un solo servicio

Render (o similar) sirve la API y los archivos estáticos: `SERVE_FRONTEND=true`
y `npm run build && npm start` desde la raíz. El frontend usa rutas relativas
(`/api/v1`) y no hace falta configurar CORS ni `VITE_API_URL`.

### Arranque en frío del plan gratuito

Render duerme los servicios gratuitos tras 15 minutos sin tráfico y la primera
petición tarda cerca de un minuto. La app lo mitiga así:

- al abrir la web se lanza un `GET /health` (`src/lib/wakeApi.js`) que empieza a
  despertar la API mientras la persona escribe sus credenciales;
- si el login tarda más de 4 segundos, se avisa en pantalla de que el servidor
  está despertando en lugar de dejar el botón bloqueado sin explicación.

Para eliminar la espera del todo hay que evitar que el servicio se duerma: un
ping externo cada 10-14 minutos (cron-job.org, UptimeRobot) contra `/health`, o
pasar el servicio a un plan de pago.

## Licencia

MIT (ver `LICENSE`).
