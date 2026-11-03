# ParametrIA

Monorepo de ParametrIA: frontend React/Vite en `frontend/` y API NestJS/Prisma en `backend/`.

## Desarrollo local

Requisitos: Node.js 20.6 o superior, npm y Docker Compose.

1. La configuración de desarrollo está en `.env`. Para regenerarla, copia `.env.example` y sustituye las contraseñas y la clave de cifrado.
2. Inicia PostgreSQL, Redis y MinIO:

   ```sh
   docker compose up -d
   ```

3. Inicializa la base de datos y los datos de demostración:

   ```sh
   npm --prefix backend run prisma:migrate:deploy
   npm --prefix backend run prisma:seed
   ```

Antes de iniciar la API para desarrollo, comprueba también que el esquema esté al día:

   ```sh
   npm --prefix backend run prisma:migrate:status
   npm --prefix backend run prisma:migrate:deploy
   ```

4. En terminales separadas, inicia la API y el frontend:

   ```sh
   npm --prefix backend run dev
   npm --prefix frontend run dev
   ```

Vite reenvía `/api` a NestJS en `localhost:3000`. El frontend utiliza la API real.

El acceso se realiza con correo y contraseña. El seed crea tres cuentas de demostración (`admin@parametria.edu`, `laura@parametria.edu` y `sofia@parametria.edu`); sus contraseñas locales se configuran mediante `DEMO_ADMIN_PASSWORD`, `DEMO_INSTRUCTOR_PASSWORD` y `DEMO_STUDENT_PASSWORD` en `.env`.

Los orígenes permitidos se configuran en `FRONTEND_ORIGINS` como lista separada por comas. `COOKIE_SECURE`, `COOKIE_SAME_SITE`, `COOKIE_DOMAIN`, `API_PREFIX`, `PORT`, secretos JWT, emisor/audiencia y expiraciones también se leen del entorno. En producción usa HTTPS, secretos independientes y `COOKIE_SECURE=true`.

