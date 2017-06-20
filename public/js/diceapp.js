// public/diceapp.js
var css = require("../css/diceapp.css");

window.jQuery = require("jquery");
require("bootstrap");

const angular = require("angular");
require("angular-ui-bootstrap");
require("angular-local-storage");
require("ngclipboard");
require("angular-sanitize");
const bootbox = require("bootbox");
require("ng-toast");
require("angular-uuid");
window.webNotification = require("simple-web-notification"); // required by angular-web-notification
require("angular-web-notification");
require("angular-base64");

const diceapp = angular.module("diceapp", ["ui.bootstrap", "LocalStorageModule", "ngclipboard", "ngSanitize", "ngToast", "angular-uuid", "angular-web-notification", "base64"]);

diceapp.value("jQuery", window.jQuery);
diceapp.value("bootbox", bootbox);

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
		HELLO_WS: "hello",
		INVOICE_WS: "invoice",
		BETRESULT_WS: "betresult",
		USER_REFRESH: "user.refresh",
		USER_REFRESHED: "user.refreshed",
	},
	modals: {
		SIGNUP: {
			animation: true,
			ariaLabelledBy: "signup-modal-title",
			ariaDescribedBy: "signup-modal-body",
			templateUrl: "templates/partials/dice/signup.html",
			controller: "ModalSignupCtrl",
			controllerAs: "$ctrl",
			size: "lg",
			resolve: {
				defaults: function () {
					return {
						// Nothing
					};
				}
			}
		},
		LOGIN: {
			animation: true,
			ariaLabelledBy: "login-modal-title",
			ariaDescribedBy: "login-modal-body",
			templateUrl: "templates/partials/dice/login.html",
			controller: "ModalLoginCtrl",
			controllerAs: "$ctrl",
			size: "lg",
			resolve: {
				defaults: function () {
					return {
						// Nothing
					};
				}
			}
		},
		BET: {
			animation: true,
			ariaLabelledBy: "bet-modal-title",
			ariaDescribedBy: "bet-modal-body",
			templateUrl: "templates/partials/dice/bet.html",
			controller: "ModalBetCtrl",
			controllerAs: "$ctrl",
			size: "lg",
			resolve: {
				defaults: function () {
					return {
						amount: 100,
						factor: 2.0
					};
				}
			}
		},
		LNBET: {
			animation: true,
			ariaLabelledBy: "bet-modal-title",
			ariaDescribedBy: "bet-modal-body",
			templateUrl: "templates/partials/dice/lnbet.html",
			controller: "ModalBetCtrl",
			controllerAs: "$ctrl",
			size: "lg",
			resolve: {
				defaults: function () {
					return {
						amount: 100,
						factor: 2.0
					};
				}
			}
		}
	}
});

require("./filters")(diceapp);
require("./factories")(diceapp);
require("./controllers/dice")(diceapp);
require("./directives/dice")(diceapp);
require("./services/dice")(diceapp);
