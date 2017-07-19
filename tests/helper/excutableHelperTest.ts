let server = require("../../bin/www");
import * as nconf from "nconf";
import * as chai from "chai";
let chaiHttp = require("chai-http");
let should = chai.should();


process.env.NODE_ENV = 'dev';

chai.use(chaiHttp);

describe('Server', () => {
    beforeEach((done) => {
        done();
    });

    describe('GET /', () => {
        it('should return all available methods', (done) => {
            chai.request(server)
                .get('/')
                .end((err, res) => {
                    res.should.have.status(200);
                    res.body.should.be.a('array');
                    done();
                });
        });
    });
});
