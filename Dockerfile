FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci 2>/dev/null || npm install
COPY src ./src
ENV NODE_ENV=production
EXPOSE 3331
CMD ["node", "src/server.js"]
