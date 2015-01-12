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
    var sockets = [];

    var fns = [];
    var zonarStart = [];

    // TODO: should probably merge this and rep somehow...
    pub.pub = function(obj, cb){
        var endpointName = null;
        var callback = null;
        var port = 0;

        if(typeof obj == 'function'){
            callback = cb;
        } else {

            if(typeof cb != 'function'){
                throw new Error("No callback passed to rep function");
            }

            callback = cb;

            if(obj.endpointName && typeof obj.endpointName == 'string'){
                endpointName = obj.endpointName;
            }

            if(obj.port && typeof obj.port == 'number'){
                port = obj.port;
            }
        }

        var sock = zmq.socket("pub");

        sockets.push(sock);

        try {
            sock.bindSync("tcp://*:" + port);
        } catch (e){
            // push this to next tick to ensure that the callback behaves async
            setTimeout(function(){
                callback(e);
            }, 0);
        }

        callback(null, function(msg){
            sock.send(msg);
        });

        // if we didn't have a port to bind to fetch the random one
        if(port == 0){
            port = url.parse(sock.last_endpoint).port;
        }

        if(endpointName == null){
            endpointName = "pub_" + port;
        }

        addPayload(endpointName, {
            type : "pub",
            port : port
        });
    };

    pub.sub = function(obj, cb){
        var to = null;
        var channel = null;
        var callback = null;

        if(typeof cb != 'function'){
            throw new Error('sub needs a callback function. "' + obj.callback + '" was provided');
        }
        callback = cb;

        if(obj.to == null || obj.to.length == 0){
            callback("to parameter invalid or not set", null);
        }
        to = obj.to;

        if(obj.channel && obj.channel.length > 0){
            channel = obj.channel;
        }

        var uri = url.parse(to);
        if(uri.protocol == null){

            var fetchEndpoint = function(){
                helper.getService(priv.zonar, to, function(err, sock){
                    if(err){
                        callback(err, null);
                        return;
                    }
                    sockets.push(sock);

                    setupCallback(sock, channel, callback);
                });
            };

            if(priv.zonar != null){
                fetchEndpoint();
            } else {
                zonarStart.push(fetchEndpoint);
            }

        } else {

            var sock = zmq.socket("sub");
            sockets.push(sock);
            try{
                sock.connect(to);
            } catch (e) {
                // push this to next tick to ensure that the callback behaves async
                setTimeout(function(){
                    callback(e);
                }, 0);
                return;
            }

            setupCallback(sock, channel, callback);
        }

        function setupCallback(sock, channel, callback){
            if(channel != null){
                sock.subscribe(channel);
                sock.on("message", function(msg){
                    callback(null, msg);
                });
            } else {
                sock.subscribe("");
                sock.on("message", function(msg){
                    callback(null, msg);
                });
            }
        }
    };

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

                    sockets.push(sock);
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
            sockets.push(sock);

            try {
                sock.connect(to);
                sock.send(message);
            } catch (e) {
                // push this to next tick to ensure that the callback behaves async
                setTimeout(function(){
                    callback(e);
                }, 0);
                return;
            }

            sock.on("message", function(msg){
                callback(null, msg);
                sock.close();
            });
        }
    };

    pub.rep = function(obj, cb){
        var endpointName = null;
        var callback = null;
        var port = 0;

        if(typeof obj == 'function'){
            callback = obj;
        } else {
            // first arg isnt fn, parse the object

            if(typeof cb != 'function'){
                throw new Error("No callback passed to rep function");
            }

            callback = cb;

            if(obj.endpointName && typeof obj.endpointName == 'string'){
                endpointName = obj.endpointName;
            }

            if(obj.port && typeof obj.port == 'number'){
                port = obj.port;
            }
        }

        var sock = zmq.socket("rep");
        sockets.push(sock);

        try {
            sock.bindSync("tcp://*:" + port);
        } catch (e){
            // push this to next tick to ensure that the callback behaves async
            setTimeout(function(){
                callback(e);
            }, 0);
            return;
        }

        sock.on("message", function(message){
            callback(null, message, function(reply) {
                sock.send(reply);
            });
        });

        // if we didn't have a port to bind to fetch the random one
        if(port == 0){
            port = url.parse(sock.last_endpoint).port;
        }

        if(endpointName == null){
            endpointName = "rep_" + port;
        }

        addPayload(endpointName, {
            type : "rep",
            port : port
        });
    };

    pub.broadcast = function(settings, next){
        // init zonar and send payload
        if(Object.keys(payloads).length === 0){
            throw new Error("Can't start service without any servicedefinitions");
        }

        settings.payload = pub.getPayload();

        priv.zonar = zonar.create(settings);
        //    priv.zonar.on("error", function(e){
        //        console.log("ERROR");
        //        console.log(e);
        //    });
        priv.zonar.start(function(err){
            runZonarStart();
            if(typeof next == 'function'){
                next();
            }
        });
    };

    pub.listen = function(settings, next){
        priv.zonar = zonar.create(settings);
        //priv.zonar.on("error", function(e){
        //    console.log("ERROR");
        //    console.log(e);
        //});
        priv.zonar.listen(function(err){
            runZonarStart();
            if(typeof next == 'function'){
                next();
            }
        });
    };

    pub.stop = function(cb){

        for(var i = 0, ii = sockets.length; i < ii ; i++){
            try{
                sockets[i].close();
            } catch (e){
                // ignore any error we just try to shut as down as much as possible
                //console.log(e);
            }
        }

        if(priv.zonar != null){
            priv.zonar.stop(cb);
        } else {
            cb();
        }

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
