module.exports = function (app) {

	app.controller("ModalAddInvoiceCtrl", ["$scope", "$uibModalInstance", "defaults", "dice", require("./addinvoice")]);
	app.controller("ModalBetCtrl", ["$scope", "$uibModalInstance", "defaults", "dice", require("./bet")]);
	app.controller("ModalLoginCtrl", ["$scope", "$uibModalInstance", "defaults", "dice", require("./login")]);
	app.controller("NavBarCtrl", ["$rootScope", "$scope", "$timeout", "$uibModal", "jQuery", "dice", "config", require("./navbar")]);
	app.controller("ModalSignupCtrl", ["$scope", "$uibModalInstance", "defaults", "dice", require("./signup")]);
	app.controller("UserCtrl", ["$rootScope", "$scope", "$timeout", "$uibModal", "jQuery", "dice", "config", require("./user")]);
	app.controller("ModalWithdrawFundsCtrl", ["$rootScope", "$scope", "$uibModalInstance", "defaults", "dice", "config", require("./withdrawfunds")]);

};
