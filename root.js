exports.root = function(devine){
	var devineJSON;
	var template = devine + '/template'
	var http = require('http');
	var WSS = require('ws').Server;
	var wss = new WSS({port: 7999});
	var qs = require('querystring');
	var fs = require('fs');
	var childProcess = require('child_process');
	var debugging = false;
	var debug= function(msg){
		if(debugging === true) console.log(msg);
	};
	var fileTypes = {
		'html': 'text/html',
		'css': 'text/css',
		'js': 'application/javascript',
		'png': 'image/png',
		'jpg': 'image/jpeg',
		'jpeg': 'image/jpeg',
		'gif': 'image/gif'
	};
	function processPost(req, res) {
		var query = "";
		req.on('data', function(data) {
			query += data;
			if(query.length > 1e6) {
				query = "";
				res.writeHead(413, {'Content-Type': 'text/plain'}).end();
				req.connection.destroy();
			}
		});

		req.on('end', function() {
			var post = qs.parse(query); 
			if(post.method == 'save'){
				if(post.file && post.value){
					if(post.file.indexOf(':8000/') > -1){
						post.file = post.file.substring(post.file.indexOf(':8000/') + 6);
					}
					fs.writeFile(post.file, post.value, function(){
						res.end(JSON.stringify({method: 'save', file: post.file, value: 'success'}));
					});
				}
				else debug('"save" method error - bad POST query  - ' + query);
			}
			else debug('bad POST query  - ' + query);
		});
	}

	var branches = {
		devine: {},
		background: {},
		devtools: {},
		client: {}
	}
	var methods = {
		save: function(json, ws){
			var val = json.value;
			var file = json.file;
			if(val){
				if(file){
					fs.writeFile(file, val, function(err){
						if (err) throw err;
						else ws.json({method:'save', file:file, status:'success'});
					});
				}
				else{
					ws.json({method:'save', file:file, status:'failure', reason:'no file name was set'});
				}
			}
			else{
				ws.json({method:'save', file:file, status:'failure', reason:'no value was set'});
			}
		},
		connect: function(json, ws){
			if(json.branch && branches[json.branch]){
				branches[json.branch].ws = ws;
				debug('connecting ' + json.branch);
				if(json.branch === 'devine'){
					ws.json({method: 'listTemplates',templates: devineJSON.templates})
				}
				var complete = true;
				for(var m in branches){
					if(!branches[m].ws) complete = false;
				}
				if(complete){
					debug('connection complete');
				}
			}
		},
		disconnect: function(ws){
			for(var m in branches){
				if(branches[m].ws === ws){
					branches[m].ws = false;
					complete = false;
					debug('connection to branch ' + m + ' was lost');
				} 
			}
		},
		ping: (function(){
			var ping = false;
			return function(){
				ping = !ping;
				(function(){
					var pong = ping;
					setTimeout(function(){
						if(pong === ping) process.exit();
					}, 750);
				}());
			}
		}())
	}

	debug('socket port at http://localhost:7999 ');
	wss.on('connection', function(ws){
		debug('ws connection - ' + ws);
		ws.json = function(object){
			ws.send(JSON.stringify(object))
		};
		ws.on('message', function(message) {
			debug('ws message - ' + message);
			var json = JSON.parse(message);
			if(json.target){
				if(branches[json.target]){
					if(branches[json.target].ws){
						branches[json.target].ws.send(message); // just send the message to it's target
					}
					else{
						console.log('ERROR - branches[' + json.target + '].ws = ' + branches[json.target].ws)
					}
				}
			}
			else if(json.method){
				if(methods[json.method]) methods[json.method](json, ws);
				else ws.json({error: 'invalid method ' + json.method});
			}
			else{
				ws.json({error:'no method name in json'});
				console.log('no method name in json')
			}
		});
		ws.on('close',function(){
			debug('ws close - ' + ws);
		});
	});
	var startServer = function(){
		http.createServer(function(req, res){
			var url = req.url.slice(1);
			console.log('url = ' + url);
			if(req.method == 'POST') {
				processPost(req, res);
			} 
			else if(url === 'devine'){
				fs.readFile(devine + '/index.html', "utf8", function(error, data) {
					if(error){
						res.writeHead(200, {"Content-Type": 'text/plain'});
						res.end('server GET error - ' + error.toString());
						debug('file GET error - ' + error);
					}
					else{
						debug('serving devine');
						res.writeHead(200, {"Content-Type": 'text/html'});
						res.end(data);
					}
				});
			}
			else {
				var ex = url.slice(url.lastIndexOf('.') + 1);
				if(fileTypes[ex]){			
					fs.readFile(url, "utf8", function(error, data) {
						if(error){
							res.writeHead(200, {"Content-Type": 'text/plain'});
							res.end('server GET error - ' + error.toString());
							debug('file GET error - ' + error);
						}
						else{
							debug('serving ' + url);
							res.writeHead(200, {"Content-Type": fileTypes[ex]});
							res.end(data);
						}
					});
				}
				else{
					fs.exists('index.html', function (exists) {
						if(exists){
							fs.readFile('index.html', "utf8", function(error, data) {
								if(error){
									res.writeHead(200, {"Content-Type": 'text/plain'});
									res.end('server GET error - ' + error.toString() + '\nnnnnnnnn');
									debug('file GET error - ' + error);
								}
								else{
									debug('serving ' + url);
									res.writeHead(200, {"Content-Type": fileTypes[ex]});
									res.end(data);
								}
							});
						}
						else{
							res.writeHead(404);
							res.end();
							debug('rejecting ' + url);
						}
					});
				}
			}
		}).listen(8000); 
		console.log('server started at http://localhost:8000 ');
	};
	var copyDirectory = function (src, dest) {
		fs.readdir(src, function (err, list) {
			if (err) return console.log(err);
			list.forEach(function (file) {
				var srcPath = src + "/" + file;
				var destPath = dest + "/" + file;
				fs.stat(srcPath, function (err, stat) {
					if (err) return console.log(err);
					if (stat.isDirectory()){ 
						copyDirectory(srcPath, destPath);
					}
					else{
						copyFile(srcPath, destPath);
					}
				});
			});
		});
	};
	var copyFile = function (src, dest) {
		fs.readFile(src, function(err, file){
			if (err) return console.log(err);
			fs.writeFile(dest, file);
		});
	};
	var dirToJson = function(dirPath, json){
		json = json || {};
		fs.readdir(dirPath, function (err, list) {
			if (err) return console.log(err);
			list.forEach(function (file) {
				var newPath = dirPath + "/" + file;
				fs.stat(newPath, function (err, stat) {
					if (err) return console.log(err);
					if (stat.isDirectory()){ 
						json[file] = dirToJson(newPath);
						
					}
					else{
						json.files = json.files || [];
						json.files.push(newPath);
					}
				});
			});
		});
		return json;
	};
	devineJSON = dirToJson(devine);
	if (fs.existsSync('index.html')) {
		startServer();
		childProcess.exec('start chrome localhost:8000');
	}
	else{
		console.log('trying to copy ' + template + ' to ' + process.cwd());
		startServer();
		childProcess.exec('start chrome localhost:8000/devine');
	}	
};