let express = require("express");
let app = express();
let path = require("path");
let http = require("http").Server(app);
let io = require("socket.io")(http);
let request = require("request");
let nodeCleanup = require("node-cleanup");
let fs = require("fs");
let pug = require("pug");
let os = require("os");
let ipaddr = require('ipaddr.js');

const debug = true;

let Modules = require("./Modules.js");

let ver = "";

try {
	ver = require("./../../version.js");
} catch (ex) {
	ver = "{UNKNOWN VERSION}";
}

let localIps = ["::1"];

let ifaces = os.networkInterfaces();
Object.keys(ifaces).forEach((ifname) => {
	ifaces[ifname].forEach((iface) => {
		if (iface.internal !== false) {
			// skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
			return;
		}

		localIps.push(iface.address);
	});
});

let slaveSockets = [];
let slaveGeo = {};
let slaveCountries = [];

const defaultModulesSettings = {
	onConnectModules: []
};

const defaultServerSettings = {
	port: 8080
};

let modulesSettings = {};
let serverSettings = {};

let mod = {};
mod.onModuleConfigChange = (module, config, def) => {
	(!def ? modulesSettings : defaultModulesSettings)[module.name] = config;
	if (!def) saveSettings();
}

mod.getModuleSettings = () => {
	return modulesSettings;
}
Modules.importModules(mod);

modulesSettings = { ...defaultModulesSettings };
serverSettings = { ...defaultServerSettings };

let control_panel_html_path = path.join(__dirname, "control_panel");
let client_html_path = path.join(__dirname, "..", "client");

app.set("view engine", "pug");
app.set("views", control_panel_html_path);
app.use(express.static(control_panel_html_path));

// Add headers
app.use((req, res, next) => {

	// Website you wish to allow to connect
	res.setHeader('Access-Control-Allow-Origin', '*');

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

io.origins((orig, call) => call(null, true));

app.get("/", (req, res) => {
	res.render("index", { version: ver });
});

app.get("/clients", (req, res) => {
	res.render("clients");
});

app.use("/client", express.static(client_html_path));

Modules.getAllModules().forEach(module => {
	if (module.widgetPaths[0]) {
		app.use("/" + module.name, express.static(path.resolve(path.parse(module.widgetPaths[0]).dir)));
	}
});

app.get("/modules", (req, res) => {
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
		modulesSettings: modulesSettings,
		modules: Modules.getAllModules(),
		renderedWidgets: renderedWidgets
	});
});

io.on("connection", (socket) => {
	socket.ip = (socket.handshake.headers["x-forwarded-for"] || socket.request.connection.remoteAddress);

	let ipP = ipaddr.parse(socket.ip);
	if (ipP.range() == "ipv4Mapped") socket.ip = ipP.toIPv4Address().toString();

	socket.debugExecFunc = debug;

	socket.on("disconnect", () => {
		if (socket.mode == "slave" && slaveSockets.indexOf(socket) != -1) {
			slaveSockets.pop(socket);

			slaveGeo[socket.country].pop(socket);

			if (slaveGeo[socket.country].length == 0)
				slaveCountries.pop(socket.country);

			console.log("Slave disconnected (" + socket.ip + ")");
		} else {
			console.log("Master disconnected (" + socket.ip + ")");
		}
	});

	//TODO: Crypto validation on master connection
	socket.on("postConnection", (mode, ip) => {
		socket.mode = mode;
		socket.ip = ip ? ip : socket.ip;

		if (mode === "slave") {
			slaveSockets.push(socket);

			console.log("New slave connection from: " + socket.ip);

			modulesSettings.onConnectModules.forEach((name) => {
				Modules.getModule(name).exec(socket);
			});

			request("http://www.geoplugin.net/json.gp?ip=" + ip, (error, response, body) => {
				let json = JSON.parse(body);

				if (slaveGeo[json["geoplugin_countryName"]] == null)
					slaveGeo[json["geoplugin_countryName"]] = [];

				slaveGeo[json["geoplugin_countryName"]].push(ip);

				socket.country = json["geoplugin_countryName"];

				if (slaveCountries.indexOf(socket.country) == -1)
					slaveCountries.push(socket.country);
			});
		} else if (mode === "master") {
			socket.on("updateClientData", () => {

				let data = [];

				for (let i = 0; i < slaveCountries.length; i++) {
					data[i] = [slaveCountries[i], slaveGeo[slaveCountries[i]].length];
				}

				socket.emit("getClientsData", data, slaveGeo);
			});

			socket.on("getModuleSettings", () => {
				socket.emit("getModuleSettings", modulesSettings);
			});

			socket.on("updateModuleSettings", (data) => {
				modulesSettings = data;
				saveSettings();
			});

			socket.on("shutdown", () => {
				process.exit();
			});

			Modules.getAllModules().forEach(module => {
				module.controlPanelEvents.forEach(event => {
					socket.on(event.name, data => {
						event.function(data, socket, slaveSockets);
					});
				});
			});

			console.log("New master connection from: " + socket.ip);
		}
	});

});

function onShutdown(exitCode, signal) {
	console.log("Shutdown!");
}

function saveSettings(callback) {

	modulesSettings = Object.assign(defaultModulesSettings, modulesSettings);
	serverSettings = Object.assign(defaultServerSettings, serverSettings);

	let modulesSettingsJson = JSON.stringify(modulesSettings, null, "\t");
	fs.writeFile("modulesSettings.json", modulesSettingsJson, () => {

		let serverSettingsJson = JSON.stringify(serverSettings, null, "\t");
		fs.writeFileSync("serverSettings.json", serverSettingsJson);

		if (callback) callback();
	});

}

function loadSettings(callback) {
	if (fs.existsSync("modulesSettings.json")) {
		let data = fs.readFileSync("modulesSettings.json");

		modulesSettings = JSON.parse(data);
	}
	if (fs.existsSync("serverSettings.json")) {
		let data = fs.readFileSync("serverSettings.json");

		serverSettings = JSON.parse(data);
	}
	saveSettings();

	if (callback) callback();
}

loadSettings(() => {

	http.listen(serverSettings.port, () => {
		console.log("Listening on *:" + serverSettings.port);
		console.log("Control panel: http://localhost:" + serverSettings.port + "/");

		nodeCleanup(onShutdown);
	});

});

