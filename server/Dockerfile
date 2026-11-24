# Multi-stage Dockerfile for AdaptIQ Server (Node.js 20)
FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./

# Development stage
FROM base AS development
RUN npm install
COPY . .
EXPOSE 5000
CMD ["npm", "run", "dev"]

# Production stage
FROM base AS production
RUN npm ci --omit=dev
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
