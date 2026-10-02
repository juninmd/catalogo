# Build stage
FROM node:26-slim AS builder
WORKDIR /app

# Same pnpm version used to generate the lockfile; recent Node images omit Corepack.
RUN npm install --global pnpm@10.34.5

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
# Use the local public snapshot, or fetch it using an optional BuildKit secret.
# docker build --secret id=github_token,env=GH_TOKEN -t catalogo:local .
RUN --mount=type=secret,id=github_token \
    if [ -f /run/secrets/github_token ]; then export GH_TOKEN="$(cat /run/secrets/github_token)"; fi; \
    pnpm run build:site

# Final stage
FROM nginx:alpine
COPY --from=builder /app/docs/.vitepress/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
