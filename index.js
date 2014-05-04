var zmq = require("zmq");

var dolog = false;

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

    try {
        // invalid types will be caught here
        var services = node.payload;
        endpoint = services[service.serviceName];
        sock = zmq.socket(endpoint.type);
    } catch (e){
        log(e, e.stack);
        return false;
    }

    switch(endpoint.type){
        case "req":
            sock.connect("tcp://" + node.address + ":" + endpoint.port);
        break;
        case "sub":
            sock.connect("tcp://" + node.address + ":" + endpoint.port);
        break;
        default:
            var e = new Error();
            log("Unhandled servicetype " + endpoint.type, e.stack);
            return false;
        break;
    }

    return sock;
};

function parsePayload(node){
    var payload = null;
    try {
        payload = JSON.parse(node.payload);
    } catch(e) {
        log("no or invalid payload from " + node.address);
        log(JSON.stringify(node));
        return false;
    }
    return payload;
}


function getService(zonarNode, serviceName, cb){

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
        cb("invalid serviceName");
        return;
    }

    zonarNode.once("found." + service.nodeName, function(node){
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

    if (node == false) {
        var e = new Error();
        log("A node with the name \"%s\" could not be found.", e.stack);
        return false;
    }

    return node;
}

function handleInterrupt(zonar){
    if (!zonar) {
        console.error("no zonar instance given to handleInterrupt");
        return;
    }

    if (typeof zonar.stop != 'function'){
        console.error("zonar instance does not have a stop function");
        return;
    }

    process.on( 'SIGINT', function() {
        log("Stopping...");
        zonar.stop(function() {
            log("Stopped");
            process.exit( );
        });
    });
}

module.exports = {
    getService : getService,

    // exposed for tests
    parsePayload : parsePayload,
    createZMQSocket : createZMQSocket,
    parseServiceName : parseServiceName,
    handleInterrupt : handleInterrupt,
    getServiceAddress : getServiceAddress,
    setLog : function(val){
        dolog = val;
    }
};
