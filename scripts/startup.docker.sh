#!/bin/bash -e
#start mongodb
/etc/init.d/mongod start

#compile code
tsc -p . || true

logFolder=($(cat conf/server.dev.json | jq -r '.paths.logPath'))

if [ -d "$logFolder" ]; then
    #NODE_ENV=dev nodemon --max-old-space-size=4096 --inspect=0.0.0.0:9929 ./bin/www --dockerIp=$DOCKERIP --dockerPort=$DOCKERPORT --dockerReport=$DOCKERREPORT --rootIp=$ROOTIP --sshUser=$SSHUSER --sshPass=$SSHPASS
    node --max-old-space-size=4096 ./bin/www --dockerIp=$DOCKERIP --dockerPort=$DOCKERPORT --dockerReport=$DOCKERREPORT --rootIp=$ROOTIP --sshUser=$SSHUSER --sshPass=$SSHPASS
else
    ./scripts/setup.sh
    node --max-old-space-size=4096 ./bin/www --dockerIp=$DOCKERIP --dockerPort=$DOCKERPORT --dockerReport=$DOCKERREPORT --rootIp=$ROOTIP --sshUser=$SSHUSER --sshPass=$SSHPASS
fi
