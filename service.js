var zmq = require("zmq");
var zonar = require("zonar");
var url = require("url");
var Promise = require("es6-promises").Promise;
var helper = require("./index");

function createService(){
    var pub = {};

    var priv = {
        zonar : null
    };

    var payloads = {};

    var fns = [];
    var zonarStart = [];

    pub.pub = function(arg1, arg2){

        var endpointName = null;
        var callback = null;

        if(typeof arg1 == 'function'){
            callback = arg1;
        } else if(typeof arg2 == 'function') {
            endpointName = arg1;
            callback = arg2;
        } else {
            throw new Error("invalid arguments, arg1 or arg2 needs to be a function");
        }

        var sock = zmq.socket("pub");
        sock.bindSync("tcp://*:0");
        callback(sock.send);

        var port = url.parse(sock.last_endpoint).port;

        if(endpointName == null){
            endpointName = "rep_" + port;
        }

        addPayload(endpointName, {
            type : "pub",
            port : port
        });
    };

    pub.sub = function(to, channel, fn){
        var sock = zmq.socket("sub");
        sock.bindSync("tcp://*:0");
        fn(sock);
    };

    // s.req("tcp://1.1.1.1:1233", "hello").on("message", function(message){ console.log("response : " + message); });
    // s.req("zonarname", "hello").on("message", function(message){ console.log("response : " + message); });
    pub.req = function(to, message, callback){

        if(typeof to != 'string' || typeof message != 'string'){
            throw new Error("to and message arguments must be strings");
        }

        var uri = url.parse(to);

        if(uri.protocol == null){

            var fetchEndpoint = function(){
                helper.getService(priv.zonar, to, function(err, sock){
                    if(err){
                        callback(err, null);
                        return;
                    }

                    sock.on("message", function(msg){
                        callback(null, msg);
                        sock.close();
                    });

                    sock.send(message);
                });
            };


            if(priv.zonar != null){
                fetchEndpoint();
            } else {
                zonarStart.push(fetchEndpoint);
            }

        } else {

            var sock = zmq.socket("req");

            try {
                sock.connect(to);
                sock.send(message);
            } catch (e) {
                callback(e, null);
            }

            sock.on("message", function(msg){
                callback(null, msg);
                sock.close();
            });
        }
    };

    pub.rep = function(arg1, arg2){
        var endpointName = null;
        var callback = null;

        if(typeof arg1 == 'function'){
            callback = arg1;
        } else if(typeof arg2 == 'function') {
            endpointName = arg1;
            callback = arg2;
        } else {
            throw new Error("invalid arguments, arg1 or arg2 needs to be a function");
        }

        var sock = zmq.socket("rep");
        sock.bindSync("tcp://*:0");
        sock.on("message", function(message){
            callback(message, function(reply) {
                sock.send(reply);
            });
        });

        var port = url.parse(sock.last_endpoint).port;
        if(endpointName == null){
            endpointName = "rep_" + port;
        }

        addPayload(endpointName, {
            type : "rep",
            port : port
        });
    };

    pub.broadcast = function(settings){
        // init zonar and send payload
        if(Object.keys(payloads).length === 0){
            throw new Error("Can't start service without any servicedefinitions");
        }

        settings.payload = pub.getPayload();

        priv.zonar = zonar.create(settings);
        priv.zonar.start(runZonarStart);
    };

    pub.listen = function(settings){
        priv.zonar = zonar.create(settings);
        priv.zonar.listen(runZonarStart);
    };

    pub.stop = function(){
        priv.zonar.stop();
    };

    function runZonarStart(){
        for(var i = 0, ii = zonarStart.length; i < ii; i++){
            zonarStart[i]();
        }
    }

    // private functions
    function addPayload(name, payload){
        if(payloads[name]){
            console.log("Payload " + name + " overwrites existing payload", JSON.stringify(payloads[name]));
        }

        payloads[name] = payload;
    }

    // for testing
    pub.getPayload = function(){
        return payloads;
    };

    return pub;
}

module.exports = createService;
