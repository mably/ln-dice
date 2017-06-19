module.exports = function (app) {

	app.service("dice", ["$rootScope", "$filter", "$http", "$timeout", "$interval", "$q", "ngToast", "localStorageService", "jQuery", "config", "uuid", "webNotification", "iosocket", require("./dice")]);

};
