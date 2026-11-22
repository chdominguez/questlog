FROM litestream/litestream:0.5.18@sha256:513bff62a88fc0c86c73d27333c41c54c89fe890a7c32a551600adff9309b11b AS litestream

FROM node:24-bookworm-slim
WORKDIR /app
COPY --from=litestream /usr/local/bin/litestream /usr/local/bin/litestream
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG COMMIT=dev
RUN npm run build
COPY litestream.yml /etc/litestream.yml
ENV DB_PATH=/data/questlog.db HOST=0.0.0.0
EXPOSE 8787
VOLUME /data
ENTRYPOINT ["scripts/entrypoint.sh"]
