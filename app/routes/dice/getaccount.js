// app/routes/dice/getaccount.js

const debug = require("debug")("lncliweb:routes:dice");

module.exports = function (dice) {
	return function (req, res) {
		if (req.session.account) {
			debug(req.session.account);
			dice.getAccount(req.session.account.identity).then(function (account) {
				res.json(account);
			}, function (err) {
				res.json({ message: err.message });
			});
		} else {
			res.json({ message: "Not connected" });
		}
	};
};
