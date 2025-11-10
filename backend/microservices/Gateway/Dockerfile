FROM debian:latest

RUN apt-get update && apt-get upgrade -y
RUN apt-get install nodejs npm -y
RUN apt-get install sqlite3 -y


WORKDIR /apiGateway

COPY ./ .

RUN npm install

CMD ["npm", "run", "start"]


EXPOSE 333  