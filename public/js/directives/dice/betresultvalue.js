module.exports = function () {
	return {
		restrict: "E",
		replace: false,
		transclude: false,
		require: "ngModel",
		link: function (scope, element, attrs, ngModel) {
			scope.$watch(function () {
				return ngModel.$modelValue;
			}, function (newValue) {
				if (newValue) {
					console.log("newValue = " + newValue);
					element.empty();
					var valueElt = angular.element("<span/>");
					var foundElt = angular.element("<strong/>");
					foundElt.text(newValue.value);
					valueElt.append(foundElt);
					if (newValue.value <= newValue.threshold) {
						valueElt.addClass("text-success");
						valueElt.append(" <= " + newValue.threshold);
					} else {
						valueElt.addClass("text-danger");
						valueElt.append(" > " + newValue.threshold);
					}
					element.append(valueElt);
				}
			});
		}
	};
};