El alta de usuarios y el restablecimiento de contraseñas encolan correos de enlaces de un solo uso, con hash en base de datos y vencimiento configurable mediante `PASSWORD_RESET_TTL_SECONDS` (por defecto, 30 minutos). BullMQ usa el Redis existente y el worker entrega los mensajes con reintentos. Configura `FRONTEND_URL`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` y, opcionalmente, `SMTP_CONNECTION_TIMEOUT_MS`, `SMTP_GREETING_TIMEOUT_MS` y `SMTP_SOCKET_TIMEOUT_MS` en `.env`. Sin SMTP configurado, el alta/restablecimiento falla explícitamente. Las cuentas demo se sincronizan con `DEMO_*_PASSWORD` al volver a ejecutar `npm --prefix backend run prisma:seed`.

El access token JWT se mantiene en memoria del navegador; el refresh token se entrega en cookie `HttpOnly`, se rota en cada renovación y su sesión se puede revocar. Las operaciones de escritura importantes requieren `Idempotency-Key`; `X-Request-ID` se registra y se devuelve para correlacionar logs y respuestas.

Las respuestas de la API incluyen `path` en el nivel superior del envelope para identificar la ruta HTTP que procesó la solicitud (sin query params). Las listas de proveedores, universidades, usuarios, aulas y evaluaciones usan paginación del servidor. Se consulta con `page` (desde 1) y `pageSize` (1–100); la respuesta de `data` contiene `items` y `pagination` (`page`, `pageSize`, `total`, `totalPages`).

## Migraciones de base de datos

Prisma Migrate provee un flujo versionado similar a Liquibase: cada cambio de esquema queda como SQL en `backend/prisma/migrations/` y Prisma registra su aplicación en `_prisma_migrations`. No edites migraciones ya aplicadas; crea una nueva por cada cambio:

```sh
npm --prefix backend run prisma:migrate -- --name nombre_del_cambio
```

En CI/producción y para aplicar migraciones ya creadas:

```sh
npm --prefix backend run prisma:migrate:deploy
npm --prefix backend run prisma:migrate:status
```

Las migraciones existentes se aplican en orden y conservan los datos salvo que el SQL de la migración indique explícitamente lo contrario.

El backend usa Vercel AI SDK Core (`generateObject`) y esquemas Zod dinámicos. Superadmin registra proveedores con Base URL y protocolo (`OPENAI_COMPATIBLE`, `ANTHROPIC` o `GEMINI`); el backend descubre los modelos en el endpoint del proveedor usando la credencial seleccionada, sin mantener un catálogo local. Cada aula guarda los identificadores de modelo elegidos y las secciones de reporte activas. Las referencias de campo insertadas en las instrucciones docentes se traducen en el backend sin alterar el esquema.

Los reportes incluyen una estructura académica protegida: ficha, tabla por criterio, resumen de cumplimiento por sección y condiciones mínimas, fortalezas, coherencia interna, trazabilidad bibliográfica y alertas prudentes de integridad, observaciones complementarias y conclusión (`CUMPLE`, `CUMPLE CON OBSERVACIONES POR SUBSANAR` o `NO CUMPLE`). Los campos dinámicos que configura la institución se agregan a esta estructura. La hora de revisión se fija en el servidor con zona `America/Lima`; el evaluador no puede inventarla. El análisis de citas se limita al documento entregado: no afirma plagio ni reemplaza la revisión humana o herramientas de similitud externas.

En **Panel docente → Reportes**, el instructor puede filtrar bajo demanda por curso, aula, nombre de estudiante, fechas y nombre del documento. Los resultados y el acceso a cada informe están restringidos por el backend a las aulas de ese instructor; cada reporte se consulta en una ruta independiente.

En Administración → **Instrucciones del sistema**, el superadministrador puede publicar una nueva versión de las instrucciones académicas globales o reactivar una versión anterior. Las versiones publicadas son inmutables: editar y guardar crea una versión nueva. Las evaluaciones conservan la relación con la versión que se usó. Las reglas técnicas de seguridad y el formato JSON estricto permanecen protegidos en el backend. Las claves, descripciones, tipos y propiedades de los campos activos del reporte se incorporan automáticamente a las instrucciones del modelo; el prompt global no necesita duplicarlos.

El estudiante compara la vista del Word original con el texto extraído que recibirá el evaluador antes de confirmar. ParametrIA no impone un límite de caracteres al texto; el archivo `.docx` sí está limitado a 15 MB y cada proveedor puede aplicar su propio límite de contexto. Al confirmar, la API responde `202 Accepted` y el trabajo se procesa en segundo plano con BullMQ/Redis; la reserva del intento y la aplicación del límite diario se serializan en PostgreSQL para evitar sobrepasarlo con envíos simultáneos. El estado se transmite al estudiante autenticado mediante WebSocket sobre Redis y mantiene la consulta periódica como respaldo. El estudiante puede volver a conectarse sin cancelar la operación. PostgreSQL conserva el estado asociado al estudiante. En desarrollo, la API incluye el worker cuando `RUN_EVALUATION_WORKER=true`. Para desplegar workers por separado, configura `RUN_EVALUATION_WORKER=false` en la API y ejecuta otra instancia con `RUN_EVALUATION_WORKER=true npm run start:worker`; ambas instancias deben compartir `DATABASE_URL`, `REDIS_URL`, `ENCRYPTION_KEY` y el almacenamiento de documentos. Al exceder el límite diario, el estudiante puede elegir proveedor, cargar los modelos con una clave temporal y continuar con BYOK.

En administración, los logos de proveedores pueden ser enlaces externos o imágenes guardadas en MinIO; las cuentas se desactivan sin borrar su historial. El panel docente permite crear cursos y aulas, gestionar credenciales, crear estudiantes o importarlos con la plantilla `.xlsx` descargable y matricularlos solo en aulas propias. La plantilla incluye una hoja de guía y los estudiantes reciben su enlace de configuración por correo. Las búsquedas de gestión se ejecutan bajo demanda y sus filtros se aplican en PostgreSQL.

## Nginx en producción

`nginx.conf` sirve el contenido compilado de `frontend/dist`, conserva las rutas de la SPA y reenvía `/api/` a un servicio Docker llamado `backend` en el puerto `3000`. En producción, monta `frontend/dist` en `/usr/share/nginx/html` y este archivo en `/etc/nginx/conf.d/default.conf`; conecta Nginx y la API a la misma red Docker y configura TLS en el balanceador o proxy HTTPS que corresponda. Ajusta el nombre del upstream si el servicio de la API tiene otro nombre. El backend debe mantener `API_PREFIX=api`.

## Despliegue Docker en VPS

`docker-compose.prod.yml` construye las imágenes de migración, API/worker y frontend con las etiquetas de Docker Hub configuradas por `DOCKERHUB_NAMESPACE` e `IMAGE_TAG`. Aplica migraciones antes de iniciar la API, separa el worker de evaluaciones y mantiene PostgreSQL, Redis y MinIO en una red privada sin puertos publicados. Cloudflare Tunnel publica únicamente el servicio web. Configura el hostname público del túnel en Cloudflare para que apunte a `http://web:80`.

