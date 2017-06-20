// app/routes/dice/signup.js

const debug = require("debug")("lncliweb:routes:dice");
const request = require("request");

module.exports = function (dice) {
	return function (req, res) {
		dice.signup(req.body.username, req.body.password).then(function (account) {
			req.session.account = account;
			res.json(account);
		}, function (err) {
			debug("signup error", err);
			res.send({ error: err });
		});
	};
};
