# Use Node 20 for better Remix/Vite compatibility
FROM node:20-alpine
RUN apk add --no-cache openssl

WORKDIR /app
ENV NODE_ENV=production

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy everything else
COPY . .

# IMPORTANT: Generate Prisma Client and Build the app NOW
RUN npx prisma generate
RUN npm run build

# Use shell execution to ensure the migration-to-server handoff works
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]