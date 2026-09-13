# =========================================================================
# Arogy AI Agent - Production Docker Container
# =========================================================================

FROM node:20-alpine

WORKDIR /app

# Install system dependencies
RUN apk add --no-cache python3 py3-pip curl

# Copy dependency manifests
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Copy application source code
COPY . .

# Set environment
ENV NODE_ENV=production
ENV PORT=5000
ENV AI_MODEL_PROVIDER=huggingface
ENV AI_MODEL_NAME=Qwen/Qwen3-14B

EXPOSE 5000

CMD ["node", "index.js"]
