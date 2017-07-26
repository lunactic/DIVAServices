import * as nconf from "nconf";
import * as chai from "chai";
let chaiHttp = require("chai-http");
let should = chai.should();
import { exec } from "child_process";


process.env.NODE_ENV = 'dev';

chai.use(chaiHttp);

before((done) => {
    exec('./scripts/cleanUp.sh', (err: any, stdout: any, stderr: any) => {
        done();
    });
});

describe('Test DIVAServices endpoints', () => {

    beforeEach((done) => {
        exec('./scripts/cleanData.sh', (err: any, stdout: any, stderr: any) => {
            done();
        });
    });

    describe('GET /', () => {
        it('should return an empty array', (done) => {
            chai.request("http://localhost:8080")
                .get('/')
                .then((res) => {
                    res.should.have.status(200);
                    res.body.should.be.a('array');
                    res.body.should.be.a('array').that.is.empty;
                    done();
                });
        });
    });

    describe('GET /collections', () => {
        it('should return an object with an empty collections array', (done) => {
            chai.request("http://localhost:8080")
                .get('/collections')
                .then((res) => {
                    res.should.have.status(200);
                    res.body.should.be.a('object');
                    res.body.collections.should.be.a('array');
                    res.body.collections.should.be.a('array').that.is.empty;
                    done();
                });
        });
    });

    describe('POST /collections (upload data)', () => {
        it('should upload the data and then be visible when doing a GET', (done) => {
            let reqBody = {
                name: "test_collection",
                files: [
                    {
                        type: "url",
                        "value": "http://dl.dropboxusercontent.com/s/bmes8xnqsm7bkis/e-codices_csg-0863_013_maxgt.zip"
                    }
                ]
            };

            chai.request("http://localhost:8080")
                .post('/collections')
                .set('content-type', 'application/json')
                .send(reqBody)
                .then((res) => {
                    res.should.have.status(200);
                    res.body.should.be.a('object');
                    res.body.should.have.property('collection');
                    res.body.collection.should.be.eql('test_collection');
                });
            setTimeout(() => {
                chai.request("http://localhost:8080")
                    .get('/collections')
                    .then((res) => {
                        res.should.have.status(200);
                        res.body.should.be.a('object');
                        res.body.collections.should.be.a('array');
                        res.body.collections.length.should.be.eql(1);
                    });
                chai.request("http://localhost:8080")
                    .get('/collections/test_collection')
                    .then((res) => {
                        res.should.have.status(200);
                        res.body.should.be.a('object');
                        res.body.should.have.property('percentage');
                        res.body.percentage.should.be.eql(100);
                        res.body.should.have.property('files');
                        res.body.files.should.be.a('array');
                        res.body.files.length.should.be.eql(2);
                        done();
                    });
            }, 5000);
        }).timeout(6000);
    });

    describe('POST /algorithm', () => {
        it('should create a new algorithm', (done) => {
            let reqBody = {
                "general": {
                    "name": "ICDAR2017 HisDocLayoutComp Layout Evaluation",
                    "description": "asdfasdfasdf",
                    "developer": "Marcel Würsch",
                    "affiliation": "University of Fribourg",
                    "email": "lunactic@gmail.com",
                    "author": "Marcel Würsch",
                    "type": "evaluation",
                    "license": "Apache",
                    "ownsCopyright": "1"
                },
                "input": [
                    {
                        "file": {
                            "name": "gtImage",
                            "description": "Ground Truth Image File",
                            "options": {
                                "required": true,
                                "mimeType": "image/png"
                            }
                        }
                    },
                    {
                        "file": {
                            "name": "resultImage",
                            "description": "The computed result image",
                            "options": {
                                "required": true,
                                "mimeType": "image/png"
                            }
                        }
                    },
                    {
                        "resultFile": {}
                    }
                ],
                "output": [
                    {
                        "number": {
                            "name": "exactmatch",
                            "options": {
                                "min": 0.0,
                                "max": 1.0
                            }
                        }
                    },
                    {
                        "number": {
                            "name": "hammingscore",
                            "options": {
                                "min": 0.0,
                                "max": 1.0
                            }
                        }
                    },
                    {
                        "number": {
                            "name": "meanjaccardindex",
                            "options": {
                                "min": 0.0,
                                "max": 1.0
                            }
                        }
                    },
                    {
                        "number": {
                            "name": "jaccardindex",
                            "options": {
                                "min": 0.0,
                                "max": 1.0
                            }
                        }
                    },
                    {
                        "number": {
                            "name": "meanf1score",
                            "options": {
                                "min": 0.0,
                                "max": 1.0
                            }
                        }
                    },
                    {
                        "number": {
                            "name": "meanprecision",
                            "options": {
                                "min": 0.0,
                                "max": 1.0
                            }
                        }
                    },
                    {
                        "number": {
                            "name": "meanrecall",
                            "options": {
                                "min": 0.0,
                                "max": 1.0
                            }
                        }
                    },
                    {
                        "number": {
                            "name": "f1score",
                            "options": {
                                "min": 0.0,
                                "max": 1.0
                            }
                        }
                    },
                    {
                        "number": {
                            "name": "precision",
                            "options": {
                                "min": 0.0,
                                "max": 1.0
                            }
                        }
                    },
                    {
                        "number": {
                            "name": "recall",
                            "options": {
                                "min": 0.0,
                                "max": 1.0
                            }
                        }
                    },
                    {
                        "file": {
                            "name": "errorVisualization",
                            "options": {
                                "mimeType": "image/png"
                            }
                        }
                    }
                ],
                "method": {
                    "file": "http://dl.dropboxusercontent.com/s/7096rkjuimbk0c5/algorithm.zip",
                    "environment": "anapsix/alpine-java:8",
                    "executableType": "bash",
                    "executable_path": "eval.sh"
                }
            };
            var identifier;
            chai.request("http://localhost:8080")
                .post('/algorithms')
                .set('content-type', 'application/json')
                .send(reqBody)
                .then(async (res) => {
                    res.should.have.status(200);
                    res.body.should.be.a('object');
                    res.body.should.have.property('identifier');
                    identifier = res.body.identifier;
                    console.log("identifier: " + identifier);
                    var status = await getAlgorithmStatus(identifier);
                    while (status !== 200) {
                        status = await getAlgorithmStatus(identifier);
                    }
                    done();
                });
        }).timeout(0);
    });
});

function getAlgorithmStatus(identifier: string): Promise<number> {
    return new Promise<number>((resolve, reject) => {
        chai.request("http://localhost:8080")
            .get('/algorithms/' + identifier)
            .then((res) => {
                res.body.should.be.a('object');
                res.body.should.have.property('status');
                res.body.status.should.be.a('object');
                res.body.status.should.have.property('statusCode');
                setTimeout(function () {
                    resolve(res.body.status.statusCode);
                }, 1000);

            });
    });

}
