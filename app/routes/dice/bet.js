// app/routes/dice/tip.js

const debug = require("debug")("lncliweb:routes:dice");

module.exports = function (dice) {
	return function (req, res) {
		debug(req.body);
		if (req.session.user) {
			dice.sendTip(req.session.user, req.body.userid, req.body.teamid, req.body.amount).then(function (response) {
				res.json(response);
			}, function (err) {
				debug("sendtip error", err);
				res.send({ error: err });
			});
		} else {
			return res.sendStatus(403); // forbidden
		}
	};
};
