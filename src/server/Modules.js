const fs = require("fs");
let path = require("path");

const Module = require("./api/Module");

const pluginFolder = "./plugins/";
const pluginFolderRelative = "../../plugins/";

let modules = [];
let modulesDict = {};

module.exports = {
	getModule: function(name) {
		return modulesDict[name];
	},
	getAllModules: function() {
		return modules;
	},
	importModules(obj) {
		main = obj;

		fs.readdirSync(pluginFolder).forEach(file => {

			let module = new Module();
			module.main = main;
			
			if (!fs.lstatSync(pluginFolder+file).isDirectory()) {
				if (file.match(".*\\.js")) {
					module.setName(file.substr(0, file.length-3));

					module = require(pluginFolderRelative+file)(module);
				}
			} else {
				fs.readdirSync(pluginFolder+file).forEach(dirFile => {
					if (dirFile === file+".js" || dirFile === "main.js") {
						module.setName(file);

						module = require(pluginFolderRelative+file+"/"+dirFile)(module);
					} else if (dirFile.match("widget[0-9]\\.pug")) {
						module.widgetPaths.push(pluginFolder+file+"/"+dirFile);
					}
				});
			}
		
			module.update();
		
			if (module && !modules.includes(module)) {
				modules.push(module);
				modulesDict[module.name] = module;
			}
		});
		
	}
};