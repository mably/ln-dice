module.exports = function (app) {

	app.directive("getAccount", [require("./getaccount")]);
	app.directive("betresultValue", [require("./betresultvalue")]);

};
