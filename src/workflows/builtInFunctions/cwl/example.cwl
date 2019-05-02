cwlVersion: v1.0
class: Workflow
inputs:
  inp: File
  ex: string

outputs:
  classout:
    type: File
    outputSource: compile/classfile

steps:
  lineSegmentation:
    run: lineSegmentation.cwl
    in:
      inputImage: inp
    out: [textLines]

  picker:
    run: picker.cwl
    in:
      collection: lineSegmentation/textLines
      regex: yourMom.jpg
    out: [pickedFile]