init


service

```

var s = createService();

////////////////////////////////////////////////////////////////////////////////
// reply
////////////////////////////////////////////////////////////////////////////////

// basic reply sock
s.rep(function(err, msg, reply){
    reply("data");
});

// reply sock at specific zonar endpoint
s.rep({endpointName : "echo"}, function(err, msg, reply){
    reply(msg);
});

// reply sock at specific endpoint and port
s.rep({ endpointName : "echo", port : port }, function(err, msg, reply){
    reply(msg);
});


////////////////////////////////////////////////////////////////////////////////
// request
////////////////////////////////////////////////////////////////////////////////

// request to specific tcp addr
s.req({ to : "tcp://127.0.0.1:8765", message : "hello"}, function(err, response){
    console.log(response);
});

// request to zonar service
s.req({ to : "otherservice.motd", message : "hello"}, function(err, response){
    console.log(response);
});

////////////////////////////////////////////////////////////////////////////////
// pub
////////////////////////////////////////////////////////////////////////////////

s.pub(function(err, publisher){
    publish("hello");
});

// publisher with bound zonar name
s.pub({endpointName : "data"}, function(err, publisher){
    publish("hello");
});

////////////////////////////////////////////////////////////////////////////////
// sub
////////////////////////////////////////////////////////////////////////////////


s2.sub({ to : "testname.data"}, function(err, msg){
    console.log(msg);
});

s2.sub({ to : "tcp://127.0.0.1:9876"}, function(err, msg){
    console.log(msg);
});

s2.sub({ to : "testname.data", channel : "specialDataChannel"}, function(err, msg){
    console.log(msg);
});


// zonar broadcast
s.broadcast({ net: "my-net", name :"demoservice"});

// or

// zonar listen
s.broadcast({ net: "my-net", name :"demoservice"});


// util

// fetches (zonar) endpoint payload
console.log(s.getPayload());


// at some later point
// this also tries to stop all underlying zmq sockets and calls zonar.stop
s.stop(function(){
    console.log("probably stopped now");
});

```