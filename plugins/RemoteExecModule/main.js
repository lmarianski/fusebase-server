let Module = require("../../src/server/Module.js");

let M = new Module();

M.addControlPanelEvent("RemoteExecModule_Send", (data, masterSocket, slaveSockets) => {
	slaveSockets.forEach(socket => {
		socket.executeFunc(M, "execRemote", data, out => masterSocket.emit("RemoteExecModule_Receive", out));
	});
});

M.addRemoteFunction("execRemote", function(code, debug) {
	return eval(code);
});

M.setAutoRunStatus(false);

module.exports = M;