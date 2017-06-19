module.exports = function (app) {

	app.service("lncli", ["$rootScope", "$filter", "$http", "$timeout", "$interval", "$q", "ngToast", "localStorageService", "jQuery", "config", "uuid", "webNotification", "iosocket", require("./lncli")]);

};
