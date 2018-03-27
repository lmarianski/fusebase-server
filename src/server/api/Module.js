/**
 * Export the module
 */
module.exports = class Module {
	
	/**
	 * The default constructor
	 */
	constructor() {
		/**
		 * @type {object[]}
		 * @private
		 */
		this.remoteFunctions = {};
		
		/**
		 * @type {object[]}
		 * @private
		 */		
		this.deps = [];

		/**
		 * @type {object[]}
		 * @private
		 */
		this.controlPanelEvents = [];

		/**
		 * @type {string[]}
		 * @private
		 */
		this.widgetPaths = [];

		/**
		 * @type {function}
		 * @private
		 */	
		this.mainFunc = null;

		/**
		 * @type {string}
		 * Name of this module
		 */		
		this.name = "";

		/**
		 * @type {boolean}
	 	 * Does this module appear in the control panel as a toggleable auto run module?
		 */		
		this.isAutoRun = true;

		/**
		 * @type {*}
		 */		
		this.config = {};
	}
	
	/**
	 * Sets the name of this module. If it stays unset then the name of the file/folder is used
	 * @param {string} name New name
	 */
	setName(name) {
		this.name = name;
	}
	
	/**
	 * Adds a new remote function to this module
	 * @param {string} name Name of the remote function
	 * @param {function(data:*, debug:boolean): void} func Remote function's code {EXECUTED ON THE TARGET}. the debug option is set by the server and it should be used when doing any logging, the data object is the same one as provided when executing the function
	 */
	addRemoteFunction(name, func) {
		this.remoteFunctions[name] = func;
	}
	
	/**
	 * Executes a remote function on the provided socket
	 * @param {SocketIO.Socket} socket Socket to execute teh function on
	 * @param {Module} module Module defining the function
	 * @param {string} funcName Name of the function
	 * @param {*[]} args Arguments to pass to the function
	 * @param {function(out: *): void} callback Callback
	 * @static
	 */
	executeRemoteFunc(socket, module, funcName, args, callback) {
		let finalObj = {};
		
		finalObj.func = module.remoteFunctions[funcName].toString();
		finalObj.args = args;
		finalObj.deps = module.deps;
		
		socket.emit("executeRemoteFunction", finalObj, socket.debugExecFunc, funcName);

		if (!socket.eventNames().includes(funcName+"Out")) {
			socket.on(funcName+"Out", function(out) {
				if (callback != null) callback(out);
			});
		}
	}	

	/**
	 * Executes a remote function on the provided socket, but uses this as the module parameter
	 * @param {SocketIO.Socket} socket Socket to execute teh function on
	 * @param {string} funcName Name of the function
	 * @param {*[]} args Arguments to pass to the function
	 * @param {function(out: *): void} callback Callback, Optional
	 * @static
	 */
	executeRemoteFuncFromThisModule(socket, funcName, args, callback) {
		this.executeRemoteFunc(socket, this, funcName, args, callback);
	}	

	/**
	 * Adds a dependency to this module. Useful for including libraries that must be present on the target for execution of the remote function(s)
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
	 * Sets a value of the config object
	 * @param {*} key 
	 * @param {*} val 
	 */
	setConfigOpt(key, val) {
		this.config[key] = val;
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
	
	/**
	 * Used for communication with the control panel. After adding an event you can emit it (in the control panel script) by calling socket.emit("name", "data"); the data parameter is going to get returned in the first param of the callback function
	 * @param {string} name 
	 * @param {function(data:*, masterSocket:SocketIO.Socket, slaveSockets:SocketIO.Socket[]): void} func - this is function param.
	 */
	addControlPanelEvent(name, func) {
		this.controlPanelEvents.push({
			function: func,
			name: name
		});
	}

	/**
	 * Executes the module
	 * @param {SocketIO.Socket} socket SocketIO socket to execute the module on.
	 * @param {*} config [Optional] The config object. If not specified the default config object is used
	 */
	exec(socket, config) {
		return this.mainFunc(this, socket, config || this.config);
	}

};