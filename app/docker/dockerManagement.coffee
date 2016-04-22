_             = require 'lodash'
archiver      = require 'archiver'
childProcess  = require 'child_process'
logger        = require '../logging/logger'
Docker        = require "dockerode"
fs            = require 'fs'
nconf         = require 'nconf'
path          = require 'path'
sequest         = require 'sequest'



dockerManagement = exports = module.exports = class DockerManagement
  @docker = new Docker({host: nconf.get('docker:host'), port: nconf.get('docker:port')})

  @buildImage: (inputFolder, imageName, callback) ->
    #create tar file
    output = fs.createWriteStream(inputFolder+path.sep+'archive.tar')
    archive = archiver('tar')
    self = @
    output.on 'close', () ->
      self.docker.buildImage(inputFolder+path.sep+'archive.tar', {t: imageName}, (err, response) ->
        if(err?)
          logger.log 'error', err
          callback err, null
        else
          logger.log 'info', response
          callback null, response
      )
    archive.pipe(output)
    archive.bulk([
      expand: true
      cwd: inputFolder+'/'
      src: ['*','**/*']
    ])
    archive.finalize()

  @createDockerFile: (algorithmInfos, outputFolder) ->
    content = "FROM " + algorithmInfos.base_image + "\n" +
      "MAINTAINER marcel.wuersch@unifr.ch\n" +
      "RUN apt-get update\n" +
      "RUN apt-get install wget\n" +
      "RUN apt-get install unzip\n"+
      "RUN mkdir /data\n"+
      "WORKDIR /data\n" +
      "COPY . .\n" +
      'RUN ["chmod", "+x", "./script.sh"]\n' +
      'RUN unzip algorithm.zip\n'
      #'ENTRYPOINT ["./script.sh"]'
    fs.writeFileSync(outputFolder + path.sep + 'Dockerfile', content)

  @createBashScript: (algorithmInfos, outputFolder) ->
    content = "#!/bin/sh\n"
    content += 'printf $1\n'
    content += 'printf $2\n'

    if(_.find(algorithmInfos.input,{'inputImage':{}})?)
      content += 'wget -O /data/inputImage.png $1\n'

    switch(algorithmInfos.language)
      when 'java'
        content += 'java -Djava.awt.headless=true -Xmx4096m -jar /data/' + algorithmInfos.executable + ' '
      when 'coffeescript'
        content += 'coffee ' + algorithmInfos.executable + ' '
    #input count starts with 4. Params 1,2,3 are fix used
    inputCount = 4
    for input, i  in algorithmInfos.input
      #check if needs to be rewritten
      key = _.keys(algorithmInfos.input[i])[0]
      if(key in nconf.get('reservedWords') and key in nconf.get('docker:replacePaths'))
        content += getDockerInput(key) + ' '
      else
        content += '$'+inputCount+' '
      inputCount++

    content += '1> /data/result.json \n'
    content += 'curl -H "Content-Type: application/json" --data @/data/result.json $2'
    fs.writeFileSync(outputFolder + path.sep + "script.sh", content)

  @runDockerImage: (process, imageName) ->
    params = process.parameters.params
    exec = childProcess.exec
    paramsPath = ""
    params = _.values(params).join(' ').split(' ')
    for param in _.values(params)
      paramsPath += '"' + param + '" '
    command = "./script.sh " + process.inputImageUrl + " " + process.remoteResultUrl
    logger.log 'info', command
    @docker.run(imageName,['bash', '-c', command], process.stdout, (err, data, container) ->
      logger.log 'info', data.statusCode
    )
    #command = 'docker run --rm ' + imageName + ' ' + process.inputImageUrl + ' ' + process.remoteResultUrl + ' '+ paramsPath
    #logger.log 'info', 'run docker command: ' + command
    #child = exec(command, { maxBuffer: 1024 * 48828 }, (error, stdout, stderr) ->
    #)

  getDockerInput = (input) ->
    return nconf.get('docker:paths:'+input)
