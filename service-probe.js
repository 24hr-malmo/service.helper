var helper = require("./index.js");
var opt = require('node-getopt');
var zmq = require('zmq');
var zonar = require('zonar');

var o = new opt([
    ["t", "type=ARG", "type of socket (req, res, pub, sub, listen ...)"],
    ["r", "remote=ARG", "remote host and port, 1.2.3.4:1234"],
    ["m", "message=ARG", "message to send ex \"{\\\"type\\\":\\\"getMessage\\\"}\""],
    ["n", "net=ARG", "net to listen on"],
    ["c", "channel=ARG", "channel to subscribe to"]
]);

o.setHelp(
    "Usage: \n" +
        "\n" +
        "[[OPTIONS]]\n"
).bindHelp();

var options = o.parse(process.argv.slice(2));

init(options.options);


function init(options){
    console.log("Options : ", options + " \n");

    switch(options.type){
    case "req":
        req(options.remote, options.message);
        break;
    case "sub":
        sub(options.remote, options.net, options.channel);
        break;
    case "listen":
        listen(options.net);
        break;
    default:
        optionFatal("Invalid type");
        break;
    }
}

function sub(remote, net, channel){

    var ch = "";

    if(!net || typeof net != "string"){
        console.log("net must be a string");
        return;
    }

    if(typeof channel == 'string' && channel.length > 1){
        ch = channel;
    }

    var s = helper.service();

    s.sub({ to : remote, channel : ch }, function(err, msg){

        if(err){
            console.log("ERROR : ");
            console.log(err);
            return;
        }

        console.log(msg);
    });

    var settings = {
        name : "service-probe-listener",
        net : net
    };

    s.listen(settings, function(){
        s.handleInterrupt();
        console.log("subscribing");
    });

}



function optionFatal(msg){
    console.log("\nError : " + msg + "\n");
    o.showHelp();
    process.exit();
}

function listen(net){
    var z = zonar.create({net : net, name : "service-probe-listener"});

    z.on("found", function(node){
        prettyPrintNode("found", node);
    });

    z.on("dropped", function(node){
        prettyPrintNode("dropped", node);
    });

    z.listen(function(){
        console.log("listening");
    });

    function prettyPrintNode(ev, n){
        console.log(ev + "\t\t" + n.net + "." + n.name + " " + n.address + ":" + n.port + "\t\tid : " + n.id);
    }

}

function req(remote, message){

    if(typeof remote == 'undefined' || remote.length < 3 ){
        optionFatal("Invalid remote in req : " + remote);
    }

    var s = helper.service();

    s.listen({net : "24hr", name : "service-probe"}, function(){
        console.log("Connecting to " + remote);
        s.req({ to : remote, message : message}, function(err, msg){
            if(err){
                console.log("ERROR:");
                console.log(err);
                return;
            }

            console.log(msg);
        });
    });

    return;
    var socket = zmq.socket('req');
    socket.connect(remote);

    socket.on("message", function(response){
        console.log("Response : " + response.toString() + "\n");
        die();
    });

    if(typeof message == 'undefined'){
        message = "";
    }

    console.log("Sending message \"" + message + "\" to \"" + remote + "\"\n");

    socket.send(message);

    console.log("Message sent, waiting for response...\n");
}

function die(){
    console.log("die called");
    process.exit();
}
