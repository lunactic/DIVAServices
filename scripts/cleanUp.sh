#!/bin/bash -e

# print a nicely formated header
function header {
  echo ""
  echo "$(tput setaf 6)$1$(tput sgr0)"
  echo ""
}

header "cleaning folders"
imageFolder=($(cat conf/server.dev.json | jq -r '.paths.imageRootPath'))
rm -r ${imageFolder}/
jsonFolder=($(cat conf/server.dev.json | jq -r '.paths.jsonPath'))
rm -r ${jsonFolder}/
executableFolder=($(cat conf/server.dev.json | jq -r '.paths.executablePath'))
rm -r ${executableFolder}/

header "Creating Folders"
imageFolder=($(cat conf/server.dev.json | jq -r '.paths.imageRootPath'))
mkdir -p ${imageFolder}
jsonFolder=($(cat conf/server.dev.json | jq -r '.paths.jsonPath'))
mkdir -p ${jsonFolder}
executableFolder=($(cat conf/server.dev.json | jq -r '.paths.executablePath'))
mkdir -p ${executableFolder}
mkdir -p ${imageFolder}/test/original

header "Creating Files"
imageInfoFile=($(cat conf/server.dev.json | jq -r '.paths.imageInfoFile'))
#md5 hash for this test image: https://placeholdit.imgix.net/~text?txtsize=33&txt=This%20is%20a%20test&w=1024&h=768
echo '[ {"md5":"1e5300b94a45423592a0f9011a63ba2a", "file":"/data/images/test/original/input0.jpg", "collection":"test"} ]' > ${imageInfoFile}

servicesInfoFile=($(cat conf/server.dev.json | jq -r '.paths.servicesInfoFile'))
echo '{"services":[]}' > ${servicesInfoFile}

rootInfoFile=($(cat conf/server.dev.json | jq -r '.paths.rootInfoFile'))
echo "[]" > ${rootInfoFile}

swaggerInfoFile=($(cat conf/server.dev.json | jq -r '.paths.swaggerFile'))
cp conf/swagger.json ${swaggerInfoFile}

header "Copying Files"
cp /data/input0.jpg ${imageFolder}/test/original/