// app/routes/dice/betinfo.js

const debug = require("debug")("lncliweb:routes:dice");

module.exports = function (dice) {
	return function (req, res) {
		debug(req.body);
		var identity;
		if (req.session.account) {
			identity = req.session.account.identity;
		} else {
			if (!req.session.identity) {
				req.session.identity = dice.initIdentity("anonymous");
			}
			identity = req.session.identity;
		}
		dice.betInfo(identity, req.body.amount, req.body.factor, req.body.choice).then(function (response) {
			res.json(response);
		}, function (err) {
			debug("betinfo error", err);
			res.send({ error: err });
		});
	};
};
