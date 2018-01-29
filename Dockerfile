FROM node:alpine
WORKDIR /usr/src/app
COPY package.json package-lock.json /usr/src/app/
RUN npm install
COPY index.js lib /usr/src/app/
CMD npm start
