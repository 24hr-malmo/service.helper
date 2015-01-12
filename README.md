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

...



s.broadcast({ net: "my-net", name :"demoservice"});

// at some later point
s.stop(function(){});

```