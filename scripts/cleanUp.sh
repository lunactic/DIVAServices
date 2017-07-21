#!/bin/bash -e

# print a nicely formated header
function header {
  echo ""
  echo "$(tput setaf 6)$1$(tput sgr0)"
  echo ""
}

header "cleaning folders"

logFolder=($(cat conf/server.dev.json | jq -r '.paths.logPath'))
rm -r ${logFolder}/
imageFolder=($(cat conf/server.dev.json | jq -r '.paths.filesPath'))
rm -r ${imageFolder}/
jsonFolder=($(cat conf/server.dev.json | jq -r '.paths.jsonPath'))
rm -r ${jsonFolder}/
executableFolder=($(cat conf/server.dev.json | jq -r '.paths.executablePath'))
rm -r ${executableFolder}/
resultsFolder=($(cat conf/server.dev.json | jq -r '.paths.resultsPath'))
rm -r ${resultsFolder}/

header "Creating Folders"
imageFolder=($(cat conf/server.dev.json | jq -r '.paths.filesPath'))
mkdir -p ${imageFolder}
jsonFolder=($(cat conf/server.dev.json | jq -r '.paths.jsonPath'))
mkdir -p ${jsonFolder}
executableFolder=($(cat conf/server.dev.json | jq -r '.paths.executablePath'))
mkdir -p ${executableFolder}
mkdir -p ${resultsFolder}
mkdir -p ${logFolder}
mkdir -p ${imageFolder}/test/original

header "Creating Files"
imageInfoFile=($(cat conf/server.dev.json | jq -r '.paths.imageInfoFile'))
echo '[]' > ${imageInfoFile}

dataInfoFile=($(cat conf/server.dev.json | jq -r '.paths.dataInfoFile'))

servicesInfoFile=($(cat conf/server.dev.json | jq -r '.paths.servicesInfoFile'))
echo '{"services":[]}' > ${servicesInfoFile}

rootInfoFile=($(cat conf/server.dev.json | jq -r '.paths.rootInfoFile'))
echo "[]" > ${rootInfoFile}

swaggerInfoFile=($(cat conf/server.dev.json | jq -r '.paths.swaggerFile'))
cp conf/swagger.json ${swaggerInfoFile}
