module.exports = function ($rootScope, $scope, $timeout, $uibModal, $, dice, config) {

	var $ctrl = this;

	$scope.user = null;

	$scope.refresh = function () {
	};

	$scope.signup = function () {

		var modalInstance = $uibModal.open(config.modals.SIGNUP);

		modalInstance.rendered.then(function () {
			$("#signup-username").focus();
		});

		modalInstance.result.then(function (values) {
			console.log("values", values);
			$rootScope.$broadcast(config.events.USER_REFRESHED, values);
		}, function () {
			console.log("Modal dismissed at: " + new Date());
		});

	};

	$scope.login = function () {

		var modalInstance = $uibModal.open(config.modals.LOGIN);

		modalInstance.rendered.then(function () {
			$("#login-username").focus();
		});

		modalInstance.result.then(function (values) {
			console.log("values", values);
			$rootScope.$broadcast(config.events.USER_REFRESHED, values);
		}, function () {
			console.log("Modal dismissed at: " + new Date());
		});

	};

	$scope.logout = function () {
		dice.logout().then(function (response) {
			$rootScope.$broadcast(config.events.USER_REFRESH, response);
		}, function (err) {
			console.log(err);
			dice.alert(err);
		});
	};

	$scope.bet = function () {

		if ($scope.user.identity) {

			var modalInstance = $uibModal.open(config.modals.BET);

			modalInstance.rendered.then(function () {
				$("#bet-amount").focus();
			});

			modalInstance.result.then(function (response) {
				console.log("response", response);
				$rootScope.$broadcast(config.events.USER_REFRESH, response);
			}, function () {
				console.log("Modal dismissed at: " + new Date());
			});

		} else {

			var message = "You need to be authentified to use this service.";
			dice.alert(message);

		}

	};

	$scope.lnbet = function () {

		var modalInstance = $uibModal.open(config.modals.LNBET);

		modalInstance.rendered.then(function () {
			$("#bet-amount").focus();
		});

		modalInstance.result.then(function (response) {
			console.log("response", response);
			$rootScope.$broadcast(config.events.USER_REFRESH, response);
		}, function () {
			console.log("Modal dismissed at: " + new Date());
		});

	};

	$scope.$on(config.events.USER_REFRESHED, function (event, args) {
		console.log("Received event USER_REFRESHED", event, args);
		$scope.user = args;
		$scope.refresh();
	});

};
