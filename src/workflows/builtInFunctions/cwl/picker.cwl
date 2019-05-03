cwlVersion: v1.0
class: CommandLineTool
baseCommand: [python, /home/lunactic/DEV/DIVAServices/src/workflows/builtInFunctions/scripts/file_picker.py]
arguments: ["--output_folder", $(runtime.outdir)]

inputs:
    inputFolder:
        type: Directory
        inputBinding:
            position: 1
            prefix: --input_folder

    regex:
        type: string
        inputBinding: 
            position: 2
            prefix: --regex

outputs: 
    outputFile:
        type: File
        outputBinding:
            glob: outputFile.*
    output:
        type: stdout
