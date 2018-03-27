const fs = require("fs");
let path = require("path");

const pluginFolder = "./plugins/";
const pluginFolderRelative = "../../plugins/";

let modules = [];
let modulesDict = {};

fs.readdirSync(pluginFolder).forEach(file => {

	let module;
	if (!fs.lstatSync(pluginFolder+file).isDirectory()) {
		if (file.match(".*\\.js")) {
			module = require(pluginFolderRelative+file);
			if (!module.name) module.setName(path.parse(file).name);
		}
	} else {
		fs.readdirSync(pluginFolder+file).forEach(dirFile => {
			if (dirFile === file+".js" || dirFile === "main.js") {
				module = require(pluginFolderRelative+file+"/"+dirFile);

				if (!module.name) module.setName(file);
			} else if (dirFile.match("widget[0-9]\\.pug")) {
				module.widgetPaths.push(pluginFolder+file+"/"+dirFile);
			}
		});
	}

	if (module && !modules.includes(module)) {
		modules.push(module);
		modulesDict[module.name] = module;
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