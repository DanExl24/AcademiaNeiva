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

RUN apk add --no-cache tzdata python3 py3-pip make g++ && \
    pip install PyMuPDF psycopg2-binary python-dotenv --break-system-packages && \
    ln -sf /usr/bin/python3 /usr/bin/python

WORKDIR /app

COPY package*.json ./

RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --prefer-offline --no-audit && mkdir -p /app/uploads

COPY --from=builder /app/dist ./dist

# Copiar scripts de procesamiento Python
COPY scripts ./scripts

# Copiar archivos SQL a dist/ donde el código compilado los busca (usando __dirname)
COPY src/config/auth.migration.sql ./dist/config/auth.migration.sql
COPY src/migrations ./dist/migrations
COPY src/seeds/dba_catalog.sql ./dist/seeds/dba_catalog.sql

EXPOSE 3000

CMD [ "node", "dist/server.js" ]