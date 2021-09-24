FROM node:alpine3.14

WORKDIR /usr/src/app
ENV PORT 5000

RUN apk add --no-cache imagemagick 
COPY package*.json ./
RUN npm install

ENTRYPOINT [ "npm", "run", "start" ]