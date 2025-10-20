FROM python:3.9-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    libmysqlclient-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /workspace

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY config/ ./config/
COPY database/ ./database/
COPY agi_scripts/ ./agi_scripts/

# Set permissions
RUN chmod +x agi_scripts/call_routing.py

# Create non-root user
RUN useradd -m -u 1000 callcenter && \
    chown -R callcenter:callcenter /workspace

USER callcenter

# Default command
CMD ["python", "test_system.py"]