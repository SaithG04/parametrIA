# Registry Docker privado y CI/CD de ParametrIA

Esta guía propone migrar el flujo manual actual de Docker Hub a un registry propio en el VPS y automatizar build, publicación y despliegue al integrar cambios en `master`. No asume que el registry o el workflow ya estén instalados.

## Diseño recomendado

- Hostname dedicado, por ejemplo `registry.tudominio.com`, con DNS apuntando al VPS.
- Registry OCI Distribution (`registry:2`) con almacenamiento persistente.
- TLS automático con Caddy o un proxy HTTPS mantenido. Publicar `443` (y `80` solo para emisión/renovación ACME); **no exponer el puerto 5000**.
- Autenticación `htpasswd` fuerte. No habilitar escritura anónima.
- CI publica imágenes etiquetadas con el SHA completo del commit; `latest` puede mantenerse solo como comodidad, no como selector de producción.
- VPS descarga exclusivamente las imágenes por SHA y ejecuta Compose después de validar la configuración y las migraciones.
- GitHub Actions usa secretos y una clave SSH dedicada. No colocar tokens, claves privadas, `.env.production` ni hashes de autenticación en Git.

Para un registry Docker Distribution básico, las credenciales `htpasswd` no proporcionan permisos finos por repositorio ni separación estricta push/pull. Si se necesita RBAC real o varios equipos, usar Harbor en vez de exponer un registry básico.

## 1. DNS, firewall y TLS

1. Crear un registro DNS `A`/`AAAA` para el hostname del registry. Si se usa Cloudflare, mantener ese hostname en modo DNS-only salvo que se haya validado explícitamente el soporte del proxy para tráfico Registry V2 y transferencias grandes.
2. Permitir en el firewall solo SSH administrativo y los puertos públicos necesarios para HTTPS (`443`, más `80` para ACME si Caddy lo requiere). Mantener `5000/tcp` cerrado al exterior.
3. Configurar Caddy para terminar TLS y reenviar a `registry:5000` por una red Docker privada.
4. Verificar desde una máquina externa el certificado TLS y `https://registry.tudominio.com/v2/`. Un `401 Unauthorized` sin credenciales es normal y confirma que el endpoint exige autenticación.

## 2. Registry con almacenamiento y autenticación

Crear en el VPS un directorio restringido para datos y autenticación:

```sh
sudo install -d -m 0750 /opt/parametria-registry/data
sudo install -d -m 0700 /opt/parametria-registry/auth
```

Crear las credenciales de forma interactiva para no poner la contraseña en el historial:

```sh
sudo docker run --rm -it \
  -v /opt/parametria-registry/auth:/auth \
  --entrypoint htpasswd httpd:2-alpine \
  -B -c /auth/htpasswd ci-push
sudo chmod 0600 /opt/parametria-registry/auth/htpasswd
```

Usa una contraseña aleatoria larga y guárdala en un gestor de secretos. El registry y Caddy pueden declararse en un Compose separado (por ejemplo, `/opt/parametria-registry/compose.yml`), con una red privada compartida:

```yaml
services:
  registry:
    image: registry:2
    restart: unless-stopped
    environment:
      REGISTRY_AUTH: htpasswd
      REGISTRY_AUTH_HTPASSWD_REALM: ParametrIA Registry
      REGISTRY_AUTH_HTPASSWD_PATH: /auth/htpasswd
      REGISTRY_STORAGE_FILESYSTEM_ROOTDIRECTORY: /var/lib/registry
      REGISTRY_STORAGE_DELETE_ENABLED: "true"
    volumes:
      - /opt/parametria-registry/data:/var/lib/registry
      - /opt/parametria-registry/auth:/auth:ro
    expose:
      - "5000"
    networks:
      - registry-private

  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /opt/parametria-registry/Caddyfile:/etc/caddy/Caddyfile:ro
      - /opt/parametria-registry/caddy-data:/data
      - /opt/parametria-registry/caddy-config:/config
    networks:
      - registry-private

networks:
  registry-private:
    name: parametria-registry-private
```

