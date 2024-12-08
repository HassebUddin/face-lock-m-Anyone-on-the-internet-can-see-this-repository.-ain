FROM node:18-alpine

WORKDIR /app

COPY Backend/package.json ./
COPY Backend/package-lock.json ./

RUN npm install

COPY Backend .

EXPOSE 5000

CMD ["npm", "run", "dev"]