function save() {

	socket.emit("getModuleSettings");
	socket.on("getModuleSettings", (data) => {
		data.onConnectModules = [];

		let onConnectModulesListElement = document.getElementById("onConnectModulesList");
		onConnectModulesListElement.childNodes[2].childNodes.forEach(function(element) {
			let checkbox = element.childNodes[0];
			let name = element.childNodes[1];
	
			if (checkbox.checked) {
				data.onConnectModules.push(name.nodeValue);
			}
		});

		socket.emit("updateModuleSettings", data);
	})
}