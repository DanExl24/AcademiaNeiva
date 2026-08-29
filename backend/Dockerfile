# STAGE 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN --mount=type=cache,target=/root/.npm \
    npm ci --prefer-offline --no-audit

COPY . .

RUN npm run build 

# STAGE 2: Runtime
FROM node:22-alpine AS runtime

RUN apk add --no-cache tzdata

WORKDIR /app

COPY package*.json ./

RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --prefer-offline --no-audit && mkdir -p /app/uploads

COPY --from=builder /app/dist ./dist

# Copiar archivos SQL a dist/ donde el código compilado los busca (usando __dirname)
COPY src/config/auth.migration.sql ./dist/config/auth.migration.sql
COPY src/migrations ./dist/migrations

EXPOSE 3000

CMD [ "node", "dist/server.js" ]