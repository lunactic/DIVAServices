#!/bin/bash -e

# print a nicely formated header
function header {
  echo ""
  echo "$(tput setaf 6)$1$(tput sgr0)"
  echo ""
}

header "cleaning folders"
imageFolder=($(cat conf/server.dev.json | jq -r '.paths.imageRootPath'))
rm -r $imageFolder/
jsonFolder=($(cat conf/server.dev.json | jq -r '.paths.jsonPath'))
rm -r $jsonFolder/
executableFolder=($(cat conf/server.dev.json | jq -r '.paths.executablePath'))
rm -r $executableFolder/

header "Creating Folders"
imageFolder=($(cat conf/server.dev.json | jq -r '.paths.imageRootPath'))
mkdir -p $imageFolder
jsonFolder=($(cat conf/server.dev.json | jq -r '.paths.jsonPath'))
mkdir -p $jsonFolder
executableFolder=($(cat conf/server.dev.json | jq -r '.paths.executablePath'))
mkdir -p $executableFolder


header "Creating Files"
imageInfoFile=($(cat conf/server.dev.json | jq -r '.paths.imageInfoFile'))
echo "[]" > $imageInfoFile

statisticsFile=($(cat conf/server.dev.json | jq -r '.paths.statisticsFile'))
echo "[]" > $statisticsFile

servicesInfoFile=($(cat conf/server.dev.json | jq -r '.paths.servicesInfoFile'))
echo '{"services":[]}' > $servicesInfoFile

rootInfoFile=($(cat conf/server.dev.json | jq -r '.paths.rootInfoFile'))
echo "[]" > $rootInfoFile