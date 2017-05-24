FROM node:7
ADD . /opt/gateway
WORKDIR /opt/gateway
RUN npm install --production
EXPOSE 3000
CMD node index.js