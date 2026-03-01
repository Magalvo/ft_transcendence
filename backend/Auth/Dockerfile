FROM debian:latest

RUN apt-get update && apt-get upgrade -y
RUN apt-get install nodejs npm -y
RUN apt-get install sqlite3 -y


WORKDIR /Auth

COPY ./ .

RUN npm install

RUN npm rebuild

CMD ["npm", "run", "dev"]


EXPOSE 3000  
