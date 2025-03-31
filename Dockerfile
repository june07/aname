FROM node:lts

RUN mkdir -p /usr/src/node-app && chown -R node:node /usr/src/node-app

WORKDIR /usr/src/node-app

COPY package.json package-lock.json ./

RUN chown -R node:node .

USER root

RUN npm ci

COPY --chown=node:node . .

EXPOSE 3000
