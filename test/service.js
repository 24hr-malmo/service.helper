var should = require("should");
var zmq = require("zmq");
var createService = require("../service");

describe("servicetests", function() {

    //beforeEach(function(done){
    //    setTimeout(function(){
    //        done();
    //    }, 500);
    //});


    it("a service should not be startable without service definitions", function() {
        var s = createService();
        (function(){
            s.start();
        }).should.throw();
    });

    it("a service should be startable with one service definition", function(done) {
        var s = createService();

        s.rep(function(err, msg, rep){
            rep("data");
        });

        (function(){
            s.broadcast({ net: "data", name :"blah"}, function(){
                s.stop(function(){
                    done();
                });
            });
        }).should.not.throw();

    });

    it("a reply service definition should be callable", function(done) {
        var msg = "this is an echo message";

        var s = createService();
        s.rep({endpointName : "echo"}, function(err, msg, reply){
            (err === null).should.be.true;
            reply(msg);
        });
        s.broadcast({net: "test", name: "testname"}, function(){

            var s2 = createService();
            s2.listen({net: "test", name: "testname2"}, function(){
                s2.req({ to : "testname.echo", message : msg}, function(err, response){
                    s.stop(function(){
                        s2.stop(function(){
                            (err === null).should.be.true;
                            response.should.equal(msg);
                            done();
                        });
                    });
                });
            });
        });

    });

    it("req for zonar node should get registered and run upon zonar start", function(done) {
        var msg = "this is an echo message";

        var s = createService();
        s.rep({ endpointName : "echo" }, function(err, msg, reply){
            (err === null).should.be.true;
            reply(msg);
        });

        var s2 = createService();
        s2.req({ to : "testname.echo", message : msg }, function(err, response){
            (err === null).should.be.true;
            response.should.equal(msg);
            s.stop(function(){
                s2.stop(function(){
                    done();
                });
            });
        });

        s.broadcast({net: "test", name: "testname"});
        s2.listen({net: "test", name: "testname2"});
    });

    it("connection via tcp to fixed port rep sock should be possible", function(done) {
        var msg = "this is an echo message";
        var port = 9898;

        var s = createService();
        s.rep({ endpointName : "echo", port : port }, function(err, msg, reply){
            (err === null).should.be.true;
            reply(msg);
        });

        var s2 = createService();
        s2.req({ to : "tcp://127.0.0.1:" + port, message : msg}, function(err, response){
            s.stop(function(){
                s2.stop(function(){
                    (err === null).should.be.true;
                    response.should.equal(msg);
                    done();
                });
            });
        });

        s.broadcast({net: "test", name: "testname"});
        s2.listen({net: "test", name: "testname2"});
    });

    it("binding to same port twice should fail", function(done) {
        var port = 9898;

        var s = createService();
        s.rep({ endpointName : "echo", port : port}, function(err, msg, reply){
            (err === null).should.be.true;
        });
        s.rep({ endpointName : "echo", port : port}, function(err, msg, reply){
            (err === null).should.be.false;
            s.stop(function(){
                done();
            });
        });
        s.broadcast({net: "test", name: "testname"});

    });

    it("pub sub drop", function(done) {
        var data = "this is a pub message";
        var data2 = "this is a pub message2";
        var second = false;
        var final_pub = null;

        var createPublisher = function(cb){
            var s = createService();
            var _publisher = null;
            s.pub({endpointName : "data"}, function(err, publisher){
                (err === null).should.be.true;
                _publisher = publisher;
            });
            s.broadcast({net: "test", name: "testname"}, function(){
                cb(_publisher, s);
            });

        };


        var s3 = createService();
        s3.sub({ to : "testname.data"}, function(err, msg){
            (err === null).should.be.true;

            if(!second){
                msg.should.equal(data);
            } else {
                msg.should.equal(data2);
                s3.stop(function(){
                    final_pub.stop(function(){
                        done();
                    });
                });
            }
        });

        s3.listen({net: "test", name: "testname2"}, function(){
            createPublisher(function(p1, s1){
                setTimeout(function(){
                    p1(data);
                    s1.stop(function(){
                        createPublisher(function(p2, s2){
                            second = true;
                            final_pub = s2;
                            setTimeout(function(){
                                p2(data2);
                            }, 100);
                        });
                    });
                }, 100);
            });
        });
    });

    it("pub sub simple", function(done) {
        var data = "this is a pub message";
        var publish = null;

        var s = createService();
        s.pub({endpointName : "data"}, function(err, publisher){
            (err === null).should.be.true;
            publish = publisher;
        });

        var s2 = createService();
        s2.sub({ to : "testname.data"}, function(err, msg){
            (err === null).should.be.true;
            msg.should.equal(data);
            s.stop(function(){
                s2.stop(function(){
                    done();
                });
            });
        });

        s.broadcast({net: "test", name: "testname"}, function(){
            s2.listen({net: "test", name: "testname2"}, function(){
                // ugly but we need to wait for zonar or listen to specific events to do this better
                setTimeout(function(){
                    publish(data);
                }, 100);
            });
        });
    });

    it("pub sub port and tcp connection", function(done) {
        var data = "this is a pub message";
        var publish = null;

        var s = createService();
        s.pub({endpointName : "data", port : 8989}, function(err, publisher){
            (err === null).should.be.true;
            publish = publisher;
        });

        var s2 = createService();
        s2.sub({ to : "tcp://127.0.0.1:8989"}, function(err, msg){
            (err === null).should.be.true;
            msg.should.equal(data);
            s.stop(function(){
                s2.stop(function(){
                    done();
                });
            });
        });

        s.broadcast({net: "test", name: "testname"}, function(){
            s2.listen({net: "test", name: "testname2"}, function(){
                // ugly but we need to wait for zonar or listen to specific events to do this better
                setTimeout(function(){
                    publish(data);
                }, 100);
            });
        });
    });

    it("pub sub channel data should be cleaned before returning", function(done) {
        var data = "this is a pub message";
        var channel = "testchannel";
        var channelData = "special channel data";
        var publish = null;

        var s = createService();
        s.pub({endpointName : "data"}, function(err, publisher){
            (err === null).should.be.true;
            publish = publisher;
        });

        var s2 = createService();
        s2.sub({ to : "testname.data", channel : channel}, function(err, msg){
            (err === null).should.be.true;
            msg.should.equal(channelData);
            s.stop(function(){
                s2.stop(function(){
                    done();
                });
            });
        });

        s.broadcast({net: "test", name: "testname"}, function(){
            s2.listen({net: "test", name: "testname2"}, function(){
                // ugly but we need to wait for zonar or listen to specific events to do this better
                setTimeout(function(){
                    publish(data);
                    setTimeout(function(){
                        publish(channel + channelData);
                    }, 200);
                }, 100);
            });
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
