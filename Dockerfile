# Self-hosted Questlog: the same Worker the Cloudflare deploy uses, run by workerd (wrangler dev) with D1 on a volume.
FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV CI=1 WRANGLER_SEND_METRICS=false
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && rm -f dist/questlog/.dev.vars
EXPOSE 8787
VOLUME /data
CMD ["sh", "scripts/serve.sh"]
