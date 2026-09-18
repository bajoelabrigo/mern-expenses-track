# Sistema Contable para Iglesias (MERN)

Aplicación para registrar ingresos y gastos de una iglesia: categorías propias por
usuario, transacciones (con recurrencia), filtros por fecha/tipo/categoría,
gráficos, exportación a Excel y un panel de administración.

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

## Pruebas

```bash
npm test --prefix backend    # 44 pruebas de integración sobre la API real
npm test --prefix frontend   # 19 pruebas de componentes, servicios y estado
```

El backend levanta un MongoDB en memoria: no toca la base de datos real y no
requiere configuración previa.

## Estructura

```
backend/
  app.js            # aplicación Express (exportable, sin listen: se usa en tests)
  server.js         # arranque: conexión a Mongo, listen y apagado ordenado
  config/env.js     # validación y lectura de variables de entorno
  controllers/      # lógica de usuarios, categorías, transacciones y admin
  middlewares/      # auth, rol admin, rate limit, validación de ids, errores
  model/            # esquemas de Mongoose con índices
  routes/           # routers montados bajo /api/v1
  utils/dates.js    # manejo de rangos de fechas en hora local
  tests/            # pruebas de integración (node:test + supertest)
frontend/
  src/components/   # UI por dominio
  src/services/     # llamadas a la API
  src/lib/axios.js  # instancia con token, manejo de 401 y mensajes de error
  src/redux/        # sesión (token + usuario)
  src/utils/        # almacenamiento de sesión y URL base
  src/test/         # pruebas (Vitest + Testing Library)
```

## API

Todas las rutas cuelgan de `/api/v1`. Salvo registro y login, requieren el
encabezado `Authorization: Bearer <token>` o la cookie de sesión.

### Usuarios

| Método | Ruta                      | Descripción                                   |
| ------ | ------------------------- | --------------------------------------------- |
| POST   | `/users/register`         | Crear cuenta.                                 |
| POST   | `/users/login`            | Iniciar sesión (devuelve token y cookie).     |
| POST   | `/users/logout`           | Cerrar sesión (limpia la cookie).             |
| GET    | `/users/profile`          | Perfil del usuario autenticado.               |
| PUT    | `/users/change-password`  | Cambiar contraseña (exige la actual).         |
| PUT    | `/users/update-profile`   | Actualizar correo o nombre de usuario.        |

### Categorías

| Método | Ruta                       | Descripción                       |
| ------ | -------------------------- | --------------------------------- |
| POST   | `/categories/create`       | Crear categoría.                  |
| GET    | `/categories/lists`        | Listar categorías propias.        |
| GET    | `/categories/:id`          | Ver una categoría.                |
| PUT    | `/categories/update/:id`   | Editar (arrastra transacciones).  |
| DELETE | `/categories/delete/:id`   | Eliminar (reasigna transacciones).|

### Transacciones

| Método | Ruta                               | Descripción                                  |
| ------ | ---------------------------------- | -------------------------------------------- |
| POST   | `/transactions/create`             | Crear (soporta recurrencia).                 |
| GET    | `/transactions/lists`              | Listado paginado con filtros.                |
| GET    | `/transactions/period`             | Por período o rango personalizado.           |
| GET    | `/transactions/balance`            | Ingresos, gastos y saldo.                    |
| GET    | `/transactions/summary/monthly`    | Totales del mes en curso.                    |
| GET    | `/transactions/export/excel`       | Exportar a Excel respetando los filtros.     |
| GET    | `/transactions/:id`                | Ver una transacción.                         |
| PUT    | `/transactions/update/:id`         | Editar.                                      |
| DELETE | `/transactions/delete/:id`         | Eliminar.                                    |

### Administración (`role: admin`)

| Método | Ruta                              | Descripción                            |
| ------ | --------------------------------- | -------------------------------------- |
| GET    | `/admin/users`                    | Listar usuarios.                       |
| GET    | `/admin/dashboard/:id`            | Datos y totales de un usuario.         |
| PUT    | `/admin/categories/:categoryId`   | Editar categoría de otro usuario.      |
| DELETE | `/admin/categories/:categoryId`   | Eliminar categoría de otro usuario.    |
| PUT    | `/admin/transactions/:id`         | Editar transacción de otro usuario.    |
| DELETE | `/admin/transactions/:id`         | Eliminar transacción de otro usuario.  |

Para convertir a un usuario en administrador hay que cambiar su campo `role` a
`admin` directamente en la base de datos (no existe endpoint para hacerlo).

## Seguridad

- Contraseñas con bcrypt (coste 12) y nunca incluidas en las respuestas.
- JWT con expiración; al cambiar la contraseña se invalidan los tokens previos.
- El rol se lee de la base de datos en cada petición, no del token.
- `helmet`, límite de peticiones (`express-rate-limit`), saneado de operadores de
  Mongo y límite de tamaño del cuerpo de las peticiones.
- Los errores no exponen trazas en producción.
- Los `.env` están fuera del control de versiones (`.gitignore`).

## Despliegue

Dos opciones:

1. **Un solo servicio** (por ejemplo Render sirviendo también el frontend):
   `SERVE_FRONTEND=true` y `npm run build && npm start` desde la raíz. El
   frontend usa rutas relativas (`/api/v1`).
2. **Servicios separados** (frontend en Netlify/Vercel, API en Render):
   define `VITE_API_URL` con la URL pública de la API, añade el dominio del
   frontend a `CORS_ORIGINS` y deja `COOKIE_SAMESITE=none`.

## Licencia

MIT (ver `LICENSE`).
