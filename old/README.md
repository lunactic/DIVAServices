#DIVAServices
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

----------
##Installation
The installation process is described on a separate wiki page here: [Installation](https://github.com/lunactic/DIVAServices/wiki/Installation)

----------

## Integrating DivaServices in your Application ##
###Basic Information ###
Integrating DivaServices works like integrating any other RESTFul-API as well. To get an overview of which algorithms are available perform a GET request to the root (e.g. http://divaservices.unifr.ch). The server will respond with a message like this:
````json
[
  {
    "name": "Text Block Extraction",
    "description": "Text block extraction method",
    "url": "http://divaservices.unifr.ch/extraction/textblock"
  },
  {
    "name": "Multi Scale Interest Point Detection",
    "description": "Multi scale interest point detectors based on Gaussian scale space",
    "url": "http://divaservices.unifr.ch/ipd/multiscale"
  },
  {
    "name": "Artificial Noising",
    "description": "Add artificial noise to an image",
    "url": "http://divaservices.unifr.ch/noise"
  }
]
````
Responding with a list of all currently available methods. A GET request to a certain method (e.g. http://divaservices.unifr.ch/extraction/textblock) will return information this specific method needs for execution:
````json
  {
    "name": "Text Block Extraction",
    "description": "Text block extraction method",
    "url": "http://divaservices.unifr.ch/extraction/textblock",
    "info": {
      "author": "Kai Chen",
      "expectedRuntime": "No runtime information available"
    },
    "input": [],
    "example": {}
  }
````
#### input ####
The input array describes the needed inputs for this method to be able to execute. Currently we have the following possible parameters:

- *number*
Contains a *name* defining the variable name and a description.
Optional: Contains option defining if it is required and which numerical values are valid.
````json
[
"number": {
    "name": "maxVerBlockDist",
    "description": "Maximal amount of vertical black pixels, after this amount of pixels a cut will be made",
    "options": {
        "required": true,
        "min": 0,
        "max": 200,
        "steps": 1,
        "default": 50
    }
}]
````
example of a number parameter

- *select*
Defines a selection of which one can be picked.

````json
[
"select": {
    "name":"detector",
    "description" : "Select the detector to use",
    "options": {
        "required": true,
        "values": [
            "Harris",
            "Hessian",
            "Laplace",
            "Quadrature",
            "Ridge"
            ],
        "default": 0
    }
}]
````
example of a select parameter

- *checkbox*
Defines a selection of which none or multiple can be picked.



####example###
Shows an example of how the method can be used. Defines an example input and shows what output would be produced.

### Image handling ###
DIVAServices allows for two different ways for sending images: Uploading it independently, or sending it together with the request.

#### Checking if an image exists
The first thing one might want to do is check wheter or not an images is already available on the server.
For doing this the server provides the route: **/images/:md5** where **:md5** refers to the md5-hash of the base64 representation of the image.
The server will respond with the following JSON object:
````json
{
    "imageAvailable": true
}
````
where **imageAvailable** is either **true** or **false** depending on wheter the image was found or not.


#### Send image independently
The server provides the route **/upload**. A POST request to this route allows for sending an image to the server. It allows the three same mode as described below.

Once the image is uploaded the server will respond with the **md5-hash** of the saved image that can be used in further requests to work on that image.

#### Send images within the request
Images can directly be appended to the request of a method. Images can be provided with three different ways: **base64**, **url**, **md5**.

**Send image as base64**
To send an image as base64 string include id as following into your POST message body:
````json
  {
    "image": "base64EncodedImageString"
  }
````  
**Send image as URL**
Include a URL in the following way into your POST message body:
````json
  {
    "url": "http://url.to.your.image"
  }
````

**Send image as md5**
If you know that an image is already available on the server you can also simply send the md5-hash of the base64 representation using:
````json
  {
    "md5Image": "md5HashOfBas64"
  }
````

Use always only **one** field to provide an image.


##JSON Schema ##
For validating the input and the output we designed a JSON-Schema that can be used. It can be found at '/conf/schemas.json'. Currently there are three important schemas:

**root:algorithmSchema**
Defines how an algorithm is defined at the root level of the application.

**details:responseSchema**
Defines how the response of an algorithm will look after invoking it using a POST request.

**details:algorithmSchema**
Defines how the response of a GET request to a specific algorithm will look. This information contains all necessary information about which information is needed of an algorithm to be executed.

----------