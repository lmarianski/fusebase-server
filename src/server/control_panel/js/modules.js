function save() {

	let data = {
		onConnectModules: []
	};

	let onConnectModulesListElement = document.getElementById("onConnectModulesList");
	onConnectModulesListElement.childNodes[1].childNodes.forEach(function(element) {
		let checkbox = element.childNodes[0];
		let name = element.childNodes[1];

		if (checkbox.checked) data.onConnectModules.push(name.nodeValue);
	});

	socket.emit("updateModuleSettings", data);
}