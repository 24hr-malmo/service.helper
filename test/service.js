var should = require("should");
var zmq = require("zmq");
var createService = require("../service");

describe("parseServiceName", function() {

    it("a service should not be startable without service definitions", function() {
        var s = createService();
        (function(){
            s.start();
        }).should.throw();
    });

    it.skip("a service should be startable with one service definition", function() {
        var s = createService();

        s.rep(function(_, rep){ rep("data"); });

        (function(){
            s.broadcast();
        }).should.not.throw();
    });

    it("a reply service definition should be callable", function(done) {
        var msg = "this is an echo message";

        var s = createService();
        s.rep("echo", function(msg, reply){
            reply(msg);
        });
        s.broadcast({net: "test", name: "testname"});

        var s2 = createService();
        s2.listen({net: "test", name: "testname2"});
        s2.req("testname.echo", msg, function(err, response){
            (err === null).should.be.true;
            response.toString().should.equal(msg);
            s2.stop();
            s.stop();
            done();
        });

    });

    it("req for zonar node should get registered and run upon zonar start", function(done) {
        var msg = "this is an echo message";

        var s = createService();
        s.rep("echo", function(msg, reply){
            reply(msg);
        });

        var s2 = createService();
        s2.req("testname.echo", msg, function(err, response){
            (err === null).should.be.true;
            response.toString().should.equal(msg);
            s.stop();
            s2.stop();
            done();
        });

        s.broadcast({net: "test", name: "testname"});
        s2.listen({net: "test", name: "testname2"});
    });

    it.skip("a reply service definition should be callable", function(done) {
        var s = createService();

        s.rep(function(msg, reply){
            // send some reply
            reply(msg);
        });

        // reply bind to specific zonar name
        s.rep("getCurrentMessage", function(msg, reply){
            // send some reply
            reply(msg);
        });

        s.broadcast({net: "test", name: "testname"});

        var s2 = createService();
        s2.listen({net: "test", name: "testname2"});

        s2.req("testname.getCurrentMessage", "testing", function(response){
            console.log("response : " + response);
            done();
        });

    });

    it.skip("the following should work", function(){

        var s = createService();

        ////////////////////////////////////////////////////////////////////////////////
        // reply
        ////////////////////////////////////////////////////////////////////////////////
        s.rep(function(msg, reply){
            // send some reply
            reply("your message was " + msg);
        });

        // reply bind to specific zonar name
        s.rep("getCurrentMessage", function(msg, reply){
            // send some reply
            reply("your message was " + msg);
        });

        ////////////////////////////////////////////////////////////////////////////////
        // request
        ////////////////////////////////////////////////////////////////////////////////
        s.req("tcp://1.1.1.1:1233", "hello", function(response){
            console.log(response);
        });

        s.req("zonarname", "hello", function(response){
            console.log(response);
        });


        ////////////////////////////////////////////////////////////////////////////////
        // publish
        ////////////////////////////////////////////////////////////////////////////////
        s.pub(function(publish){
            publish("important data to publish!");
        });

        // bind publisher to specific zonar endpoint
        s.pub("messageChanged", function(publish){
            publish("important data to publish!");
        });


        ////////////////////////////////////////////////////////////////////////////////
        // subscribe
        ////////////////////////////////////////////////////////////////////////////////
        s.sub("zonarname", function(msg){
            console.log(msg);
        });

        s.sub("zonarname", "channel", function(msg){
            console.log(msg);
        });

        s.sub("tcp://1.2.3.4:1234", function(msg){
            console.log(msg);
        });

        s.sub("tcp://1.2.3.4:1234", "channel", function(msg){
            console.log(msg);
        });










        // service "manager"
        var s = createService();

        // request
        s.req("tcp://1.1.1.1:1233", "hello").on("message", function(message){ console.log("response : " + message); });
        s.req("zonarname", "hello").on("message", function(message){ console.log("response : " + message); });

        // reply
        s.rep().on("message", function(msg, reply){ reply("your message was : " + msg);});
        s.rep("endpointName").on("message", function(msg, reply){ reply("your message was : " + msg);});

        // publisher
        s.pub().then(function(publish){ publish("all datamaskin"); });
        s.pub("endpointname").then(function(publish){ publish("all datamaskin"); });

        // subscriber
        s.sub("zonarname", "channel").on("message", function(msg){ console.log(msg); });
        s.sub("zonarname").on("message", function(msg){ console.log(msg); });
        s.sub("tcp://1.2.3.4:1234", "channel").on("message", function(msg){ console.log(msg); });
        s.sub("tcp://1.2.3.4:1234").on("message", function(msg){ console.log(msg); });

        // just start it
        s.start();

        // start and broadcast that we're an available service
        s.start({net : "24hr", name: "hello"});

        // get endpoints
        s.getEndpoints();

    });
});
