FROM node:20-alpine

# Install build dependencies for better-sqlite3 compilation
RUN apk add --no-cache python3 make g++ gcc

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Make start.sh executable
RUN chmod +x start.sh

# Expose port (Hugging Face default is 7860)
EXPOSE 7860

# Run startup script
CMD ["sh", "start.sh"]
