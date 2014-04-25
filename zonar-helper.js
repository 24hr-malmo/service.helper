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
        log(e);
        return false;
    }

    switch(endpoint.type){
        case "req":
            sock.connect("tcp://" + node.address + ":" + endpoint.port);
        break;
        default:
            log("unhandled servicetype " + endpoint.type);
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
        log(JSON.stringify(node))
        return false;
    }
    return payload;
}


function getService(zonarNode, serviceName){

    var service = parseServiceName(serviceName);

    if (service == false) {
        // invalid serviceName
        return false;
    }

    var node = zonarNode.getList()[service.nodeName];

    if(node == false){
        // service not found
        log("service not found");
        return false;
    }

    var socket = createZMQSocket(node, service);

    if (socket == false){
        log("could not create socket");
        return false;
    }

    return socket;
};

module.exports = {
    getService : getService,

    // exposed for tests
    parsePayload : parsePayload,
    createZMQSocket : createZMQSocket,
    parseServiceName : parseServiceName,
    setLog : function(val){
        dolog = val;
    }
};
