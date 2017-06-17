// public/diceapp.js
var diceapp = angular.module("diceapp", ["ui.bootstrap", "LocalStorageModule", "ngclipboard", "ngSanitize", "ngToast", "angular-uuid", "angular-web-notification", "base64"]);

diceapp.config(["localStorageServiceProvider", function (localStorageServiceProvider) {
	localStorageServiceProvider
		.setPrefix("dice")
		.setStorageType("localStorage")
		.setNotify(true, true);
}]);

diceapp.config(["ngToastProvider", function (ngToast) {
	ngToast.configure({
		// verticalPosition: "bottom",
		// horizontalPosition: "center"
		animation: "fade"
	});
}]);

diceapp.constant("config", {
	keys: {
		AUTO_REFRESH: "autorefresh"
	},
	defaults: {
		AUTO_REFRESH: 60000 // 1 minute
	},
	notif: {
		SUCCESS: "SUCCESS",
		INFO: "INFO",
		WARNING: "WARNING"
	},
	events: {
		INVOICE_WS: "invoice",
		USER_REFRESH: "user.refresh",
		USER_REFRESHED: "user.refreshed"
	},
	modals: {
	}
});
