_                   = require 'lodash'
AlgorithmManagement = require '../management/algorithmManagement'
archiver            = require 'archiver'
logger              = require '../logging/logger'
Docker              = require "dockerode"
fs                  = require 'fs'
nconf               = require 'nconf'
path                = require 'path'
sequest             = require 'sequest'
IoHelper            = require '../helper/ioHelper'


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
    callback null
    ###@docker.getImage(imageName).remove( (err,data) ->
      if(err?)
        logger.log 'error', err
      callback null
    )###

  @createDockerFile: (algorithmInfos, outputFolder) ->
    content = "FROM " + algorithmInfos.method.environment + "\n" +
      "MAINTAINER marcel.wuersch@unifr.ch\n"
    switch nconf.get('baseImages:'+algorithmInfos.method.environment)
      when 'apk'
        content += "RUN apk update\n" +
            "RUN apk add curl\n"
      when 'apt'
        content += "RUN apt-get update\n" +
            "RUN apt-get install wget unzip curl -y\n"

    content += "RUN mkdir -p /data\n" +
               "RUN mkdir -p /data/output\n"+
               "WORKDIR /data\n" +
               "COPY . .\n" +
               'RUN ["chmod", "+x", "./script.sh"]\n' +
               'RUN unzip algorithm.zip\n'

    if algorithmInfos.method.executableType is 'bash'
      content += 'RUN ["chmod", "+x", "./'+ algorithmInfos.method.executable_path+'"]\n'

      #'ENTRYPOINT ["./script.sh"]'
    fs.writeFileSync(outputFolder + path.sep + 'Dockerfile', content)

  @createBashScript: (identifier, algorithmInfos, outputFolder) ->
    content = "#!/bin/sh\n"
    
    if(_.find(algorithmInfos.input,{'inputImage':{}})?)
      content += 'wget -O /data/inputImage.png $1\n'

    #input count starts with 4. Params 1,2 and 3 are fix used
    # 1: inputImageUrl
    # 2: resultResponseUrl
    # 3: eroorResponseUrl
    # increase it for every additional file that needs to be downloaded
    inputCount = 4


    #check if additional files need to be downloaded
    for input, i in algorithmInfos.input
      key = _.keys(algorithmInfos.input[i])[0]
      if key in ['json', 'file']
        content += 'wget -O /data/' + input[key].name + '.json $' + inputCount + '\n'
        AlgorithmManagement.addUrlParameter(identifier, input[key].name+'url')
        AlgorithmManagement.addRemotePath(identifier, input[key].name, '/data/' + input[key].name + '.json')
        inputCount++

    switch(algorithmInfos.method.executableType)
      when 'java'
        content += 'java -Djava.awt.headless=true -Xmx4096m -jar /data/' + algorithmInfos.method.executable_path + ' '
      when 'coffeescript'
        content += 'coffee ' + algorithmInfos.method.executable_path + ' '
      when 'bash'
        content += '/data/' + algorithmInfos.method.executable_path + ' '
      when 'matlab'
        content += '/data/' + algorithmInfos.method.executable_path + ' '


    for input, i  in algorithmInfos.input
      #check if needs to be rewritten
      key = _.keys(algorithmInfos.input[i])[0]
      if(key in nconf.get('reservedWords') and key in nconf.get('docker:replacePaths'))
        content += getDockerInput(key) + ' '
      else
        #TODO add switch for highlighters to add more values
        if key is 'highlighter'
          content += '$' + inputCount++ + ' ' + '$' + inputCount++ + ' ' + '$' + inputCount++ + ' ' + '$' + inputCount++ + ' ' + '$' + inputCount++ + ' ' + '$' + inputCount++ + ' ' + '$' + inputCount++ + ' ' + '$' + inputCount++ + ' '
        else
          content += '$'+inputCount+' '
      inputCount++

    if algorithmInfos.method.executableType is 'matlab'
      content += '1> /data/result.json \n'
    else
      content += '1> /data/result.json 2> /data/error.txt \n'


    content += 'if [ -s "/data/error.txt" ] \n'
    content += 'then \n'
    content += '    curl -H "Content-Type: text/plain" --data @/data/error.txt $3 \n'
    content += 'fi \n'
    content += 'if [ -s "/data/result.json" ] \n'
    content += 'then \n'
    content += '    curl -H "Content-Type: application/json" --data @/data/result.json $2 \n'
    content += 'fi'
    fs.writeFileSync(outputFolder + path.sep + "script.sh", content)

  @runDockerImage: (proc, imageName, callback) ->
    params = proc.parameters.params
    neededParams = proc.neededParameters
    paramsPath = ""
    for key, value of params
      if key == 'highlighter'
        paramsPath += _.map(params.highlighter.split(' '), (item) -> return '"'+item+ '"').join(' ')
      else if _.find(neededParams, key)? and _.find(neededParams, key)[key] in ['json', 'file']
        #replace path with download url
        remotePath = _.find(proc.remotePaths, key)[key]
        paramsPath += '"' + remotePath + '" '
      else if _.find(neededParams, key)? and _.find(neededParams, key)[key] in ['url']
        #get the file path from the corresponding correct value
        originalKey = key.replace('url','')
        orignalValue = params[originalKey]
        if process.hasImages
          url = IoHelper.getStaticImageUrlWithFullPath(orignalValue)
        else
          url = IoHelper.getStaticDataUrlWithFullPath(orignalValue)

        paramsPath += '"' + url + '" '
      else
        paramsPath += '"' + value + '" '

    command = "./script.sh " + proc.inputImageUrl + " " + proc.remoteResultUrl + " " + proc.remoteErrorUrl + " " + paramsPath
    logger.log 'info', command
    @docker.run(imageName,['sh', '-c', command], proc.stdout, (err, data, container) ->
      if(err?)
        logger.log 'error', err
        if(callback?)
          callback err, null
      if(data? and data.StatusCode is 0)
        container.remove( (err, data) ->
          if(callback?)
            callback null, null
        )
      else if(data? and data.StatusCode isnt 0)
        logger.log 'error', 'Execution did not finish properly! status code is: ' + data.StatusCode
        error =
          statusMessage: 'Execution did not finish properly! status code is: ' + data.StatusCode
        container.remove( (err, data) ->
          if(callback?)
            callback error, null
        )
    )
  getDockerInput = (input) ->
    return nconf.get('docker:paths:'+input)
