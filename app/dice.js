// app/dice.js

const debug = require("debug")("lncliweb:dice");
const logger = require("winston");
const Promise = require("promise");
const request = require("request");

// TODO
module.exports = function (lightning, lnd, db, server, diceConfig) {

	var module = {};

	var diceServerUrl = server.getURL();
	debug("dice server url", diceServerUrl);

	var accountsCol = db.collection("dice-accounts");
	accountsCol.createIndex({ diceid: 1 }, { unique: true });
	var invoicesCol = db.collection("dice-invoices");
	var paymentsCol = db.collection("dice-payments");
	var transactionsCol = db.collection("dice-transactions");

	const txprocessor = require("./txprocessor")(db, accountsCol, transactionsCol);

	var invoiceListener = null;

	// register the lnd invoices listener
	var registerLndInvoiceListener = function () {
		invoiceListener = {
			dataReceived: function (data) {
				debug("dice: invoice data received", data);
				try {
					var memo = parseInvoiceMemo(data.memo);
					debug("dice: invoice memo", memo);
					if (memo) {
						paymentsCol.insert([{ data: data }], { w: 1 }, function (err, result) {
							logger.debug("Invoice data received DB insert:", result);
						});
						var diceId = buildDiceId(memo.identity);
						module.dbGetUser(diceId).then(function (user) {
							debug("dbGetUser", user);
							var value = parseInt(data.value);
							if (user) {
								var update = { $inc: { balance:  value } };
								module.dbUpdateUser(diceId, update).then(function (response) {
									debug("dbUpdateUser", response);
								}, function (err) {
									debug("dbUpdateUser error", err);
								});
							} else {
								module.dbCreateUser(diceId, memo.identity, value).then(function (createdUsers) {
									if (createdUsers.length >= 1) {
										debug(createdUsers[0]);
									} else {
										debug("Something went wrong");
									}
								}, function (err) {
									debug("dbCreateUser error", err);
								});
							}
						}, function (err) {
							debug("dbGetUser error", err);
						});
					}
				} catch (err) {
					logger.warn(err);
				}
			}
		};
		lnd.registerInvoiceListener(invoiceListener);
	};

	registerLndInvoiceListener();

	module.getUser = function (identity) {
		var promise = new Promise(function (resolve, reject) {
			var diceId = buildDiceId(identity);
			module.dbGetUser(diceId).then(function (user) {
				debug("dbGetUser", user);
				if (user) {
					resolve(user);
				} else {
					delete identity.ok;
					module.dbCreateUser(diceId, identity, 0).then(function (createdUsers) {
						if (createdUsers.length >= 1) {
							resolve(createdUsers[0]);
						} else {
							reject({ message: "Something went wrong" });
						}
					}, function (err) {
						reject(err);
					});
				}
			}, function (err) {
				debug("dbGetUser error", err);
				reject(err);
			});
		});
		return promise;
	};

	module.bet = function (user, amount, bet) {
		var promise = new Promise(function (resolve, reject) {
			err.error = "Not implemented";
			reject(err);
		});
		return promise;
	};

	var buildDiceId = function (identity) {
		return identity;
	};

	var buildInvoiceMemo = function (user) {
		return "#dice#" + user.identity + "#";
	};

	var parseInvoiceMemo = function (memoStr) {
		var re = /\#dice\#([^#]*)\#/;
		var array = memoStr.match(re);
		var memo;
		if (array && array.length === 2) {
			memo = { identity: array[1] };
		} else {
			memo = null;
		}
		return memo;
	};

	module.addInvoice = function (user, amount) {
		var promise = new Promise(function (resolve, reject) {
			var memo = buildInvoiceMemo(user);
			var params = { memo: memo, value: amount };
			lightning.addInvoice(params, function (err, response) {
				if (err) {
					logger.debug("AddInvoice Error:", err);
					err.error = err.message;
					reject(err);
				} else {
					logger.debug("AddInvoice:", response);
					module.dbAddInvoice({ params: params, response: response });
					resolve(response);
				}
			});
		});
		return promise;
	};

	module.withdrawFunds = function (user, payreq) {
		var promise = new Promise(function (resolve, reject) {
			lightning.decodePayReq({ pay_req: payreq }, function (err, response) {
				if (err) {
					logger.debug("DecodePayReq Error:", err);
					err.error = err.message;
					reject(err);
				} else {
					logger.debug("DecodePayReq:", response);
					var sourceDiceId = buildDiceId(user.identity);
					module.dbGetUser(sourceDiceId).then(function (sourceUser) {
						debug("dbGetUser", sourceUser);
						var amount = parseInt(response.num_satoshis);
						if (amount > sourceUser.balance) {
							reject("Withdrawal rejected, not enough funds in your account.");
						} else {
							module.dbWithdrawFunds(sourceDiceId, amount).then(function (result) {
								var paymentRequest = { payment_request: payreq };
								logger.debug("Sending payment", paymentRequest);
								lightning.sendPaymentSync(paymentRequest, function (err, response) {
									if (err) {
										logger.debug("SendPayment Error:", err);
										err.error = err.message;
										reject(err);
									} else {
										logger.debug("SendPayment:", response);
										resolve(response);
									}
								});
							}, function (reason) {
								reject(reason);
							});
						}
					}, function (reason) {
						reject(reason);
					});
				}
			});
		});
		return promise;
	};

	module.dbAddInvoice = function (invoice) {
		var promise = new Promise(function (resolve, reject) {
			invoicesCol.insert([invoice], { w: 1 }, function (err, result) {
				if (err) {
					reject(err);
				} else {
					logger.debug("AddInvoice DB insert:", result);
					resolve(result);
				}
			});
		});
		return promise;
	};

	module.dbGetUser = function (diceId) {
		var promise = new Promise(function (resolve, reject) {
			accountsCol.find({ diceid: diceId }).toArray(function (err, accounts) {
				if (err) {
					reject(err);
				} else {
					if (accounts.length >= 1) {
						resolve(accounts[0]);
					} else {
						resolve(null);
					}
				}
			});
		});
		return promise;
	};

	module.dbCreateUser = function (diceId, identity, balance) {
		var promise = new Promise(function (resolve, reject) {
			var user = { diceid: diceId, identity: identity, balance: balance, pendingTransactions: [] };
			accountsCol.insert(user, { w: 1 }, function (err, result) {
				if (err) {
					reject(err);
				} else {
					logger.debug("CreateUser DB insert:", result);
					resolve(result);
				}
			});
		});
		return promise;
	};

	module.dbUpdateUser = function (diceId, update) {
		var promise = new Promise(function (resolve, reject) {
			accountsCol.update({ diceid: diceId }, update, { w: 1 }, function (err, result) {
				if (err) {
					reject(err);
				} else {
					logger.debug("dbUpdateUser DB update", result);
					resolve(result);
				}
			});
		});
		return promise;
	};

	module.dbWithdrawFunds = function (diceId, amount) {
		var promise = new Promise(function (resolve, reject) {
			accountsCol.update({ diceid: diceId, balance: { $gte: amount } }, { $inc: { balance: -1 * amount } }, { w: 1 }, function (err, result) {
				if (err) {
					reject(err);
				} else {
					logger.debug("dbWithdrawFunds DB update", result);
					if (result === 1) {
						resolve(result);
					} else {
						reject("Withdrawal rejected, check available funds in your account.");
					}
				}
			});
		});
		return promise;
	};

	return module;
};
