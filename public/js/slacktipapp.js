// public/slacktipapp.js
var slacktipapp = angular.module("slacktipapp", ["ui.bootstrap", "LocalStorageModule", "ngclipboard", "ngSanitize", "ngToast", "angular-uuid", "angular-web-notification", "base64"]);

slacktipapp.config(["localStorageServiceProvider", function (localStorageServiceProvider) {
	localStorageServiceProvider
		.setPrefix("slacktip")
		.setStorageType("localStorage")
		.setNotify(true, true);
}]);

slacktipapp.config(['ngToastProvider', function(ngToast) {
	ngToast.configure({
		// verticalPosition: 'bottom',
		// horizontalPosition: 'center'
		animation: 'fade'
	});
}]);

slacktipapp.constant("config", {
	keys: {
	},
	defaults: {
	},
	notif: {
		SUCCESS: "SUCCESS",
		INFO: "INFO",
		WARNING: "WARNING"
	},
	events: {
	},
	modals: {
	}
});
