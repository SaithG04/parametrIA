FROM node:22-alpine AS builder

WORKDIR /app/backend
RUN apk add --no-cache openssl
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --no-audit --no-fund --fetch-retries=5 --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=120000
COPY backend/prisma ./prisma
COPY backend/src ./src
COPY backend/tsconfig.json backend/nest-cli.json ./
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build \
    node ./node_modules/prisma/build/index.js generate \
    && ./node_modules/.bin/tsc -p tsconfig.json

FROM builder AS migrator
ENV NODE_ENV=production
USER node
CMD ["node", "./node_modules/prisma/build/index.js", "migrate", "deploy"]

FROM node:22-alpine AS production-dependencies
WORKDIR /app/backend
RUN apk add --no-cache openssl
COPY backend/package.json backend/package-lock.json ./
COPY backend/prisma ./prisma
RUN npm ci --omit=dev --no-audit --no-fund --fetch-retries=5 --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=120000

FROM node:22-alpine AS runtime
WORKDIR /app/backend
ENV NODE_ENV=production
RUN apk add --no-cache openssl
COPY --from=production-dependencies --chown=node:node /app/backend/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/backend/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=node:node /app/backend/dist ./dist
COPY --from=builder --chown=node:node /app/backend/prisma ./prisma
USER node
EXPOSE 3000
CMD ["node", "dist/src/main.js"]
