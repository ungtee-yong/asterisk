FROM node:18-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    libmysqlclient-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /workspace

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm ci --only=production

# Copy application code
COPY config/ ./config/
COPY database/ ./database/
COPY agi_scripts/ ./agi_scripts/
COPY test/ ./test/
COPY *.js ./

# Create logs directory
RUN mkdir -p logs

# Set permissions
RUN chmod +x agi_scripts/call_routing.js

# Create non-root user
RUN useradd -m -u 1000 callcenter && \
    chown -R callcenter:callcenter /workspace

USER callcenter

# Expose ports
EXPOSE 3000 4573

# Default command
CMD ["node", "index.js"]