#!/bin/bash -e

#start mongodb
/etc/init.d/mongod start

#compile code
tsc -p . || true

logFolder=($(cat conf/server.dev.json | jq -r '.paths.logPath'))

if [ -d "$logFolder" ]; then
    node ./bin/www
else
    ./scripts/setup.sh
    node ./bin/www
fi
