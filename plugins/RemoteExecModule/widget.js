function RemoteExecModule_Send() {
	socket.emit("RemoteExecModule_Send", document.getElementById("RemoteExecModule_Text").value);
}

socket.on("RemoteExecModule_Receive", console.log);