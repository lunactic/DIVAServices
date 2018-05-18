FROM node:8.10.0

# Force git to use HTTPS transport
RUN git config --global url.https://github.com/.insteadOf git://github.com/

#Install APT packages
RUN apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv 2930ADAE8CAF5059EE73BB4B58712A2291FA4AD5
RUN echo "deb http://repo.mongodb.org/apt/debian jessie/mongodb-org/3.6 main" | tee /etc/apt/sources.list.d/mongodb-org-3.6.list
RUN curl -s http://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add -
RUN echo "deb http://dl.yarnpkg.com/debian/ stable main" | tee /etc/apt/sources.list.d/yarn.list
RUN apt-get update
RUN DEBIAN_FRONTEND=noninteractive apt-get install --force-yes -y jq redis-server mongodb-org yarn

RUN mkdir -p /code/conf
RUN mkdir /data
RUN yarn global add typings
# Install typescript globally so we can rebuild scripts upon startup
RUN yarn global add typescript 
RUN yarn global add nodemon
WORKDIR /code

ARG NODE_ENV
ENV NODE_ENV $NODE_ENV
RUN apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv 0C49F3730359A14518585931BC711F9BA15703C6
RUN wget https://www.dotdeb.org/dotdeb.gpg && apt-key add dotdeb.gpg
#COPY Docker/mongod /etc/init.d/mongod
#RUN chmod +x scripts/*
#RUN /etc/init.d/mongod start
#COPY Docker/mongod /etc/init.d/mongod
#RUN chmod +x /etc/init.d/mongod
RUN yarn install
# Make sure we have some logs directory ready for use
RUN mkdir logs

# Setup proxy environment for runtime use (ie after build)
# REMOVE THIS PART IF YOU DO NOT NEED PROXY SUPPORT
#COPY Docker/etc_apt_apt.conf /etc/apt/apt.conf
#COPY Docker/etc_environment /etc/environment

# Change this according to the `server.*.json` content
EXPOSE 8080 9929
