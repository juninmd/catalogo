# Build stage
FROM node:20-slim AS builder
WORKDIR /app

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
# We don't run generate here because it's done by the other workflow and pushed to the repo
RUN pnpm run build

# Final stage
FROM nginx:alpine
# VitePress default output is docs/.vitepress/dist
COPY --from=builder /app/docs/.vitepress/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
