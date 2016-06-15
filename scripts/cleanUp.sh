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
mkdir -p $imageFolder/test/original

header "Creating Files"
imageInfoFile=($(cat conf/server.dev.json | jq -r '.paths.imageInfoFile'))
echo '[ {"md5":"4adddfaa693b184d675d61d21efda43c", "file":"/data/images/test/original/input0.png", "collection":"test"} ]' > $imageInfoFile

servicesInfoFile=($(cat conf/server.dev.json | jq -r '.paths.servicesInfoFile'))
echo '{"services":[]}' > $servicesInfoFile

rootInfoFile=($(cat conf/server.dev.json | jq -r '.paths.rootInfoFile'))
echo "[]" > $rootInfoFile

header "Copying Files"
cp /data/input0.png $imageFolder/test/original/