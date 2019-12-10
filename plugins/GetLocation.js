module.exports = (M) => {

    M.setMainFunction((module, socket, config) => {
        M.executeRemoteFuncFromThisModule(socket, "getLocation", {}, out => console.log(out));
    });
	
	M.addRemoteFunction("getLocation", function(code, debug) {
		return eval(code);
	});
	
	M.setAutoRunStatus(true);

	return M;
};

