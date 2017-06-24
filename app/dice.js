// app/dice.js

const debug = require("debug")("lncliweb:dice");
const logger = require("winston");
const Promise = require("promise");
const request = require("request");
const crypto = require("crypto");
const bCrypt = require("bcrypt-nodejs");
const BigNumber = require("bignumber.js");
const zpay32 = require("./zpay32.js")();

// TODO
module.exports = function (lightning, lnd, db, server, diceConfig) {

	var module = {};

	var betresultListeners = [];

	var diceServerUrl = server.getURL();
	debug("dice server url", diceServerUrl);

	var accountsCol = db.collection("dice-accounts");
	accountsCol.createIndex({ accountid: 1 }, { unique: true });
	var invoicesCol = db.collection("dice-invoices");
	invoicesCol.createIndex({ hash: 1 });
	invoicesCol.createIndex({ accountid: 1 });
	var paymentsCol = db.collection("dice-payments");
	var transactionsCol = db.collection("dice-transactions");
	var lnbetsCol = db.collection("dice-lnbets");
	lnbetsCol.createIndex({ hash: 1 });

	const txprocessor = require("./txprocessor")(db, accountsCol, transactionsCol);

	var invoiceListener = null;

	var sendBetResultMessage = function (sid, betResultMessage) {
		for (var i = 0; i < betresultListeners.length; i++) {
			try {
				if (betresultListeners[i].socketId == sid) {
					betresultListeners[i].resultReceived(betResultMessage);
				}
			} catch (err) {
				logger.warn(err);
			}
		}
	};

	// register the lnd invoices listener
	var registerLndInvoiceListener = function () {
		invoiceListener = {
			dataReceived: function (data) {
				debug("dice: invoice data received", data);
				try {
					var memo = parseInvoiceMemo(data.memo);
					debug("dice: invoice memo", memo);
					if (memo) {
						if (memo.type == "D") { // Account deposit
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
						} else if (memo.type == "B") { // Bet payment
							module.dbGetBet(memo.hash).then(function (bet) {
								debug("dbGetBet", bet);
								if (bet) {
									var value = parseInt(data.value);
									if (bet.amount == data.value) {
										var betResult = calculateBetResult(
												bet.amount, bet.factor, bet.choice, bet.serverseed, bet.clientseed);
										var betResultMessage = {
											rid: bet.rid,
											evt: "data",
											data: betResult
										};
										sendBetResultMessage(bet.sid, betResultMessage);
										if (betResult.winamount > 0) {
											var paymentRequest = { payment_request: bet.winpayreq };
											lightning.sendPaymentSync(paymentRequest, function (err, response) {
												if (err) {
													logger.debug("SendPayment Error:", err);
													err.error = err.message;
												} else {
													logger.debug("SendPayment Success:", response);
												}
											});
										} else {
											debug("Losing bet");
										}
									} else {
										debug("Value sent is not equal to bet amount");
										var betResultMessage = {
											rid: bet.rid,
											evt: "error",
											data: "Value sent is not equal to bet amount"
										};
										sendBetResultMessage(bet.sid, betResultMessage);
									}
								} else {
									debug("Bet [" + memo.hash + "] not found");
								}
							}, function (err) {
								debug("dbGetBet error", err);
							});
						} else {
							debug("InvoiceListener warning", "Invalid invoice type received", memo);
						}
					}
				} catch (err) {
					logger.warn(err);
				}
			}
		};
		lnd.registerInvoiceListener(invoiceListener);
	};

	registerLndInvoiceListener();

	module.initIdentity = function (username, password) {
		var lastSeedHex = crypto.randomBytes(32).toString("hex");
		var lastSeedHash = crypto.createHash("sha256").update(lastSeedHex).digest("hex");
		var nextSeedHex = crypto.randomBytes(32).toString("hex");
		var nextSeedHash = crypto.createHash("sha256").update(nextSeedHex).digest("hex");
		var identity = {
			username: username,
			lastSeed: lastSeedHex,
			lastSeedHash: lastSeedHash,
			nextSeed: nextSeedHex,
			nextSeedHash: nextSeedHash
		};
		if (password) {
			identity.password = createPasswordHash(password);
		}
		return identity;
	};

	module.signup = function (username, password) {
		var promise = new Promise(function (resolve, reject) {
			var accountId = buildAccountId({ username: username });
			module.dbGetAccount(accountId).then(function (account) {
				debug("signup", account);
				if (account) {
					reject({ message: "Username not available." });
				} else {
					var identity = module.initIdentity(username, password);
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

	var generateBetHashHex = function (serverSeedHex, clientSeedHex) {
		var seedsToHash = serverSeedHex + clientSeedHex;
		return crypto.createHash("sha256").update(seedsToHash).digest("hex");
	};

	var extractValueFromBetHash = function (betHashHex) {
		var value = 0;
		for (var i = 0; i < betHashHex.length - 5; i++) {
			var substr = betHashHex.substring(i, i + 5);
			value = parseInt(substr, 16);
			if (value <= 999999) {
				return value;
			} else {
				value = 0;
			}
		}
		return value;
	};

	var calculateWinThreshold = function (factor) {
		return Math.ceil((1000000 * (1.0 - diceConfig.houseEdgeRatio)) / factor);
	};

	var calculateBetInfo = function (amount, factor, choice) {
		var winThresholdValue = calculateWinThreshold(factor);
		debug("calculateBetInfo winThresholdValue", winThresholdValue);
		var bnAmount = new BigNumber(amount);
		var bnFactor = new BigNumber(factor);
		var bnWinAmount = bnAmount.times(bnFactor);
		var result = {
			amount: amount,
			factor: factor,
			winamount: bnWinAmount.floor().toJSON(),
			threshold: winThresholdValue
		};
		return result;
	};

	var getMinFactor = function () {
		return diceConfig.minFactor;
	};

	var getMaxFactor = function () {
		return diceConfig.maxFactor;
	};

	var getMinAmount = function () {
		return diceConfig.minBetAmount;
	};

	var getMaxAmount = function () {
		return diceConfig.maxBetAmount
	};
	
	var checkInputs = function (amount, factor, reject) {
		if (factor < getMinFactor()) {
			reject("Win multiplier can't be lower than " + getMinFactor() + ".");
		} else if (factor > getMaxFactor()) {
			reject("Win multiplier can't be higher than " + getMaxFactor() + ".");
		} else if (amount < getMinAmount()) {
			reject("Bet amount can't be lower than " + getMinAmount() + ".");
		} else if (amount > getMaxAmount()) {
			reject("Bet amount can't be higher than " + getMaxAmount() + ".");
		} else {
			return true;
		}
	};

	module.betInfo = function (identity, amount, factor, choice) {
		var promise = new Promise(function (resolve, reject) {
			if (checkInputs(amount, factor, reject)) {
				var result = calculateBetInfo(amount, factor, choice);
				result.serverseedhash = identity.nextSeedHash;
				resolve(result);
			}
		});
		return promise;
	};

	var updateIdentitySeeds = function (identity) {
		identity.lastSeed = identity.nextSeed;
		identity.lastSeedHash = identity.nextSeedHash;
		var nextSeedHex = crypto.randomBytes(32).toString("hex");
		identity.nextSeed = nextSeedHex;
		identity.nextSeedHash = crypto.createHash("sha256").update(nextSeedHex).digest("hex");
		return identity;
	}

	var calculateBetResult = function (amount, factor, choice, serverSeedHex, clientSeedHex) {
		var betHashHex = generateBetHashHex(serverSeedHex, clientSeedHex);
		debug("bet betHashHex", betHashHex);
		var betHashExtractedValue = extractValueFromBetHash(betHashHex);
		debug("bet betHashExtractedValue", betHashExtractedValue);
		var winThresholdValue = calculateWinThreshold(factor);
		debug("bet winThresholdValue", winThresholdValue);
		var bnAmount = new BigNumber(amount);
		var bnFactor = new BigNumber(factor);
		var bnWinAmount = (betHashExtractedValue <= winThresholdValue) ? bnAmount.times(bnFactor).floor() : bnAmount.negated();
		var result = {
			amount: amount,
			factor: factor,
			winamount: bnWinAmount.toJSON(),
			threshold: winThresholdValue,
			value: betHashExtractedValue,
			bethashhex: betHashHex,
			serverseed: serverSeedHex,
			clientseed: clientSeedHex
		};
		return result;
	}

	module.accountbet = function (account, amount, factor, choice, clientSeedHex, winPayReq) {
		var promise = new Promise(function (resolve, reject) {
			var tmpIdentity = {};
			Object.assign(tmpIdentity, account.identity);
			debug("accountbet tmpIdentity", tmpIdentity);
			var betResult = calculateBetResult(amount, factor, choice, tmpIdentity.nextSeed, clientSeedHex);
			updateIdentitySeeds(tmpIdentity);
			var update = { $set: { identity: tmpIdentity } }; // TODO update account balance
			module.dbUpdateAccount(account.accountid, update).then(function (updateResult) {
				debug("dbUpdateAccount", updateResult);
				// TODO resfresh session account info with new account balance
				account.identity = tmpIdentity; // to keep session and database synced
				resolve(betResult);
			}, function (err) {
				debug("accountbet error", err);
				reject(err);
			});
		});
		return promise;
	};

	module.lnbet = function (sid, rid, identity, amount, factor, choice, clientSeedHex, winPayReq) {
		var promise = new Promise(function (resolve, reject) {
			if (checkInputs(amount, factor, reject)) {
				var serverSeedHex = identity.nextSeed;
				updateIdentitySeeds(identity);
				var betInfo = calculateBetInfo(amount, factor, choice);
				var decodedPayReq = zpay32.decode(winPayReq);
				debug("decodedPayReq", decodedPayReq);
				if (decodedPayReq.value == betInfo.winamount) {
					module.addBet(sid, rid, amount, factor, choice,
							serverSeedHex, clientSeedHex, winPayReq).then(function (addBetResult) {
						debug("addBet", addBetResult);
						resolve(addBetResult);
					}, function (err) {
						debug("addBet error", err);
						reject(err);
					});
				} else {
					var errMsg = "Your LN payout payment request amount (" + decodedPayReq.value
							+ ") is not equal to your bet winning amount (" + betInfo.winamount + ").";
					debug("lnbet error", errMsg);
					reject(errMsg);
				}
			}
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

	var buildInvoiceMemo = function (type, hash) {
		return "#dice#" + type + "#" + hash + "#";
	};

	var parseInvoiceMemo = function (memoStr) {
		var re = /\#dice\#([^#]*)\#([^#]*)\#/;
		var array = memoStr.match(re);
		var memo;
		if (array && array.length === 3) {
			memo = { 
				type: array[1],
				hash: array[2]
			};
		} else {
			memo = null;
		}
		return memo;
	};

	module.addBet = function (sid, rid, amount, factor, choice, serverSeedHex, clientSeedHex, winPayReq) {
		var promise = new Promise(function (resolve, reject) {
			var betId = crypto.randomBytes(32).toString("base64");
			var hash = crypto.createHash("sha256").update(betId, "utf8").digest("base64");
			var memo = buildInvoiceMemo("B", hash); // B: bet payment
			var params = { memo: memo, value: amount };
			lightning.addInvoice(params, function (err, response) {
				if (err) {
					logger.debug("LN addInvoice Error:", err);
					err.error = err.message;
					reject(err);
				} else {
					logger.debug("LN addInvoice Success:", response);
					module.dbAddBet({ 
						hash: hash,
						betid: betId,
						sid: sid,
						rid: rid,
						amount: amount,
						factor: factor,
						choice: choice,
						serverseed: serverSeedHex,
						clientseed: clientSeedHex,
						winpayreq: winPayReq,
						params: params,
						response: response
					}).then(function (dbAddBetResponse) {
						logger.debug("dbAddBet Success:", dbAddBetResponse);
						var addBetResult = {
							rid: rid,
							paymentrequest: response.payment_request
						};
						resolve(addBetResult);
					}, function (err) {
						logger.debug("dbAddBet Error:", err);
						err.error = err.message;
						reject(err);
					});
				}
			});
		});
		return promise;
	};

	module.addInvoice = function (account, amount) {
		var promise = new Promise(function (resolve, reject) {
			var accountId = buildAccountId(account.identity);
			var invoiceId = crypto.randomBytes(32).toString("base64");
			var hash = crypto.createHash("sha256").update(invoiceId + accountId, "utf8").digest("base64");
			var memo = buildInvoiceMemo("D", hash);
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

	module.dbGetBet = function (betHash) {
		var promise = new Promise(function (resolve, reject) {
			lnbetsCol.find({ hash: betHash }).toArray(function (err, bets) {
				if (err) {
					reject(err);
				} else {
					if (bets.length >= 1) {
						resolve(bets[0]);
					} else {
						resolve(null);
					}
				}
			});
		});
		return promise;
	};

	module.dbAddBet = function (bet) {
		var promise = new Promise(function (resolve, reject) {
			lnbetsCol.insert([bet], { w: 1 }, function (err, result) {
				if (err) {
					reject(err);
				} else {
					logger.debug("AddBet DB insert:", result);
					resolve(result);
				}
			});
		});
		return promise;
	};

	// register betresult listener
	module.registerBetResultListener = function (listener) {
		betresultListeners.push(listener);
		logger.debug("New betresult listener registered, " + betresultListeners.length + " listening now");
	};

	// unregister betresult listener
	module.unregisterBetResultListener = function (listener) {
		betresultListeners.splice(betresultListeners.indexOf(listener), 1);
		logger.debug("betresult listener unregistered, " + betresultListeners.length + " still listening");
	};

	return module;
};
