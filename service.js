var zmq = require("zmq");
var zonar = require("zonar");
var url = require("url");
var helper = require("./helper");

function createService(){
    var pub = {};

    var priv = {
        zonar : null,
        stopped : false
    };

    var payloads = {};
    var sockets = {};

    var fns = [];
    var zonarStart = [];
    var zonarStop = [];

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

        sockets[endpointName] = sock;

        try {
            sock.bindSync("tcp://*:" + port);
        } catch (e){
            // push this to next tick to ensure that the callback behaves async
            setTimeout(function(){
                callback(e);
            }, 0);
            return;
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
        var callback = null;
        var channel = typeof obj.channel == "string" ? obj.channel : null;
        var onDrop = typeof obj.onDrop == "function" ? obj.onDrop : null;
        var onReconnect = typeof obj.onReconnect == "function" ? obj.onReconnect : null;

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

            var fetchEndpoint = function(onConnect){
                helper.getService(priv.zonar, to, function(err, sock){
                    if(err){
                        setTimeout(function(){
                            callback(err, null);
                        }, 0);
                        return;
                    }
                    sockets[to] = sock;

                    if(typeof onConnect == "function"){
                        onConnect();
                    }

                    setupCallback(sock, channel, callback);
                });
            };

            var nodeName = helper.parseServiceName(to).nodeName;
            var setupReconnect = function(){

                var r = function(){
                    if(priv.stopped == false){
                        if(sockets[to]){
                            try {
                                sockets[to].close();
                                delete sockets[to];
                            } catch (e) {
                                //console.log(e);
                                //console.log("AAAA");
                            }
                        }
                        //console.log(to + " dropped, refetching endpoint and setting up reconnect cb again...");
                        if(onDrop != null) {
                            onDrop();
                        }
                        fetchEndpoint(onReconnect);
                        setupReconnect();
                    }
                };

                priv.zonar.once("dropped." + nodeName, r);

                //zonarStop.push(function(){
                //    console.log("removing listener for " + nodeName);
                //    priv.zonar.removeListener("dropped." + nodeName, r);
                //});
            };

            if(priv.zonar != null){
                fetchEndpoint();
                setupReconnect();
            } else {
                zonarStart.push(fetchEndpoint);
                zonarStart.push(setupReconnect);
            }

        } else {

            var sock = zmq.socket("sub");
            sockets[to] = sock;
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
            if(channel != null && channel != ""){
                sock.subscribe(channel);
                sock.on("message", function(msg){
                    callback(null, msg.toString().slice(channel.length));
                });
            } else {
                sock.subscribe("");
                sock.on("message", function(msg){
                    callback(null, msg.toString());
                });
            }
        }
    };

    pub.req = function(obj, callback){
        var to = obj.to;
        var message = obj.message;

        // parse args
        if(typeof callback != 'function'){
            throw new Error("Callback must be passed as the second argument to req");
        }

        if(typeof to != 'string'){
            setTimeout(function(){
                callback("to and message arguments must be strings");
            }, 0);
            return;
        }

        if( typeof message != 'string' ){
            message = "";
        }

        var uri = url.parse(to);

        if(uri.protocol == null){
            // zonar node

            var fetchEndpoint = function(){
                helper.getService(priv.zonar, to, function(err, sock){
                    if(err){
                        callback(err, null);
                        return;
                    }

                    sockets[to] = sock;
                    sock.on("message", function(msg){
                        callback(null, msg.toString());
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
            // regular proto

            var sock = zmq.socket("req");
            sockets[to] = sock;

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
                callback(null, msg.toString());
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
        sockets[endpointName] = sock;

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

    pub.handleInterrupt = function(){
        if(!priv.zonar){
            console.log("Zonar not started yet!");
        } else {
            helper.handleInterrupt(priv.zonar);
        }
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
        priv.stopped = true;
        var keys = Object.keys(sockets);

        for(var i = 0, ii = keys.length; i < ii ; i++){
            var key = keys[i];
            try{
                sockets[key].close();
            } catch (e){
                // ignore any error we just try to shut as down as much as possible
                //console.log("ERROR");
                //console.log(e);
            }
        }

        if(priv.zonar != null){
            runZonarStop();
            helper.stop(priv.zonar);
            priv.zonar.stop(function(){
                setTimeout(function(){
                    cb();
                }, 200);
            });
        } else {
            cb();
        }

    };

    pub.doc = function(opt){
        if(priv.zonar != null){
            throw Error("registering doc after starting service is not supported yet");
        }

        var doc = helper.createDoc(opt);
        var payload = doc.getPayload();
        sockets["doc"] = doc.getSocket();
        addPayload("doc", payload);
    };

    function runZonarStart(){
        for(var i = 0, ii = zonarStart.length; i < ii; i++){
            zonarStart[i]();
        }
    }

    function runZonarStop(){
        for(var i = 0, ii = zonarStop.length; i < ii; i++){
            zonarStop[i]();
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
