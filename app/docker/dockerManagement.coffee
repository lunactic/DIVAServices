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
      self.docker.buildImage(inputFolder+path.sep+'archive.tar', {t: imageName, q: true}, (err, response) ->
        id = -1
        hasError = false
        errorMessage = ''
        if(err?)
          logger.log 'error', err
          errorMessage = err
          hasError = true
        else
          response.on('data', (data) ->
            if(hasError)
              err =
                statusCode: 500
                statusMessage: errorMessage
              callback err, null
            try
              json = JSON.parse(data.toString())
              id = json.stream.split(':')[1].replace('\n','')
            catch error
              hasError = true
              err =
                statusCode: 500
                statusMessage: data.toString()
              callback err, null
          )
          response.on('end', () ->
            if(not hasError)
              logger.log 'info', 'successfully built the image'
              callback null, id
          )
      )
    archive.pipe(output)
    archive.bulk([
      expand: true
      cwd: inputFolder+'/'
      src: ['*','**/*']
    ])
    archive.finalize()

  @removeImage: (imageName, callback) ->
    @docker.getImage(imageName).remove( (err,data) ->
      if(err?)
        logger.log 'error', err
      callback null
    )

  @createDockerFile: (algorithmInfos, outputFolder) ->
    content = "FROM " + algorithmInfos.method.environment + "\n" +
      "MAINTAINER marcel.wuersch@unifr.ch\n" +
      "RUN apt-get update\n" +
      "RUN apt-get install wget\n" +
      "RUN apt-get install unzip\n"+
      "RUN mkdir /data\n"+
      "WORKDIR /data\n" +
      "COPY . .\n" +
      'RUN ["chmod", "+x", "./script.sh"]\n' +
      'RUN unzip algorithm.zip\n'

    if algorithmInfos.method.language is 'bash'
      content += 'RUN ["chmod", "+x", "./'+ algorithmInfos.method.executable_path+'"]\n'

      #'ENTRYPOINT ["./script.sh"]'
    fs.writeFileSync(outputFolder + path.sep + 'Dockerfile', content)

  @createBashScript: (algorithmInfos, outputFolder) ->
    content = "#!/bin/sh\n"
    
    if(_.find(algorithmInfos.input,{'inputImage':{}})?)
      content += 'wget -O /data/inputImage.png $1\n'
      #content += 'wget -O /data/inputImage.png $1\n'

    switch(algorithmInfos.method.executableType)
      when 'java'
        content += 'java -Djava.awt.headless=true -Xmx4096m -jar /data/' + algorithmInfos.method.executable_path + ' '
      when 'coffeescript'
        content += 'coffee ' + algorithmInfos.method.executable_path + ' '
      when 'bash'
        content += '/data/' + algorithmInfos.method.executable_path + ' '

    #input count starts with 4. Params 1,2 and 3 are fix used
    # 1: inputImageUrl
    # 2: resultResponseUrl
    # 3: eroorResponseUrl
    inputCount = 4

    for input, i  in algorithmInfos.input
      #check if needs to be rewritten
      key = _.keys(algorithmInfos.input[i])[0]
      if(key in nconf.get('reservedWords') and key in nconf.get('docker:replacePaths'))
        content += getDockerInput(key) + ' '
      else
        content += '$'+inputCount+' '
      inputCount++

    content += '1> /data/result.json 2> /data/error.txt \n'
    content += 'curl -H "Content-Type: application/json" --data @/data/result.json $2 \n'
    content += 'if [ -s "/data/error.txt" ] \n'
    content += 'then \n'
    content += '    curl -H "Content-Type: text/plain" --data @/data/error.txt $3 \n'
    content += 'fi'
    fs.writeFileSync(outputFolder + path.sep + "script.sh", content)

  @runDockerImage: (process, imageName) ->
    params = process.parameters.params
    paramsPath = ""
    _.forOwn(params, (value, key) ->
      paramsPath += '"' + value + '" '
    )
    command = "./script.sh " + process.inputImageUrl + " " + process.remoteResultUrl + " " + process.remoteErrorUrl + " " + paramsPath
    logger.log 'info', command
    @docker.run(imageName,['bash', '-c', command], process.stdout, (err, data, container) ->
      if(err?)
        logger.log 'error', err
      if(data? and data.StatusCode is 0)
        container.remove( (err, data) -> )
      else if(data? and data.StatusCode is not 0)
        logger.log 'error', 'docker execution did not finish properly! status code is: ' + data.StatusCode
        container.remove( (err, data) -> )
    )
  getDockerInput = (input) ->
    return nconf.get('docker:paths:'+input)
