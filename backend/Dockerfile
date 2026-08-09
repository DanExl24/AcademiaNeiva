# STAGE 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm ci --include=dev

COPY . .

RUN npm run build 

# STAGE 2: Runtime
FROM node:22-alpine AS runtime

RUN apk add --no-cache tzdata

WORKDIR /app

COPY package*.json ./

COPY --from=builder /app/dist ./dist

# Copiar archivos SQL que son leídos en tiempo de ejecución por el seed y las migraciones
COPY src/config/auth.migration.sql ./src/config/auth.migration.sql
COPY src/migrations ./src/migrations

RUN npm ci --omit=dev && mkdir -p /app/uploads

EXPOSE 3000

CMD [ "node", "dist/server.js" ]