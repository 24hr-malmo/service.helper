var helper = require("./index.js");
var opt = require('node-getopt');
var zmq = require('zmq');

var o = new opt([
    ["t", "type=ARG", "type of socket (req, res, pub, sub, ...)"],
    ["r", "remote=ARG", "remote host and port, 1.2.3.4:1234"]
]);

o.setHelp(
    "Usage: \n" +
        "\n" +
        "[[OPTIONS]]\n"
).bindHelp();

var options = o.parse(process.argv.slice(2));

init(options.options);


function init(options){
    console.log(options);

    switch(options.type){
    case "req":
        req(options.remote);
        break;
    default:
        optionFatal("Invalid type");
        break;
    }

}



function optionFatal(msg){
    console.log("\nError : " + msg + "\n");
    o.showHelp();
    process.exit();
}



function req(remote, message){

    if(typeof remote == 'undefined' || remote.length < 3 ){
        optionFatal("Invalid remote in req : " + remote);
    }

    var socket = zmq.socket('req');
    console.log("Connecting to " + remote);
    socket.connect(remote);

    socket.on("message", function(response){
        console.log("Response : " + response.toString());
        die();
    });

    if(typeof message == 'undefined'){
        message = "";
    }

    console.log("Sending message \"" + message + "\" to \"" + remote + "\"");

    socket.send(message);

    console.log("Message sent, waiting for response...");
}





function die(){
    console.log("die called");
    process.exit();
}
