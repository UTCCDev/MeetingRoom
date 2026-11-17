# Next.js app image; runs next to Laradock (see docker-compose.yml).
# bookworm ships OpenSSL 3 (Ensure your Prisma version supports Prisma 4.7+ / 5+)
FROM node:20-bookworm-slim AS build
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci
COPY . .

# prebuild regenerates lib/room-photo-files.json from public/room-photos.
RUN npx prisma generate && npm run build && npm prune --omit=dev

FROM node:20-bookworm-slim
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/next.config.js ./

EXPOSE 3001

# Apply pending migrations, then serve on 3001 (package.json "start").
CMD ["sh", -c, "npx prisma migrate deploy && npm start"]