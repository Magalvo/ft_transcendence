FROM debian:latest

RUN apt-get update && apt-get upgrade -y
RUN apt-get install nodejs npm -y
RUN apt-get install sqlite3 -y


WORKDIR /frontend

COPY ./ .

RUN npm install --legacy-peer-deps

CMD ["npm", "run", "dev", "--", "host"]

EXPOSE 5173
