module.exports = class Module {
	constructor() {
		this.remoteFunctions = {};
		this.deps = [];
		this.config = {};
		this.name = "";
		this.isAutoRun = true;
		this.controlPanelEvents = [];
	}
	
	/**
	 * 
	 * @param {string} name sets the name of this module
	 */
	setName(name) {
		this.name = name;
	}
	
	/**
	 * Adds a new remote function to this module
	 * @param {string} name Name of the remote function
	 * @param {function} func Remote function's code {EXECUTED ON THE TARGET}
	 */
	addRemoteFunction(name, func) {
		this.remoteFunctions[name] = func;
	}
	
	/**
	 * Adds a dependenyc to this module. Useful for including libraries that must be present on the target for execution of the remote function(s)
	 * @param {string} url Url to the js file that is going to get included
	 * @param {string} integrity Sets the integrity and crossoigin parameters of the script tag (SRI)
	 * @see https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity
	 */
	addDependencies(url, integrity) {
		let dep = {};
		dep.url = url;
		dep.integrity = integrity || null;
		this.deps.push(dep);
	}	
	
	/**
	 * Sets the default config obj
	 * @param {*} config Object that is provided to you in the main function. Useful if you want to make your module configurable
	 */
	setDefaultConfig(config) {
		this.config = config;
	}
	
	/**
	 * Sets a valuse of the config object
	 * @param {*} name 
	 * @param {*} val 
	 */
	setConfigOpt(name, val) {
		this.config[name] = val;
	}	
	
	/**
	 * Sets the main function of the module.
	 * @param {function} mainFunc main function of the module {EXECUTED ON THE SERVER}
	 */
	setMainFunction(mainFunc) {
		this.mainFunc = mainFunc;
	}	
	
	/**
	 * Should this module appear in the control panel as a toggleable auto run module?
	 * @param {boolean} bool 
	 */
	setAutoRunStatus(bool) {
		this.isAutoRun = bool;
	}
	
	addControlPanelEvent(name, func) {
		this.controlPanelEvents.push({
			function: func,
			name: name
		});
	}

	/**
	 * Execute the module
	 * @param {SocketIO.Socket} socket SocketIO socket to execute the module on.
	 * @param {*} config [Optional] The config object. If not specified the default config object is used
	 */
	exec(socket, config) {
		return this.mainFunc(this, socket, config || this.config);
	}
};