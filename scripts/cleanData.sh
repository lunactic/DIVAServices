#!/bin/bash -e

# print a nicely formated header
function header {
  echo ""
  echo "$(tput setaf 6)$1$(tput sgr0)"
  echo ""
}

header "cleaning folders"

imageFolder=($(cat conf/server.dev.json | jq -r '.paths.filesPath'))
rm -r ${imageFolder}/
resultsFolder=($(cat conf/server.dev.json | jq -r '.paths.resultsPath'))
rm -r ${resultsFolder}/

header "Creating Folders"
mkdir -p ${imageFolder}
mkdir -p ${resultsFolder}
mkdir -p ${imageFolder}/test/original

header "Creating Files"
imageInfoFile=($(cat conf/server.dev.json | jq -r '.paths.imageInfoFile'))
echo '[]' > ${imageInfoFile}