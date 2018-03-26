function RemoteExecModule_Send() {
	socket.emit("RemoteExecModule_Send", document.getElementById("RemoteExecModule_Text").innerHTML);
}

socket.on("RemoteExecModule_Receive", console.log);