// app/routes/dice/getuser.js

const debug = require("debug")("lncliweb:routes:dice");

module.exports = function (dice) {
	return function (req, res) {
		if (req.session.user) {
			debug(req.session.user);
			dice.getUser(req.session.user.identity).then(function (user) {
				res.json(user);
			}, function (err) {
				res.json({ message: err.message });
			});
		} else {
			res.json({ message: "Not connected" });
		}
	};
};
