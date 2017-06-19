module.exports = function ($scope, $uibModalInstance, defaults, dice) {

	var $ctrl = this;

	$ctrl.spinner = 0;

	$ctrl.values = defaults;

	$ctrl.ok = function () {
		$ctrl.spinner++;
		dice.login($ctrl.values.username, $ctrl.values.password).then(function (response) {
			$ctrl.spinner--;
			console.log("Login", response);
			if (response.data.error) {
				if ($ctrl.isClosed) {
					dice.alert(response.data.error);
				} else {
					$ctrl.warning = response.data.error;
				}
			} else {
				$ctrl.warning = null;
				$uibModalInstance.close(response.data);
			}
		}, function (err) {
			$ctrl.spinner--;
			console.log(err);
			var errmsg = err.message || err.statusText;
			if ($ctrl.isClosed) {
				dice.alert(errmsg);
			} else {
				$ctrl.warning = errmsg;
			}
		});
	};

	$ctrl.cancel = function () {
		$uibModalInstance.dismiss("cancel");
	};

	$ctrl.dismissAlert = function () {
		$ctrl.warning = null;
	};

	$scope.$on("modal.closing", function (event, reason, closed) {
		console.log("modal.closing: " + (closed ? "close" : "dismiss") + "(" + reason + ")");
		$ctrl.isClosed = true;
	});
};
