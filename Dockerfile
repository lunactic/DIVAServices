FROM node:8.2

# Force git to use HTTPS transport
RUN git config --global url.https://github.com/.insteadOf git://github.com/

#Install APT packages
RUN echo "deb http://repo.mongodb.org/apt/debian jessie/mongodb-org/3.4 main" | tee /etc/apt/sources.list.d/mongodb-org-3.4.list $$ \
    echo "deb http://pkg.adfinis-sygroup.ch/dotdeb/ jessie all" | tee /etc/apt/sources.list.d/dotdeb.list && \
    apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install --force-yes -y jq redis-server mongodb-org


# Install application dependencies (copie from node:6.11-onbuild)
RUN mkdir -p /code/conf
RUN mkdir /data
RUN npm install -g typings
# Install typescript globally so we can rebuild scripts upon startup
RUN npm install -g typescript 
RUN npm install -g nodemon
WORKDIR /code

ARG NODE_ENV
ENV NODE_ENV $NODE_ENV
ADD . /code
RUN apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv 0C49F3730359A14518585931BC711F9BA15703C6
RUN wget https://www.dotdeb.org/dotdeb.gpg && apt-key add dotdeb.gpg
#COPY Docker/mongod /etc/init.d/mongod
RUN chmod +x scripts/*
#RUN /etc/init.d/mongod start
COPY Docker/mongod /etc/init.d/mongod
RUN chmod +x /etc/init.d/mongod
RUN npm install
# Make sure we have some logs directory ready for use
RUN mkdir logs

# Setup proxy environment for runtime use (ie after build)
# REMOVE THIS PART IF YOU DO NOT NEED PROXY SUPPORT
#COPY Docker/etc_apt_apt.conf /etc/apt/apt.conf
#COPY Docker/etc_environment /etc/environment

# Change this according to the `server.*.json` content
EXPOSE 8080 9929
