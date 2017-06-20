// app/routes/dice/withdrawfunds.js

const debug = require("debug")("lncliweb:routes:dice");
const logger = require("winston");

module.exports = function (dice) {
	return function (req, res) {
		if (req.session.account) {
			dice.withdrawFunds(req.session.account, req.body.payreq).then(function (response) {
				res.json(response);
			}, function (err) {
				res.status(400).send({ error: err });
			});
		} else {
			res.status(403).send({ error: "Not connected" }); // forbidden
		}
	};
};