`Caddyfile`:

```text
registry.tudominio.com {
    encode zstd gzip
    reverse_proxy registry:5000
}
```

Revisar el Compose, iniciar y verificar:

```sh
cd /opt/parametria-registry
sudo docker compose -f compose.yml config --quiet
sudo docker compose -f compose.yml up -d
sudo docker compose -f compose.yml ps
curl -i https://registry.tudominio.com/v2/
```

En el Compose real, fijar versiones/digests de las imágenes base y diseñar el almacenamiento/backups para el tamaño esperado. Probar autenticación con `docker login registry.tudominio.com`; usar `--password-stdin` en scripts. No ejecutar el `docker login` con contraseña como argumento.

### Usuarios y credenciales

La autenticación `htpasswd` del Registry V2 no separa permisos. Si se agrega un usuario CI distinto del usuario de operación, ambos siguen teniendo permisos de push/pull sobre el registry. Considerar Harbor para crear una robot account con push para CI y credenciales pull-only en VPS. Rotar credenciales ante cualquier exposición.

## 3. Preparar ParametrIA para consumir el registry

El Compose de producción construye nombres con:

```text
${DOCKERHUB_NAMESPACE:-saithg04}/parametria-api:${IMAGE_TAG:-latest}
${DOCKERHUB_NAMESPACE:-saithg04}/parametria-migrate:${IMAGE_TAG:-latest}
${DOCKERHUB_NAMESPACE:-saithg04}/parametria-web:${IMAGE_TAG:-latest}
```

Configurar en el `.env.production` **privado del VPS**:

```dotenv
DOCKERHUB_NAMESPACE=registry.tudominio.com/parametria
IMAGE_TAG=sha-a-configurar
```

Así las referencias resultan `registry.tudominio.com/parametria/parametria-api:<tag>` (y equivalentes de migrador y web). No guardar `.env.production` en el repositorio. Antes de automatizar, probar manualmente un login, `pull`, `config --quiet` y despliegue de una versión etiquetada.

En el VPS, autenticar Docker con la cuenta de solo lectura (Harbor recomendado) para que `docker compose pull` acceda al registry. Evitar imprimir el archivo de credenciales Docker o exponerlo dentro de logs. El usuario SSH de despliegue necesita ejecutar Docker Compose, lo que equivale a privilegios root en el host; proteger la clave y limitar quién puede usarla.

## 4. Branching acordado

El estado inicial se deja en `master`. Después:

```sh
git switch master
git pull --ff-only
git switch -c develop
git push -u origin develop
```

- Crear `feature/<tema>` desde `develop`; abrir PR de vuelta a `develop`.
- Integrar y probar el conjunto en `develop`.
- Abrir PR de `develop` a `master` para release. Solo el push/merge a `master` activa el despliegue de producción.
- Mantener branch protection, PR requerido y checks obligatorios en `master`.
- Hotfixes pueden salir de `master`, desplegarse tras validación y luego integrarse de vuelta a `develop`.

## 5. Secrets y preparación de GitHub Actions

Crear un GitHub Environment llamado `production`, habilitar aprobación manual si está disponible y guardar sus secretos:

| Secret | Contenido |
|---|---|
| `REGISTRY_HOST` | Hostname sin `https://`, por ejemplo `registry.tudominio.com` |
| `REGISTRY_USERNAME` | Usuario/robot de push del registry |
| `REGISTRY_PASSWORD` | Token/contraseña de push |
| `VPS_HOST` | IP o hostname del VPS |
| `VPS_USER` | Usuario SSH dedicado a despliegues |
| `VPS_SSH_KEY` | Clave privada de despliegue, formato OpenSSH |
| `VPS_KNOWN_HOSTS` | Línea `known_hosts` verificada fuera del workflow |
| `VPS_DEPLOY_PATH` | Ruta absoluta al checkout de ParametrIA en el VPS |

