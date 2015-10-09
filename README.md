#DivaServices
This is a basic implementation of the DivaServices, developed in the Diva group at University of Fribourg (http://diuf.unifr.ch/diva/)

DivaServices is a RESTFul webservice to access different Document Image Analysis algorithms.

Currently 16 methods are available: 
 - Segmentation
  - Text Line
    - Histogram based (UniFr)
    - Seamcarving based (EPFL)
  - Polygon (UniFr)
 - Textblock extraction (UniFr)
 - OCR using Tesseract (Tesseract: https://github.com/tesseract-ocr/tesseract)
 - Interest Point Detection (UniFr)
 - Ocropy (https://github.com/tmbdev/ocropy)
    - Binarization
    - Page Segmentation
    - Text recognizer
 - Binarization
    - Otsu (OpenimaJ: http://www.openimaj.org/)
    - Sauvola (OpenimaJ)
 - Image Enhancement
    - Histogram Enhancement (OpenimaJ)
    - Laplacian Image Sharpening (OpenimaJ)
    - Image Inverting (UniFr)
 - Image Noising (UniFr)

The necessary binaries to run the methods are currently only available upon request.
