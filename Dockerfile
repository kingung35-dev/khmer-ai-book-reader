# Use official Node.js LTS slim Debian image
FROM node:20-bookworm-slim

# Install poppler-utils (pdftoppm) and Tesseract OCR with Khmer language data
RUN apt-get update && apt-get install -y --no-install-recommends \
    poppler-utils \
    tesseract-ocr \
    tesseract-ocr-khm \
    tesseract-ocr-eng \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy dependency definitions
COPY package*.json ./

# Install production dependencies
RUN npm ci --omit=dev || npm install --omit=dev

# Copy application source code
COPY . .

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV ENABLE_OCR=true
ENV TESSERACT_PATH=/usr/bin/tesseract
ENV PDFTOPPM_PATH=/usr/bin/pdftoppm
ENV OCR_LANGUAGES=khm+eng

# Expose port (Render/Railway sets PORT dynamically)
EXPOSE 3000

# Start server
CMD ["node", "server.js"]
