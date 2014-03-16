

chrome.devtools.panels.create("Root",
    "icon.png",
    "panel.html",
    function(panel) {

    }
);
var sub = 'script[src="root/client.js"]';
var str = "if(!document.querySelector('" + sub + "') && location.href.indexOf(':8000') > -1){" + 
			  "var s = document.createElement('script');" +
			  "s.src = 'root/client.js';" +
			  "document.head.appendChild(s);" + 
		  "}";
chrome.devtools.inspectedWindow.eval(str);
chrome.devtools.panels.elements.onSelectionChanged.addListener(function(){
	chrome.devtools.inspectedWindow.eval('client.sync($0)');
});
var methods = {
	inspect: function(json){
		switch(json.path){
			case 'last-child':
				chrome.devtools.inspectedWindow.eval('inspect($0.lastElementChild)');
				break;
			case 'parent':
				chrome.devtools.inspectedWindow.eval('inspect($0.parentNode)');
				break;
			default:
				return;
		}
	}
}
var socket = new WebSocket("ws://localhost:7999");
if(socket){
	socket.json = function(object){
		socket.send(JSON.stringify(object));
	};
	socket.onopen = function(){  
		console.log("devtools socket has been opened..");  
		socket.json({method: 'connect', branch: 'devtools'});
	}
	socket.onmessage = function(e){
		var json = JSON.parse(e.data);
		if(json.method){
			if(methods[json.method]){
				methods[json.method](json);
			}
		}
	}
	
}
else alert('ws fail');




