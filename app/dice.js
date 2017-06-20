// app/dice.js

const debug = require("debug")("lncliweb:dice");
const logger = require("winston");
const Promise = require("promise");
const request = require("request");
const crypto = require("crypto");
const bCrypt = require("bcrypt-nodejs");

// TODO
module.exports = function (lightning, lnd, db, server, diceConfig) {

	var module = {};

	var diceServerUrl = server.getURL();
	debug("dice server url", diceServerUrl);

	var accountsCol = db.collection("dice-accounts");
	accountsCol.createIndex({ accountid: 1 }, { unique: true });
	var invoicesCol = db.collection("dice-invoices");
	invoicesCol.createIndex({ hash: 1 });
	invoicesCol.createIndex({ accountid: 1 });
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
						module.dbGetInvoice(memo.hash).then(function (invoice) {
							debug("dbGetInvoice", invoice);
							var value = parseInt(data.value);
							if (invoice) {
								var update = { $inc: { balance:  value } };
								module.dbUpdateAccount(invoice.accountid, update).then(function (response) {
									debug("dbUpdateAccount", response);
								}, function (err) {
									debug("dbUpdateAccount error", err);
								});
							} else {
								debug("Invoice [" + memo.hash + "] not found");
							}
						}, function (err) {
							debug("dbGetInvoice error", err);
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

	module.signup = function (username, password) {
		var promise = new Promise(function (resolve, reject) {
			var accountId = buildAccountId({ username: username });
			module.dbGetAccount(accountId).then(function (account) {
				debug("signup", account);
				if (account) {
					reject({ message: "Username not available." });
				} else {
					var identity = { username: username, password: createPasswordHash(password) };
					module.dbCreateAccount(accountId, identity, 0).then(function (createdUsers) {
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
				debug("signup error", err);
				reject(err);
			});
		});
		return promise;
	};

	module.login = function (username, password) {
		var promise = new Promise(function (resolve, reject) {
			var accountId = buildAccountId({ username: username });
			module.dbGetAccount(accountId).then(function (account) {
				debug("dbGetAccount", account);
				if (account) {
					if (bCrypt.compareSync(password, account.identity.password)) {
						resolve(account);
					} else {
						reject({ message: "User unknown or invalid password." });
					}
				} else {
					reject({ message: "User unknown or invalid password." });
				}
			}, function (err) {
				debug("login error", err);
				reject(err);
			});
		});
		return promise;
	};

	module.getAccount = function (identity) {
		var promise = new Promise(function (resolve, reject) {
			var accountId = buildAccountId(identity);
			module.dbGetAccount(accountId).then(function (account) {
				debug("dbGetAccount", account);
				if (account) {
					resolve(account);
				} else {
					reject({ message: "Invalid account." });
				}
			}, function (err) {
				debug("dbGetAccount error", err);
				reject(err);
			});
		});
		return promise;
	};

	module.bet = function (account, amount, bet) {
		var promise = new Promise(function (resolve, reject) {
			err.error = "Not implemented";
			reject(err);
		});
		return promise;
	};

	var isValidAccountPassword = function (account, password) {
		return bCrypt.compareSync(password, account.identity.password);
	};

	// Generates hash using bCrypt
	var createPasswordHash = function (password) {
		return bCrypt.hashSync(password, bCrypt.genSaltSync(10), null);
	};

	var buildAccountId = function (identity) {
		return identity.username;
	};

	var buildInvoiceMemo = function (invoiceHash) {
		return "#dice#" + invoiceHash + "#";
	};

	var parseInvoiceMemo = function (memoStr) {
		var re = /\#dice\#([^#]*)\#/;
		var array = memoStr.match(re);
		var memo;
		if (array && array.length === 2) {
			memo = { hash: array[1] };
		} else {
			memo = null;
		}
		return memo;
	};

	module.addInvoice = function (account, amount) {
		var promise = new Promise(function (resolve, reject) {
			var accountId = buildAccountId(account.identity);
			var invoiceId = crypto.randomBytes(32).toString("base64");
			var hash = crypto.createHash("sha256").update(invoiceId + accountId, "utf8").digest("base64");
			var memo = buildInvoiceMemo(hash);
			var params = { memo: memo, value: amount };
			lightning.addInvoice(params, function (err, response) {
				if (err) {
					logger.debug("AddInvoice Error:", err);
					err.error = err.message;
					reject(err);
				} else {
					logger.debug("AddInvoice:", response);
					module.dbAddInvoice({ hash: hash, invoiceid: invoiceId, accountid: accountId, params: params, response: response });
					resolve(response);
				}
			});
		});
		return promise;
	};

	module.withdrawFunds = function (account, payreq) {
		var promise = new Promise(function (resolve, reject) {
			lightning.decodePayReq({ pay_req: payreq }, function (err, response) {
				if (err) {
					logger.debug("DecodePayReq Error:", err);
					err.error = err.message;
					reject(err);
				} else {
					logger.debug("DecodePayReq:", response);
					var sourceAccountId = buildAccountId(account.identity);
					module.dbGetAccount(sourceAccountId).then(function (sourceUser) {
						debug("dbGetAccount", sourceUser);
						var amount = parseInt(response.num_satoshis);
						if (amount > sourceUser.balance) {
							reject("Withdrawal rejected, not enough funds in your account.");
						} else {
							module.dbWithdrawFunds(sourceAccountId, amount).then(function (result) {
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

	module.dbGetInvoice = function (invoiceHash) {
		var promise = new Promise(function (resolve, reject) {
			invoicesCol.find({ hash: invoiceHash }).toArray(function (err, invoices) {
				if (err) {
					reject(err);
				} else {
					if (invoices.length >= 1) {
						resolve(invoices[0]);
					} else {
						resolve(null);
					}
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

	module.dbGetAccount = function (accountId) {
		var promise = new Promise(function (resolve, reject) {
			accountsCol.find({ accountid: accountId }).toArray(function (err, accounts) {
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

	module.dbCreateAccount = function (accountId, identity, balance) {
		var promise = new Promise(function (resolve, reject) {
			var account = { accountid: accountId, identity: identity, balance: balance, pendingTransactions: [] };
			accountsCol.insert(account, { w: 1 }, function (err, result) {
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

	module.dbUpdateAccount = function (accountId, update) {
		var promise = new Promise(function (resolve, reject) {
			accountsCol.update({ accountid: accountId }, update, { w: 1 }, function (err, result) {
				if (err) {
					reject(err);
				} else {
					logger.debug("dbUpdateAccount DB update", result);
					resolve(result);
				}
			});
		});
		return promise;
	};

	module.dbWithdrawFunds = function (accountId, amount) {
		var promise = new Promise(function (resolve, reject) {
			accountsCol.update({ accountid: accountId, balance: { $gte: amount } }, { $inc: { balance: -1 * amount } }, { w: 1 }, function (err, result) {
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
