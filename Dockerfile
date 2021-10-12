FROM node:alpine3.14

WORKDIR /usr/src/app
ENV PORT 5000

COPY package*.json ./
RUN apk add --no-cache --virtual .gyp \
        python2 \
        make \
        g++ \
        ghostscript \
        ghostscript-dev \
        imagemagick
ENV GS4JS_HOME /usr/lib
RUN npm install \
    && apk del .gyp

ENTRYPOINT [ "npm", "run", "start" ]