En el servidor, copia `.env.production.example` a `.env.production`, sustituye todos los valores `CHANGE_ME`, establece el dominio HTTPS real en `FRONTEND_URL` y `FRONTEND_ORIGINS`, y guarda el token del túnel en `secrets/cloudflared_token.txt`. Protege ambos archivos con permisos `600`; el directorio `secrets` debe tener permisos `700`. El archivo de token se monta como secreto y no debe guardarse en Git.

Antes de desplegar, autentícate en Docker Hub y construye/publica las tres imágenes:

```sh
docker login -u saithg04
docker build -f backend/Dockerfile --target migrator -t saithg04/parametria-migrate:latest .
docker build -f backend/Dockerfile --target runtime -t saithg04/parametria-api:latest .
docker build -f frontend/Dockerfile -t saithg04/parametria-web:latest .
docker push saithg04/parametria-migrate:latest
docker push saithg04/parametria-api:latest
docker push saithg04/parametria-web:latest
```

Desde la raíz del repositorio en el VPS:

```sh
docker compose --env-file .env.production -f docker-compose.prod.yml config --quiet
docker compose --env-file .env.production -f docker-compose.prod.yml pull
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
```

El primer despliegue necesita una cuenta administradora inicial. Con `SEED_MODE=admin-only` (predeterminado), una sola vez, después de que PostgreSQL y las migraciones estén listas, ejecuta `docker compose --env-file .env.production -f docker-compose.prod.yml run --rm migrate node --import tsx prisma/seed.ts`; el seed crea únicamente `admin@parametria.edu` y la organización ParametrIA, sin usuarios ni aulas de demostración. Mantén `DEMO_ADMIN_PASSWORD` privada y cámbiala después del primer inicio de sesión. El modo opcional `SEED_MODE=demo` conserva los datos de prueba y requiere también `DEMO_INSTRUCTOR_PASSWORD` y `DEMO_STUDENT_PASSWORD`. Conserva una copia segura de `.env.production` —especialmente `ENCRYPTION_KEY`— y de los volúmenes persistentes; cambiar la clave de cifrado impediría recuperar las credenciales de proveedores ya guardadas.

## Servicios locales

| Servicio | Dirección local | Puerto interno Docker |
|---|---|---:|
| PostgreSQL | `localhost:15432` | 5432 |
| Redis | `localhost:16379` | 6379 |
| MinIO API | `localhost:19000` | 9000 |
| MinIO Console | `localhost:19001` | 9001 |

MinIO crea el bucket configurado en `MINIO_BUCKET` cuando se guarda el primer documento. Las cargas no envían una cabecera de cifrado SSE-KMS/SSE-S3, que requiere configuración adicional en algunos servidores S3/MinIO; si necesitas cifrado de documentos en reposo, configúralo en el servidor o en el bucket. Las API keys de proveedores sí se cifran en la aplicación antes de guardarse. Las credenciales y URLs están en `.env`, que no se debe subir al repositorio.
