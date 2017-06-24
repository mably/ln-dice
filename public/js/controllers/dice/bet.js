var randomBytes = require("randombytes");

module.exports = function ($scope, $uibModalInstance, $timeout, defaults, dice) {

	var $ctrl = this;

	var listenersIds = [];

	$ctrl.spinner = 0;

	$ctrl.values = defaults;

	$ctrl.refreshSeed = function () {
		$ctrl.values.seed = randomBytes(32).toString("hex");
	};

	$ctrl.refreshBetInfo = function () {
		if ($ctrl.values.amount && $ctrl.values.factor) {
			$ctrl.spinner++;
			$ctrl.betResult = null;
			dice.betInfo($ctrl.values.amount, $ctrl.values.factor, $ctrl.values.choice).then(function (response) {
				$ctrl.spinner--;
				$ctrl.betInfo = null;
				console.log("BetInfo", response);
				if (response.data.error) {
					if ($ctrl.isClosed) {
						dice.alert(response.data.error);
					} else {
						$ctrl.dismissInformation();
						$ctrl.warning = response.data.error;
					}
				} else {
					$ctrl.dismissWarning();
					$ctrl.dismissInformation();
					$ctrl.betInfo = response.data;
				}
			}, function (err) {
				$ctrl.spinner--;
				$ctrl.betInfo = null;
				console.log(err);
				var errmsg = err.message || err.statusText;
				if ($ctrl.isClosed) {
					dice.alert(errmsg);
				} else {
					$ctrl.warning = errmsg;
					$ctrl.dismissInformation();
				}
			});
		}
	};

	$ctrl.refreshSeed();
	$ctrl.refreshBetInfo();

	$ctrl.ok = function () {
		$ctrl.spinner++;
		dice.bet($ctrl.values.amount, $ctrl.values.factor, $ctrl.values.choice, $ctrl.values.seed, $ctrl.values.winpayreq).then(function (response) {
			$ctrl.betResult = null;
			console.log("Bet", response);
			if (response.data.error) {
				$ctrl.spinner--;
				if ($ctrl.isClosed) {
					dice.alert(response.data.error);
				} else {
					$ctrl.dismissInformation();
					$ctrl.warning = response.data.error;
				}
			} else {
				if (response.data.paymentrequest) {
					$ctrl.dismissWarning();
					$ctrl.information = "Your bet have been successfully registered!<br/><br/>Please send your bet payment using the payment request displayed below within 5 minutes.";
					$ctrl.paymentrequest = response.data.paymentrequest;
					var requestId = response.data.rid;
					// timer to not wait indefinitely for first websocket event
					var waitTimer = $timeout(function () {
						$ctrl.spinner--;
						listenersIds.splice(listenersIds.indexOf(requestId), 1);
						dice.unregisterWSRequestListener(requestId);
						$uibModalInstance.close($ctrl.values);
					}, 300000); // Wait 300 seconds max for socket response
					listenersIds.push(requestId);
					// We wait for first websocket event to check for errors
					dice.registerWSRequestListener(requestId, function (response) {
						console.log(response);
						$ctrl.spinner--;
						$timeout.cancel(waitTimer);
						listenersIds.splice(listenersIds.indexOf(requestId), 1);
						dice.unregisterWSRequestListener(requestId);
						if ($ctrl.isClosed) {
							return true;
						} else {
							if (response.evt === "error") {
								$ctrl.warning = response.data.error;
								return false;
							} else {
								$ctrl.betResult = response.data;
								$ctrl.betResultJSON = JSON.stringify(response.data, null, "\t");	
								$ctrl.paymentrequest = null;
								if (response.data.winamount > 0) {
									$ctrl.dismissWarning();
									$ctrl.information = "Successful bet! You won " + response.data.winamount + ".";
								} else {
									$ctrl.dismissInformation();
									$ctrl.warning = "You lost! Try again, you might be luckier next time.";
								}
								return false;
							}
						}
					});
				} else {
					$ctrl.spinner--;
					$ctrl.betResult = response.data;
					$ctrl.betResultJSON = JSON.stringify(response.data, null, "\t");
					if (response.data.winamount > 0) {
						$ctrl.dismissWarning();
						$ctrl.information = "Successful bet! You won " + response.data.winamount + ".";
					} else {
						$ctrl.dismissInformation();
						$ctrl.warning = "You lost! Try again, you might be luckier next time.";
					}
				}
			}
		}, function (err) {
			$ctrl.spinner--;
			$ctrl.betResult = null;
			console.log(err);
			var errmsg = err.message || err.statusText;
			if ($ctrl.isClosed) {
				dice.alert(errmsg);
			} else {
				$ctrl.warning = errmsg;
				$ctrl.dismissInformation();
			}
		});
	};

	$ctrl.cancel = function () {
		$uibModalInstance.dismiss("cancel");
	};

	$ctrl.dismissAlerts = function () {
		$ctrl.dismissWarning();
		$ctrl.dismissInformation();
	};

	$ctrl.dismissWarning = function () {
		$ctrl.warning = null;
	};

	$ctrl.dismissInformation = function () {
		$ctrl.information = null;
	};

	$ctrl.payreqCopied = function () {
		$ctrl.payreqCopiedTip = true;
		$timeout(function () {
			$ctrl.payreqCopiedTip = false;
		}, 500);
	};

	var unregisterWSRequestListeners = function () {
		for (var i = 0; i < listenersIds.length; i++) {
			dice.unregisterWSRequestListener(listenersIds[i]);
		}
		listenersIds.length = 0;
	};

	$scope.$on("modal.closing", function (event, reason, closed) {
		console.log("modal.closing: " + (closed ? "close" : "dismiss") + "(" + reason + ")");
		$ctrl.isClosed = true;
		unregisterWSRequestListeners();
	});
};
