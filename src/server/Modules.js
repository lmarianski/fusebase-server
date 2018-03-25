const fs = require("fs");
const pug = require("pug");

const pluginFolder = "./plugins/";
const pluginFolderRelative = "../../plugins/";

let modules = [];
let modulesDict = {};

fs.readdirSync(pluginFolder).forEach(file => {

	if (!fs.lstatSync(pluginFolder+file).isDirectory()) {
		let module = require(pluginFolderRelative+file);
		modules.push(module);
		modulesDict[module.name] = module;
	} else {
		let module;
		fs.readdirSync(pluginFolder+file).forEach(dirFile => {
			if (dirFile.match(".*\\.js")) {
				module = require(pluginFolderRelative+file+"/"+dirFile);
			} else if (dirFile.match(".*\\.pug")) {
				module.widgetPath = pluginFolder+file+"/"+dirFile;
			}
		});
		if (module) {
			modules.push(module);
			modulesDict[module.name] = module;
		}
	}

});

module.exports = {
	getModule: function(name) {
		return modulesDict[name];
	},
	getAllModules: function() {
		return modules;
	}
};