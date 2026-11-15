FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build
ENV DB_PATH=/data/questlog.db HOST=0.0.0.0
EXPOSE 8787
VOLUME /data
CMD ["npm", "start"]
