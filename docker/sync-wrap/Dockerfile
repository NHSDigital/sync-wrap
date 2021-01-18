FROM node:12.18.0-alpine3.10

WORKDIR /app

COPY package*.json ./

RUN npm install --only=production

COPY src/ ./
RUN chmod -R a+x /app

USER nobody

#EXPOSE 9000
CMD ["node", "--max-semi-space-size=64", "--max_old_space_size=256", "--trace-gc", "main.js"]