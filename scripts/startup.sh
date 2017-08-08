#!/bin/bash -e

logFolder=($(cat conf/server.dev.json | jq -r '.paths.logPath'))

if [ -d "$logFolder" ]; then
    node ./bin/www
else
    ./scripts/setup.sh
    node ./bin/www
fi