No usar `ssh-keyscan` dentro de cada ejecución como única verificación del host: el fingerprint debe fijarse y verificarse por un canal confiable. No cargar la clave privada en el repositorio ni imprimirla. Conceder `GITHUB_TOKEN` solo `contents: read`.

## 6. Workflow de build y publicación

El siguiente workflow ilustra el pipeline. Crear `.github/workflows/production.yml` cuando DNS, registry, secrets y checkout del VPS estén preparados. Antes de activarlo, revisar las versiones de actions que usa el equipo y, preferiblemente, fijarlas a SHA completo tras validar su origen.

```yaml
name: Build and deploy production

on:
  push:
    branches: [master]
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: parametria-production
  cancel-in-progress: false

jobs:
  publish:
    runs-on: ubuntu-latest
    environment: production
    outputs:
      image_tag: ${{ steps.meta.outputs.image_tag }}
    steps:
      - uses: actions/checkout@v4

      - id: meta
        run: echo "image_tag=sha-${GITHUB_SHA}" >> "$GITHUB_OUTPUT"

      - uses: docker/setup-buildx-action@v3

      - name: Login to private registry
        env:
          REGISTRY_HOST: ${{ secrets.REGISTRY_HOST }}
          REGISTRY_USERNAME: ${{ secrets.REGISTRY_USERNAME }}
          REGISTRY_PASSWORD: ${{ secrets.REGISTRY_PASSWORD }}
        run: |
          printf '%s' "$REGISTRY_PASSWORD" |
            docker login "$REGISTRY_HOST" --username "$REGISTRY_USERNAME" --password-stdin

      - name: Build and push migration image
        uses: docker/build-push-action@v6
        with:
          context: .
          file: backend/Dockerfile
          target: migrator
          push: true
          tags: ${{ secrets.REGISTRY_HOST }}/parametria/parametria-migrate:${{ steps.meta.outputs.image_tag }}

      - name: Build and push API/worker image
        uses: docker/build-push-action@v6
        with:
          context: .
          file: backend/Dockerfile
          target: runtime
          push: true
          tags: ${{ secrets.REGISTRY_HOST }}/parametria/parametria-api:${{ steps.meta.outputs.image_tag }}

      - name: Build and push web image
        uses: docker/build-push-action@v6
        with:
          context: .
          file: frontend/Dockerfile
          push: true
          tags: ${{ secrets.REGISTRY_HOST }}/parametria/parametria-web:${{ steps.meta.outputs.image_tag }}

  deploy:
    needs: publish
    runs-on: ubuntu-latest
    environment: production
    steps:
      - name: Configure pinned SSH host and key
        env:
          VPS_HOST: ${{ secrets.VPS_HOST }}
          VPS_USER: ${{ secrets.VPS_USER }}
          VPS_SSH_KEY: ${{ secrets.VPS_SSH_KEY }}
          VPS_KNOWN_HOSTS: ${{ secrets.VPS_KNOWN_HOSTS }}
        run: |
          install -m 700 -d ~/.ssh
          printf '%s\n' "$VPS_SSH_KEY" > ~/.ssh/id_ed25519
          chmod 600 ~/.ssh/id_ed25519
          printf '%s\n' "$VPS_KNOWN_HOSTS" > ~/.ssh/known_hosts
          chmod 600 ~/.ssh/known_hosts

      - name: Deploy immutable image tag
        env:
          VPS_HOST: ${{ secrets.VPS_HOST }}
          VPS_USER: ${{ secrets.VPS_USER }}
          VPS_DEPLOY_PATH: ${{ secrets.VPS_DEPLOY_PATH }}
          IMAGE_TAG: ${{ needs.publish.outputs.image_tag }}
        run: |
          ssh "$VPS_USER@$VPS_HOST" \
            "cd '$VPS_DEPLOY_PATH' && IMAGE_TAG='$IMAGE_TAG' docker compose --env-file .env.production -f docker-compose.prod.yml config --quiet && IMAGE_TAG='$IMAGE_TAG' docker compose --env-file .env.production -f docker-compose.prod.yml pull migrate backend worker web && IMAGE_TAG='$IMAGE_TAG' docker compose --env-file .env.production -f docker-compose.prod.yml up -d migrate backend worker web && docker compose --env-file .env.production -f docker-compose.prod.yml ps"
```

