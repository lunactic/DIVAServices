#!/bin/bash -e
#start mongodb
/etc/init.d/mongod start

#compile code
#tsc -p . || true

logFolder=($(cat conf/server.dev.json | jq -r '.paths.logPath'))

if [ -d "$logFolder" ]; then
    node --max-old-space-size=4096 ./bin/www --dockerIp=$DOCKERIP --dockerPort=$DOCKERPORT --dockerReport=$DOCKERREPORT --rootIp=$ROOTIP --sshUser=$SSHUSER --sshPass=$SSHPASS
else
    ./scripts/setup.sh
    node --max-old-space-size=4096 ./bin/www --dockerIp=$DOCKERIP --dockerPort=$DOCKERPORT --dockerReport=$DOCKERREPORT --rootIp=$ROOTIP --sshUser=$SSHUSER --sshPass=$SSHPASS
fi
