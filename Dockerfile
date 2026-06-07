FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --production=false
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

FROM node:20-alpine

LABEL maintainer="Segnals <support@segnals.com>"
LABEL org.opencontainers.image.title="Segnals MCP Server"
LABEL org.opencontainers.image.description="Manage algorithmic trading bots via AI agents"
LABEL org.opencontainers.image.url="https://github.com/segnals/segnals-mcp"
LABEL org.opencontainers.image.source="https://github.com/segnals/segnals-mcp"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.version="0.1.0"

WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY --from=builder /app/dist ./dist/
COPY docs/ ./docs/
COPY AGENTS.md README.md LICENSE llms.txt ./

# API key must be provided at runtime:
#   docker run -e SEGNALS_API_KEY=sk_live_... ghcr.io/segnals/mcp
ENTRYPOINT ["node", "dist/index.js"]
