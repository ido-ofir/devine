var client = (function(){
	var root = 'http://localhost:8000/';

	var socket = new WebSocket("ws://localhost:7999");
	if(socket){
		socket.json = function(object){
			socket.send(JSON.stringify(object))
		};
		socket.onopen = function(){  
			console.log("client socket has been opened..");  
			socket.json({method: 'connect', branch: 'client'});
		};
		socket.onmessage = function(e){
			var json = JSON.parse(e.data);
			console.log('client got ' + e.data);
			if(json.target && (json.target === 'client')){
				if(json.method && methods[json.method]){
					methods[json.method]();
				}
			}
		};		
	}
	else alert('ws fail');
	var ajax = (function () {
        var onreadystatechange = function () {
            if (this.readyState == 4) {
				if(this.status == 200){
					if (this.callback) {
						this.callback(this.responseText);
					}
				}
				else{
					console.log(this.status + ' - ' + this.responseText);
				}
            } 
        };
        var post = function (url, variables) {
            this.open("POST", url, true);
            this.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
            this.send(variables);
        };
        var newRequest = function (callback) {
            var request = new XMLHttpRequest();
            request.callback = callback;
            request.onreadystatechange = onreadystatechange;
            request.post = post;
            return request;
        };

        return {
            writeFile: function (url, content, callback) {
                var request = newRequest(callback || function(d){ console.log(d); });
                var variables = "method=save&file=" + url + "&value=" + content;
                request.post('/', variables);
            },
            post: function (url, variables, callback) {
                var request = newRequest(callback);
                request.post(url, variables);
            }
        };
    }());
	
	var make = function(selector, holdSave){
		var str, el, cls;
		if(!selector || !selector.split) return;
		if(selector.indexOf('.') == 0){
			el = document.createElement('div');
			cls = selector.slice(1);
		}
		else{
			var arr = selector.split('.');
			el = document.createElement(arr[0]);
			cls = arr.splice(1).join(' '); 
		}
		if(el){
			el.className = cls || ''; 
			if(cls){
				style.extend(selector, holdSave);
			}
		}
		return el;
	}
	var element = document.body;
	var clipboard = null;
	var inspect = function(path){
		socket.json({target: 'devtools', method: 'inspect', path: path})
	}
	var relative = function(path){
		if(path.indexOf(location.origin)){
			path = path.split(location.origin);
			for(var i = 0; i < path.length; i++){
				if(i !== 0){
					path[i] = path[i].substring(1); //remove slash '/'
				}
			}
		}
		if(path.indexOf(',') > -1) debugger;
		return path;
	}
	var methods = {
		saveHTML:(function(){
			var tab = -1;
			var indent = function(html){
				html = html || '';
				for(var i = 0; i < tab; i++){
					html += '\t';
				}
				return html;
			};
			var getHTML = function(el){	
				var result = [indent()];
				var tagName = el.tagName.toLowerCase();	
				var attr, 
					child, 
					i;				
				if(el.getAttribute('src') === 'root/client.js') return ''; //root is dynamicaly injected, so skip it's tab						
				if(el.children.length === 0){
					return indent() + relative(el.outerHTML) + '\n';
				}
				else{	
					tab++;
					result.push('<' + tagName);
					for(i = 0; i < el.attributes.length; i++){
						attr = el.attributes[i];
						result.push(' ' + attr.nodeName + '="' + attr.nodeValue + '"');
					}
					result.push('>\n');
					for(child = 0; child < el.children.length; child++){
						result.push(getHTML(el.children[child]));
					}	
					tab--;
					result.push(indent() + '</' + tagName + '>\n');
					return result.join('');					
				}				
			}
			return function(){
				var html = '<!DOCTYPE html>\n' + getHTML(document.documentElement);
				var htmlFile = relative(location.href);
				ajax.writeFile(htmlFile, html);			
			};
		}()),
		saveCSS:(function(){			
			var ruleToString = function(rule){
				var selectorText = rule.cssText.split('{')[0],				
					cssLines = rule.cssText.split('{')[1].split(';'),
					result = [],
					i;			
				result.push(selectorText + ' {\n');
				cssLines.splice(cssLines.length-1);
				for(i = 0; i < cssLines.length; i++){
					result.push('\t' + cssLines[i].trim() + ';\n');
				}
				result.push('}\n');
				return result.join('');
			};
			var parseCss = function(styleSheet){
				var rules = styleSheet.rules,
					result = [],
					i;
				if(rules){
					for(i = 0; i < rules.length; i++){
						result.push(ruleToString(rules[i]))
					}
					return result.join('');
				}					
			};
			return function(callback){					
				var url = relative(style.target.ownerNode.getAttribute('href'))
				var cssString = parseCss(style.target);	
				if(cssString){
					ajax.writeFile(url, cssString, function(d){
						style.reload(function(){
							console.log('css loaded');
							if(callback) callback();
						});
					});				
				}
			};
		}()),
		save: function(){
			methods.saveHTML();
			methods.saveCSS();
		},
		add: function(){
			var selector = prompt('set selectors to add to $0');
			if(selector){
				var arr = selector.split(',');
				for(var i = 0; i < arr.length; i++){
					var el = make(arr[i].trim(), true);
					if(el){
						element.appendChild(el);
					}
				}	
				methods.saveCSS(function(){
					inspect('last-child');
				});			
			}
		},
		wrap: function(){
			var selector = prompt('set selector to wrap $0 with');
			if(selector){
				var el = make(selector, true);
				if(el && element){
					var parent = element.parentNode;
					if(parent){
						parent.appendChild(el);
						el.appendChild(element);
						methods.saveCSS(function(){
							inspect('parent');
						});	
					}
				}
			}
		},
		duplicate: function(){
			var parent = element.parentNode;
			if(parent){
				if(element.nextElementSibling){
					parent.insertBefore(element.cloneNode(), element.nextElementSibling)
				}
				else parent.appendChild(element.cloneNode());
			}
		}
	}
	var style = (function(){
		var s, classNames = [];
		var targetSheet = document.styleSheets[document.styleSheets.length - 1];
		var linkTag = targetSheet.ownerNode;
		var getClassNames = function(){
			for(var i = 0;i < document.styleSheets.length; i++){
				s = document.styleSheets[i];
				for(var j = 0;j < s.rules.length; j++){
					if(classNames.indexOf(s.rules[j].selectorText) == -1){
						classNames.push(s.rules[j].selectorText);
					}
				}
			}
		};
		getClassNames();
		var onload = function(callback){
			if(linkTag.sheet && linkTag.sheet.rules){
				targetSheet = linkTag.sheet;
				style.target = targetSheet;
				callback(targetSheet);
			}
			else{
				setTimeout(function(){ onload(callback); }, 10);
			}
		}
		return {
			extend: function(selector, dontSave){
				if(classNames.indexOf(selector) == -1){
					targetSheet.insertRule(selector + '{}', targetSheet.rules.length);
					classNames.push(selector);
					if(!dontSave) methods.saveCSS();	
				}
			},
			reload: function(callback){
				var parent = targetSheet.ownerNode;
			    var href = relative(linkTag.href);
				linkTag.href = '';
				setTimeout(function(){
					linkTag.href = href;
					onload(callback);
				}, 0);
			},
			target: targetSheet
		};
	}());
	window.addEventListener('click', function(e){
		if(e.ctrlKey){
			if(e.shiftKey){
				methods.wrap();
			}
			else methods.add();
		}
	}, false);
	window.addEventListener('keyup', function(e){
		if(e.ctrlKey && e.shiftKey && e.altKey){
			var k = e.keyCode;
			if(k == 83 ){   // -- S
				console.log('saving files..')
				methods.saveHTML();
				methods.saveCSS();
			}
			else if(k == 65){  // -- A
				methods.add();
			}
			else if(k == 87){  // -- W
				methods.wrap();
			}
			else if(k == 67){  // -- C
				clipboard = element;
			}
			else if(k == 86){  // -- V
				if(clipboard){
					element.appendChild(clipboard.cloneNode());
				}
			}
			else if(k == 68){  // -- D
				methods.duplicate();
			}
		}
	}, true);

	return {
		sync:function(el){
			element = el;
		},
		test: function(str){
			socket.json({method: 'save', file: 'test.html', value: str});
		}
	};
}());
