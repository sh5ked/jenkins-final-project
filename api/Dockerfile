FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev

COPY . .

ARG BUILD_NUMBER=local
ARG GIT_COMMIT=local

ENV BUILD_NUMBER=$BUILD_NUMBER
ENV GIT_COMMIT=$GIT_COMMIT

EXPOSE 3000

CMD ["node", "app.js"]