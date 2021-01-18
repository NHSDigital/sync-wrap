FROM node:12.18.0-alpine3.10

WORKDIR /app

COPY package*.json ./

RUN npm install --only=production

COPY src/ ./
RUN chmod -R a+x /app

USER nobody

#EXPOSE 9000
CMD ["node", "--max-semi-space-size=32", "--max-heap-size=256", "main.js"]