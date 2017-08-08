FROM node:8.2

# Force git to use HTTPS transport
RUN git config --global url.https://github.com/.insteadOf git://github.com/

# Install application dependencies (copie from node:6.11-onbuild)
RUN mkdir -p /code/conf
RUN mkdir /data
RUN npm install -g typings
# Install typescript globally so we can rebuild scripts upon startup
RUN npm install -g typescript 

WORKDIR /code
ARG NODE_ENV
ENV NODE_ENV $NODE_ENV
#ADD . /code
# Install extra tools
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y \
  jq

RUN npm install
# Make sure we have some logs directory ready for use
RUN mkdir logs

# Setup proxy environment for runtime use (ie after build)
# REMOVE THIS PART IF YOU DO NOT NEED PROXY SUPPORT
#COPY Docker/etc_apt_apt.conf /etc/apt/apt.conf
#COPY Docker/etc_environment /etc/environment


# Change this according to the `server.*.json` content
EXPOSE 8080

CMD [ "npm", "start" ]
