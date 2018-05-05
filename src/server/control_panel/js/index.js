const socketConf = {
	transports: ["websocket"]
}
const socket = io(socketConf);

// on reconnection, reset the transports option, as the Websocket
// connection may have failed (caused by proxy, firewall, browser, ...)
socket.on("reconnect_attempt", () => {
	socket.io.opts.transports = ["polling", "websocket"];
});

socket.on("connection", () => {
	socket.emit("postConnection", "master");
});
