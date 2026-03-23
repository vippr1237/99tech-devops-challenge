FROM node:20-alpine

# Install curl for health checks
RUN apk add --no-cache curl

WORKDIR /app
COPY package.json .
RUN npm install

COPY src ./src

# Add non-root user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodeuser -u 1001
USER nodeuser

EXPOSE 3000

CMD ["node", "src/index.js"]
