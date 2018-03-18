module.exports = class Module {
	constructor() {
		this.remoteFunctions = {};
		this.deps = [];
		this.config = {};
		this.name = "";
	}
	
	setName(name) {
		this.name = name;
	}
	
	addRemoteFunction(name, func) {
		this.remoteFunctions[name] = func;
	}
	
	addDependencies(url, integrity) {
		let dep = {};
		dep.url = url;
		dep.integrity = integrity || null;
		this.deps.push(dep);
	}	
	
	setDefaultConfig(config) {
		this.config = config;
	}
	
	setConfigOpt(name, val) {
		this.config[name] = val;
	}	
	
	setMainFunction(mainFunc) {
		this.mainFunc = mainFunc;
	}	
	
	exec(socket, config) {
		return this.mainFunc(this, socket, config || this.config);
	}
}