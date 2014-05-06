var should = require("should");
var zonarHelper = require("../");
var zonar = require("zonar");
var zmq = require("zmq");

describe("parseServiceName", function() {

    it("parseServiceName should fail to parse invalid service names", function() {
        zonarHelper.parseServiceName("").should.be.false;
        zonarHelper.parseServiceName(".").should.be.false;
        zonarHelper.parseServiceName("a.").should.be.false;
        zonarHelper.parseServiceName(".b").should.be.false;
        zonarHelper.parseServiceName("a.b.c").should.be.false;
    });

    it("parseServiceName should not fail to parse a valid service name", function() {
        var parsed = zonarHelper.parseServiceName("a.b");
        parsed.nodeName.should.equal("a");
        parsed.serviceName.should.equal("b");
    });

});

describe("parsePayload", function() {
    var node1 = zonar.create({net: "test", name: "foo", payload : "data"});
    node1.start();

    after(function(){
        node1.stop();
    });

    it("should fail to parse invalid payloads", function() {
        zonarHelper.parsePayload({payload: "invalidjson", address : ""}).should.be.false;
    });

    it("should not fail to parse valid payload", function() {
        var parsed = zonarHelper.parsePayload({payload : "{\"a\":1}"});
        parsed.a.should.equal(1);
    });
});


describe("bb test", function() {

    var producer = zonar.create({net: "test", name: "producer", payload : { doc : { port : 5556, type :"req"}}});
    var consumer = zonar.create({net: "test", name: "consumer" });

    before(function(done){
        producer.start(function(){
            // test might fail, timeout is not a good way to ensure sync behaviour
            setTimeout(function(){
                consumer.start();
                done();
            }, 300);
        });
    });

    after(function(){
        consumer.stop(function(){
            producer.stop();
        });
    });

    it("should fail to get a service that doesn't exist", function(done) {
        zonarHelper.getService(consumer, "producer.doccc", function(err, sock){
            err.should.not.be.false;
            done();
        });
    });

    it("should be able to get an existing service", function(done) {
        zonarHelper.getService(consumer, "producer.doc", function(err, sock){
            err.should.be.false;
            should.exist(sock);
            done();
        });
    });

    it("should be able to get an existing service when the service goes online after the consumer", function(done) {

    var producer2 = zonar.create({net: "test", name: "producer2", payload : { doc : { port : 5556, type :"req"}}});

        setTimeout(function(){
            producer2.start();
        }, 300);

        zonarHelper.getService(consumer, "producer2.doc", function(err, sock){
            err.should.be.false;
            should.exist(sock);
            producer2.stop();
            done();
        });
    });

});

describe("doc helper", function() {
    var docString = "foo to the bar";
    var docHelper = zonarHelper.createDoc(docString);

    before(function(){
    });

    after(function(){
    });

    it("getPort should return a valid port", function(done) {
        var port = docHelper.getPort();
        port.should.be.within(1, 65535);
        done();
    });

    it("a zmq req socket should be able to get the correct docString response from the doc service", function(done) {
        var port = docHelper.getPort();
        var req = zmq.socket("req");

        req.connect("tcp://127.0.0.1:" + port);

        req.send("doc");

        req.on("message", function(msg){
            var m = JSON.parse(msg);
            m.doc.should.equal(docString);
            done();
        });
    });

    it("getPayload should return a valid payload part for the doc", function(done) {
        var payload = docHelper.getPayload();

        payload.type.should.equal("rep");
        payload.port.should.equal(docHelper.getPort());
        done();
    });
});
