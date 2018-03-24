google.charts.load("current", {
	"packages":["geochart"],
	// Note: you will need to get a mapsApiKey for your project.
	// See: https://developers.google.com/chart/interactive/docs/basic_load_libs#load-settings
	"mapsApiKey": "AIzaSyD-9tSrke72PouQMnMX-a7eZSW0jkFMBWY"
});
google.charts.setOnLoadCallback(drawRegionsMap);

const options = {
	backgroundColor: "black",
	colorAxis: {colors: ["red", "green"]}
};

function drawRegionsMap() {
	let chart = new google.visualization.GeoChart(document.getElementById("clients_map"));
	let clients_list = document.getElementById("clients_list").firstElementChild;
	
	setInterval(function() {
		socket.emit("updateClientData");
	}, 1000);
	
	let oldData;
	
	socket.on("getClientsData", function(dataArray, slaveGeo) {
		let header = [
			["Country", "# of Clients"]
		];
		
		let dataTable = header.concat(dataArray);
		let data = google.visualization.arrayToDataTable(dataTable);
		
		if (oldData == null || !oldData.equals(dataTable)) {
			chart.draw(data, options);
			clients_list.clear();

			for (let country in slaveGeo) {
				for (let i = 0; i < slaveGeo[country].length; i++) {
					clients_list.innerHTML += "<li class=\"flag "+nameIntoCode[country].toLowerCase()+"\">"+slaveGeo[country][i]+"</li>";
				}
			}
		}
		
		oldData = dataTable;
	});
}

// Warn if overriding existing method
if(Array.prototype.equals)
	console.warn("Overriding existing Array.prototype.equals. Possible causes: New API defines the method, there's a framework conflict or you've got double inclusions in your code.");
// attach the .equals method to Array's prototype to call it on any array
Array.prototype.equals = function (array) {
	// if the other array is a falsy value, return
	if (!array)
		return false;

	// compare lengths - can save a lot of time 
	if (this.length != array.length)
		return false;

	for (var i = 0, l=this.length; i < l; i++) {
		// Check if we have nested arrays
		if (this[i] instanceof Array && array[i] instanceof Array) {
			// recurse into the nested arrays
			if (!this[i].equals(array[i]))
				return false;       
		} else if (this[i] != array[i]) { 
			// Warning - two different object instances will never be equal: {x:20} != {x:20}
			return false;   
		}           
	}       
	return true;
};
// Hide method from for-in loops
Object.defineProperty(Array.prototype, "equals", {enumerable: false});

Element.prototype.clear = function() {
	while (this.firstChild) {
		this.removeChild(this.firstChild);
	}
};

Object.defineProperty(Element.prototype, "clear", {enumerable: false});