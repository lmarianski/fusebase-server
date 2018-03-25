let Module = require("../../src/server/Module.js");

let M = new Module();

M.setName("RemoteExecModule");

M.setMainFunction(function(module, socket, config) {
	socket.executeFunc(module, "execRemote", null, function(remoteReturn) {

	});

});

M.addRemoteFunction("execRemote", function(code, debug) {
	return eval("function() {"+code+"}();");
});

M.setAutoRunStatus(false);

module.exports = M;