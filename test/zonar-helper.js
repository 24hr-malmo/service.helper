var should = require("should");
var zonarHelper = require("../");
var zonar = require("../node_modules/zonar/");

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


//describe("bb test", function() {
//
//    var producer = zonar.create({net: "test", name: "producer", payload : { doc : { port : 5556, type :"req"}}});
//    var consumer = zonar.create({net: "test", name: "consumer" });
//
//    before(function(){
//        consumer.start();
//        producer.start();
//    });
//
//    after(function(){
//        consumer.stop(function(){
//            producer.stop();
//        });
//    });
//
//    it("asd", function(done) {
//        done();
//    });
//
//});
