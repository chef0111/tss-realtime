FROM oven/bun:1-alpine
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production
COPY src ./src
ENV NODE_ENV=production
EXPOSE 3331
CMD ["node", "--import", "tsx", "src/index.ts"]
