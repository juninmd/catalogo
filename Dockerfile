# Build stage
FROM node:20-slim AS builder
WORKDIR /app

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
# We skip 'pnpm run build' because it runs 'generate.mjs' which needs GH_TOKEN.
# The files are already generated and pushed to the repo by the other workflow.
RUN pnpm exec vitepress build docs

# Final stage
FROM nginx:alpine
COPY --from=builder /app/docs/.vitepress/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
