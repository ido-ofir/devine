var socket = new WebSocket("ws://localhost:7999");
if(socket){
	socket.onopen = function(){  
		console.log("background socket has been opened..");  
		socket.send(JSON.stringify({method: 'connect', branch: 'background'}));
		ping();
	}
	socket.onmessage = function(e){
		var json = JSON.parse(e.data);
		console.log('background got ' + e.data);
	}	
	socket.json = function(object){
		socket.send(JSON.stringify(object))
	};
	var ping = function(){
		socket.json({method: 'ping'});
		setTimeout(ping, 500);
	};
}
else alert('ws fail');
