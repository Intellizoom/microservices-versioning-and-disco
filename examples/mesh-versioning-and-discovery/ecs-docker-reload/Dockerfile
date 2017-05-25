FROM node:7

ADD . /opt/edr

WORKDIR /opt/edr

RUN npm i --production

ENTRYPOINT ["node", "index.js"]
