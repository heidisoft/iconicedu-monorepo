FROM node:20-alpine AS builder
WORKDIR /app
COPY . .
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile
RUN pnpm --filter api build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/package.json .
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3001
CMD ["node", "dist/main.js"]