// app/routes/dice/login.js

const debug = require("debug")("lncliweb:routes:dice");
const request = require("request");

module.exports = function (dice) {
	return function (req, res) {
		dice.login(req.body.username, req.body.password).then(function (account) {
			req.session.account = account;
			res.json(account);
		}, function (err) {
			debug("login error", err);
			res.send({ error: err });
		});
	};
};
