const fs = require("fs");
let path = require("path");

const Module = require("./api/Module");

const pluginFolder = path.join(__dirname, "..", "plugins");

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

		if (!fs.existsSync(pluginFolder)) fs.mkdirSync(pluginFolder);

		fs.readdirSync(pluginFolder).forEach(file => {

			let module = new Module();
			module.main = main;
			
			let filePath = path.join(pluginFolder, file);

			if (!fs.lstatSync(filePath).isDirectory()) {
				if (file.match(".*\\.js")) {
					module.setName(file.substr(0, file.length-3));

					let init = require(filePath);

					if (init) {
						module = init(module);
					}
				}
			} else {
				fs.readdirSync(filePath).forEach(dirFile => {

					let dirFilePath = path.join(filePath, dirFile);

					if (dirFile === file+".js" || dirFile === "main.js") {
						module.setName(file);

						let init = require(dirFilePath);

						if (init) {
							module = init(module);
						}
					} else if (dirFile.match("widget[0-9]\\.pug")) {
						module.widgetPaths.push(dirFilePath);
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