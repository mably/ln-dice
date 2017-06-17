// app/routes/dice/tip.js

const debug = require("debug")("lncliweb:routes:dice");

module.exports = function (dice) {
	return function (req, res) {
		debug(req.body);
		dice.lntipCommand(req.body).then(function (response) {
			res.json(response);
		}, function (err) {
			res.send(err);
		});
	};
};
