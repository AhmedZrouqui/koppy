# Use Node 20 (Better compatibility for Remix/Vite)
FROM node:20-alpine
RUN apk add --no-cache openssl

WORKDIR /app
ENV NODE_ENV=production

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy app files
COPY . .

# IMPORTANT: Generate Prisma client DURING build
RUN npx prisma generate

# Build the app
RUN npm run build

# Start with a shell-safe command
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]