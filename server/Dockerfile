# Production Dockerfile for The Verity Backend
# Includes both Node.js (Express + Socket.IO) and .NET SDK (for real-time C# compilation)

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS dotnet-base

# Install Node.js 22, ffmpeg, and C++ build tools for native modules (better-sqlite3)
RUN apt-get update && apt-get install -y curl build-essential python3 make g++ sqlite3 libsqlite3-dev ffmpeg && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Cache buster to ensure Render compiles fresh binaries for Linux
ARG BUILD_ID=2026-09-20-v2

# Install server dependencies and compile native binaries for Linux
COPY package*.json ./
RUN npm install --omit=dev && npm rebuild better-sqlite3 --build-from-source

# Copy server application code
COPY . ./

# Run container as a non-root user with writable working directories
RUN groupadd --system verity && \
    useradd --system --gid verity --create-home verity && \
    mkdir -p /app/temp_submissions /app/uploads && \
    chown -R verity:verity /app

USER verity

# Environment configuration
ENV PORT=3001
ENV NODE_ENV=production
ENV HOME=/home/verity

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -fsS http://127.0.0.1:${PORT}/health || exit 1

CMD ["node", "server.js"]
