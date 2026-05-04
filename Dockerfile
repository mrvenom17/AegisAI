FROM node:20-bookworm-slim AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci || npm install
COPY tsconfig.json ./
COPY src ./src
COPY policies ./policies
RUN npm run build

FROM node:20-bookworm-slim AS runner
ENV NODE_ENV=production \
    PORT=8080 \
    AEGIS_DB=/data/aegis.db
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/* && \
    mkdir -p /data && chown node:node /data
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev
COPY --from=builder /app/dist ./dist
COPY policies ./policies
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD curl -fsS http://127.0.0.1:8080/health || exit 1
CMD ["node", "dist/api/server.js"]
