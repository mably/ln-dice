// app/routes/dice/bet.js

const debug = require("debug")("lncliweb:routes:dice");

module.exports = function (dice) {
	return function (req, res) {
		debug(req.body);
		if (req.session.account) {
			dice.accountbet(req.session.account, req.body.amount, req.body.factor, req.body.choice, req.body.seed).then(function (response) {
				res.json(response);
			}, function (err) {
				debug("account bet error", err);
				res.send({ error: err });
			});
		} else {
			if (req.body.winpayreq) {
				if (!req.session.identity) {
					req.session.identity = dice.initIdentity("anonymous");
				}
				dice.lnbet(req.body.sid, req.body.rid, req.session.identity, req.body.amount, req.body.factor, req.body.choice, req.body.seed, req.body.winpayreq).then(function (response) {
					res.json(response);
				}, function (err) {
					debug("ln bet error", err);
					res.send({ error: err });
				});
			} else {
				var err = "Your payout LN payment request is missing!";
				debug("ln bet error", err);
				res.send({ error: err });
			}
		}
	};
};
