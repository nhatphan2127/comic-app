FROM node:22-bookworm-slim

WORKDIR /app

RUN mkdir -p /app/data /app/storage /app/logs \
  && chown -R node:node /app

COPY --chown=node:node package.json package-lock.json ./
USER node
RUN npm ci --omit=dev

COPY --chown=node:node src ./src

ENV NODE_ENV=production
EXPOSE 5000

CMD ["node", "src/server.js"]