### Antes de usar este ejemplo

1. El usuario VPS debe tener un checkout actualizado de `master` que contenga el Compose/Dockerfiles de la versión desplegada. En un flujo más robusto, CI entrega también el commit de infraestructura/Compose; validar que no se despliegue un Compose antiguo con imágenes nuevas.
2. Las rutas de imagen del workflow deben coincidir exactamente con `DOCKERHUB_NAMESPACE` configurado en el VPS. En este ejemplo, `DOCKERHUB_NAMESPACE=registry.tudominio.com/parametria`.
3. La cuenta de pull del VPS debe autenticarse previamente; la cuenta push vive solo en GitHub Secrets. Para separación real de permisos, emplear Harbor u otro registry con robot accounts/RBAC.
4. Añadir antes del deploy los tests/build de frontend (`npm ci`, `npm test`, `npm run build`) y build backend (`npm ci`, Prisma generate y `tsc` o `npm run build`). Si falla un check, no publicar ni desplegar.
5. Las acciones `@vN` son referencias legibles, no inmutables. Para endurecer supply chain, fijar cada action a un SHA completo verificado y automatizar actualizaciones controladas.
6. La etiqueta SHA impide que un build posterior reemplace silenciosamente la imagen referenciada por la versión en producción. Conservar tags desplegados y definir retención antes de instalar garbage collection.
7. El `docker compose up` inicia primero el migrador por las dependencias definidas en `docker-compose.prod.yml`. Revisar logs/exit code y health checks luego de migrar; ante error detener el rollout y restaurar o aplicar una migración correctiva. No borrar datos ni marcar una migración como aplicada manualmente.

## 7. Validación post-deploy y rollback

En el VPS:

```sh
cd /ruta/privada/parametria
docker compose --env-file .env.production -f docker-compose.prod.yml ps
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=100 migrate backend worker web
```

Verificar web healthy, API healthy, worker activo y conectividad desde worker al hostname del proveedor configurado. Ejecutar una evaluación de prueba controlada solo con una cuenta/documento de prueba y comprobar que el job queda `SUCCEEDED` y aparece el reporte. HTTP `200`/`202` por sí solo no confirma el éxito asíncrono.

Para volver a una imagen previa, hacer `up` con su `IMAGE_TAG` SHA previamente conocido solo si la versión anterior es compatible con el esquema actual. El rollback del contenedor no revierte automáticamente Prisma. Para cambios de base incompatibles se necesita un plan explícito de backup/restore o migración hacia delante; preferir cambios compatibles expand/contract.

## 8. Backups, limpieza y observabilidad del registry

- Hacer backup consistente del directorio de blobs del registry, conservarlo fuera del VPS y probar restauración.
- Supervisar espacio en disco, expiración TLS, uso de CPU/RAM, errores 401/5xx y salud de Docker.
- Activar limpieza de tags solo tras definir retención y preservar todas las imágenes que podrían requerirse para rollback.
- El garbage collector del Registry V2 requiere detener escrituras y ejecutar el comando de GC con seguridad; no borrar blobs directamente del filesystem mientras el registry sirve tráfico.
- Registrar quién publica y despliega. No registrar contraseñas, tokens, claves SSH, datos de `.env.production`, API keys de IA ni contenidos de documentos.
