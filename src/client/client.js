const nodeJsIp = undefined;
const socketConf = {
	transports: ["websockets"]
}

let socket;
let loaded = [];

let lock = false;
function loadScript(url, integrity, callback, callbackParams) {
	// Adding the script tag to the head as suggested before
	let head = document.getElementsByTagName("head")[0];
	let script = document.createElement("script");
	
	script.type = "text/javascript";
	script.src = url;
	
	if (integrity != null) {
		script.integrity = integrity;
		script.crossorigin = "anonymous";
	}

	// Then bind the event to the callback function.
	// There are several events for cross browser compatibility.
	if (callback != null) {
		let func = function() {
			if (callbackParams != null) {

				callback(callbackParams[0], callbackParams[1], callbackParams[2]);

			} else {

				callback();

			}
		};
		script.onreadystatechange = func;
		script.onload = func;
	} else {
		lock = true;
		let call = function() {
			lock = false;
		};
		script.onreadystatechange = call;
		script.onload = call;
		while (lock) {}
	}
	
	loaded.push(url);
	
	// Fire the loading
	head.appendChild(script);
}

function loadRemoteFunctionDeps(remoteFunction, callback, ii) {
	if (remoteFunction.deps.length != 0) {
		let i = ii || 0;
		if (!loaded.includes(remoteFunction.deps[i].url)) {
			loadScript(
				remoteFunction.deps[i].url,
				remoteFunction.deps[i].integrity,
				i == remoteFunction.deps.length-1 ? function() {callback();} : loadRemoteFunctionDeps,
				[remoteFunction, callback, i+1]
			);
		}
	} else {
		callback();
		return;
	}
}

// Script loading
loadScript("https://cdnjs.cloudflare.com/ajax/libs/socket.io/2.0.4/socket.io.js", null, function() {
	client();
});

// Actual code starts here
function client() {
	socket = nodeJsIp ? io(nodeJsIp, socketConf) : io(socketConf);
	
	socket.on("connection", function() {
		socket.emit("postConnection", "slave");
	
		socket.on("executeRemoteFunction", function(remoteFunction, debug, funcName) {
			loadRemoteFunctionDeps(remoteFunction, function() {

				let remoteFunctionOut = eval("(" + remoteFunction.func + ")(remoteFunction.args, debug)");
				socket.emit(funcName+"Out", remoteFunctionOut);
				
			});
		});
		
	});
	// on reconnection, reset the transports option, as the Websocket
	// connection may have failed (caused by proxy, firewall, browser, ...)
	socket.on('reconnect_attempt', () => {
		socket.io.opts.transports = ['polling', 'websocket'];
	});
}
