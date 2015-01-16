var zmq = require("zmq");
var url = require("url");
var fs = require("fs");

var dolog = true;

function log(){
    if (dolog){
        console.log.apply(this, arguments);
    }
};

function parseServiceName(serviceName){
    var parts = serviceName.split(".");

    if (parts.length != 2 || parts[0].length == 0 || parts[1].length == 0){
        // invalid servicename
        log("Invalid servicename : " + serviceName);
        return false;
    }

    return {
        nodeName : parts[0],
        serviceName : parts[1]
    };
}

function createZMQSocket(node, service){
    var sock = null;
    var endpoint = null;
    var endpointType = null;

    try {
        // invalid types will be caught here
        var services = node.payload;
        endpoint = services[service.serviceName];
        endpointType = getOtherSockType(endpoint.type);
        sock = zmq.socket(endpointType);
    } catch (e){
        log(e, e.stack);
        return false;
    }

    switch(endpointType){
    case "req":
        sock.connect("tcp://" + node.address + ":" + endpoint.port);
        break;
    case "sub":
        sock.connect("tcp://" + node.address + ":" + endpoint.port);
        break;
    default:
        log("Unhandled servicetype " + endpointType);
        return false;
        break;
    }

    return sock;
};

// gets the socket type to connect with
function getOtherSockType(type){
    switch(type){
    case "rep":
        return "req";
        break;
    case "pub":
        return "sub";
        break;
    default:
        return "invalid";
        break;
    }
}

function parsePayload(node){
    var payload = tryParseJson(node.payload);
    if(payload === false){
        log("no or invalid payload from " + node.address);
        log(JSON.stringify(node));
    }

    return payload;
}

function tryParseJson(msg){
    var payload = false;
    try {
        payload = JSON.parse(msg);
    } catch(e) {}
    return payload;
}

// gets a service
// checks the nodelist first and if the node isn't found there it waits for it
// to come online
function getService(zonarNode, serviceName, cb){

    console.log("getService : " + serviceName);

    if(typeof cb !== 'function'){
        return;
    }

    // check if the service already exists in the nodelist
    var sock = getServiceStatic(zonarNode, serviceName);

    if (sock != false) {
        // we found a socket in the nodelist use it
        cb(false, sock);
        return;
    }

    var service = parseServiceName(serviceName);

    if (service == false) {
        // invalid serviceName
        cb("invalid serviceName " + serviceName);
        return;
    }

    zonarNode.once("found." + service.nodeName, function(node){
        log("found node " + service.nodeName);
        log(node);
        if(node == false){
            // error in zonar
            return cb("service not found");
        }

        var socket = createZMQSocket(node, service);

        if (socket == false){
            return cb("could not create socket");
        }

        return cb(false, socket);

    });
};


// only checks services already connected to this node
function getServiceStatic(zonarNode, serviceName){

    var service = parseServiceName(serviceName);

    if (service == false) {
        // invalid serviceName
        return false;
    }

    var node = findServiceNode(zonarNode, service.nodeName);

    if(node == false){
        // service not found
        return false;
    }

    var socket = createZMQSocket(node, service);

    if (socket == false){
        return false;
    }

    return socket;
};

function getServiceAddress(zonarNode, serviceName){
    var service = parseServiceName(serviceName);

    if (service == false) {
        // invalid serviceName
        return false;
    }

    var node = findServiceNode(zonarNode, service.nodeName);

    if(node == false){
        // service not found
        return false;
    }

    try {
        var endpoint = node.payload[service.serviceName];
        // just assuming it will always be tcp
        return "tcp://" + node.address + ":" + endpoint.port;
    } catch (e) {
        log("Service endpoint does not exist.", e.stack);
        return false;
    }

}

function findServiceNode(zonarNode, nodeName){

    var node = zonarNode.getList()[nodeName];

    if (typeof node == 'undefined') {
        log("A node with the name \"%s\" could not be found.", nodeName);
        return false;
    }

    return node;
}

function handleInterrupt(zonar, cb){
    console.log("handling interrupt");
    if (!zonar) {
        console.error("no zonar instance given to handleInterrupt");
        return;
    }

    if (typeof zonar.stop != 'function'){
        console.error("zonar instance does not have a stop function");
        return;
    }

    var stop = function(){
        log("Stopped");
        process.exit( );
    };

    process.on( 'SIGINT', function() {
        log("Stopping...");
        zonar.stop(function() {

            if (typeof cb == 'function'){
                cb(stop);
            } else {
                stop();
            }

        });
    });
}


// options :
// String (the doc string)
// or
// object
//     docString : String
//     filename : filename

function createDoc(options){

    var pub = {};

    var docString = null;
    switch(typeof options){
    case "string":
        docString = options;
        break;
    case "object":
        if(options.docString){
            docString = options.docString;
        } else if (options.filename){
            // deliberately skip error checking here, just fail if an invalid file is given
            docString = fs.readFileSync(options.filename, {encoding : "utf8"});
        } else {
            throw new Error("Invalid options, valid params are : docString or filename");
        }
        break;
    default:
        docString = "No doc :(";
        break;

    }

    // sock setup
    var sock = zmq.socket("rep");
    sock.bindSync("tcp://*:0");

    sock.on("message", function(){
        sock.send(JSON.stringify({
            doc : docString
        }));
    });

    // fns
    pub.close = function(){
        sock.close();
    };

    pub.getPort = function(){
        var u = url.parse(sock.last_endpoint);
        return u.port;
    };

    pub.getPayload = function(){
        return {
            type : "rep",
            port : pub.getPort()
        };
    };

    return pub;
}

module.exports = {
    getService : getService,

    // exposed for tests
    parsePayload : parsePayload,
    createZMQSocket : createZMQSocket,
    parseServiceName : parseServiceName,
    handleInterrupt : handleInterrupt,
    getServiceAddress : getServiceAddress,
    createDoc : createDoc,
    tryParseJson : tryParseJson,
    setLog : function(val){
        dolog = val;
    }
};
