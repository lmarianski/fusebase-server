let Module = require('./Module.js');
const fs = require('fs');

const pluginFolder = "./plugins/";
const pluginFolderRelative = "../../plugins/";

let modules = [];
let modulesDict = {};

fs.readdirSync(pluginFolder).forEach(file => {

	let module = require(pluginFolderRelative+file);
	modules.push(module);
	modulesDict[module.name] = module;

});

module.exports = {
	getModule: function(name) {
		return modulesDict[name];
	},
	getAllModules: function() {
		return modules;
	}
};