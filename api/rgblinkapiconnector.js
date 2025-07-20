// version 2.0-SNAPSHOT

const { UDPHelper } = require('@companion-module/base')

const MAX_COMMANDS_WAITING_FOR_RESPONSES_FOR_POLLING = 5
const COMMANDS_EXPIRE_TIME_SECONDS = 15

class PollingCommand {
	CMD
	DAT1
	DAT2
	DAT3
	DAT4

	constructor(CMD, DAT1, DAT2, DAT3, DAT4) {
		if (CMD.length != 2 || DAT1.length != 2 || DAT2.length != 2 || DAT3.length != 2 || DAT4.length != 2) {
			console.log(`Bad command params: CMD:'${CMD}' DAT1:'${DAT1}' DAT2:'${DAT2}' DAT3:'${DAT3}' DAT4:'${DAT4}'`)
		}

		this.CMD = CMD
		this.DAT1 = DAT1
		this.DAT2 = DAT2
		this.DAT3 = DAT3
		this.DAT4 = DAT4
	}
}

class SentCommand {
	sentDate
	command
	constructor(command, sentDate) {
		this.command = command
		this.sentDate = sentDate
	}
}

class SentCommandStorage {
	commandsSentWithoutResponse = []

	registerSentCommand(cmd) {
		//console.log('OUT ' + cmd)
		this.internalRememberCommand(cmd)
	}

	registerReceivedCommand(cmd) {
		//console.log('IN  ' + cmd)
		this.internalCompareResponseWithSentCommands(cmd)
	}

	getCountElementsWithoutRespond() {
		return this.commandsSentWithoutResponse.length
	}

	deleteExpiredCommands() {
		let currentMs = new Date().getTime()
		let deleted = []
		//for (let i = 0; i < this.commandsSentWithoutResponse.length; i++) {
		let i = this.commandsSentWithoutResponse.length
		while (i--) {
			let sent = this.commandsSentWithoutResponse[i]
			if (sent.sentDate + COMMANDS_EXPIRE_TIME_SECONDS * 1000 < currentMs) {
				deleted = deleted.concat(this.commandsSentWithoutResponse.splice(i, 1))
			}
		}
		return deleted
	}

	deleteAll() {
		this.commandsSentWithoutResponse = []
	}

	internalRememberCommand(cmd) {
		//console.log('Storing ' + cmd + '...')
		this.commandsSentWithoutResponse.push(new SentCommand(cmd, new Date().getTime()))
	}

	internalCompareResponseWithSentCommands(receivedCmd) {
		let receivedCmdId = this.internalGetCmdId(receivedCmd)
		let found = false
		for (let i = 0; i < this.commandsSentWithoutResponse.length; i++) {
			let sent = this.commandsSentWithoutResponse[i]
			let sentCmdId = this.internalGetCmdId(sent.command)
			if (receivedCmdId == sentCmdId) {
				//console.log('Found sent command for response ' + receivedCmd)
				found = true
				this.commandsSentWithoutResponse.splice(i, 1)
				break
			}
		}
		if (!found) {
			console.log('No sent command matching received response: ' + receivedCmd)
		}
	}

	internalGetCmdId(cmd) {
		return cmd.substr(2, 6)
	}
}

class ApiConfig {
	host = undefined
	port = undefined
	polling = undefined
	pollingEdge = undefined 
	logEveryCommand = undefined

	constructor(host, port, polling, pollingEdge, logEveryCommand) {
		this.host = host
		this.port = port
		this.polling = polling
		this.pollingEdge = pollingEdge
		this.logEveryCommand = logEveryCommand
	}
}

class RGBLinkApiConnector {
	EVENT_NAME_ON_DATA_API = 'on_data'
	EVENT_NAME_ON_DATA_API_NOT_STANDARD_LENGTH = 'on_data_not_standard_length'
	EVENT_NAME_ON_CONNECTION_OK = 'on_connection_ok'
	EVENT_NAME_ON_CONNECTION_WARNING = 'on_connection_warning'
	EVENT_NAME_ON_CONNECTION_ERROR = 'on_connection_error'
	PARSE_INT_HEX_MODE = 16

	config = new ApiConfig()
	logProvider
	socket // = new UDPHelper()
	eventsListeners = []
	nextSn = 0
	intervalHandler1s = undefined
	intervalHandler100ms = undefined
	createTime = new Date().getTime()
	sentCommandStorage = new SentCommandStorage()
	pollingQueue = []

	constructor(/*ApiConfig*/ config) {
		this.config = config
		var self = this
		if (this.config && this.config.host) {
			this.createSocket(this.config.host, this.config.port)
		}
		this.intervalHandler1s = setInterval(function () {
			self.onEveryOneSecond()
		}, 1000)
		this.intervalHandler100ms = setInterval(function () {
			self.onEvery100Miliseconds()
		}, 100)
	}

	enableLog(logProvider) {
		this.logProvider = logProvider
	}

	disableLog() {
		this.logProvider = undefined
	}

	myDebug(msg) {
		this.internalMyLog('debug', msg)
	}

	myWarn(msg) {
		this.internalMyLog('warn', msg)
	}

	internalMyLog(level, msg) {
		try {
			if (this.logProvider) {
				this.logProvider.log(level, msg)
			} else {
				console.log(msg)
			}
		} catch (ex) {
			console.log(ex) // is it log anything?
		}
	}

	onEveryOneSecond() {
		if (this.config && this.config.polling) {
			if (typeof this.askAboutStatus === 'function') {
				this.myWarn('Please replace askAboutStatus function with getPollingCommands')
				this.askAboutStatus()
			}
		}
	}

	onEvery100Miliseconds() {
		this.doPolling()
	}

	doPolling(force = false) {
		// send polling commands - which asks about device status
		// don't wait for more than 5 commands (rgblink requirements described near SN field in API specification)
		// remove commands with no response in 15 seconds

		let deleted = this.sentCommandStorage.deleteExpiredCommands()
		if (deleted.length > 0) {
			deleted.forEach((sendCom) => {
				this.myWarn('Expired command (without response):' + sendCom.command)
				this.emit(
					this.EVENT_NAME_ON_CONNECTION_WARNING,
					'The device did not respond to the command within ' + COMMANDS_EXPIRE_TIME_SECONDS + ' seconds'
				)
			})
		}

		try {
			let commandsRequested = false
			for (let i = 0; i < MAX_COMMANDS_WAITING_FOR_RESPONSES_FOR_POLLING; i++) {
				if (this.sentCommandStorage.getCountElementsWithoutRespond() >= 5) {
					// do not send more polling commands, if we wait for 5 or more responses
					// this.myDebug(
					// 	'Skip more polling commands, current queue:' +
					// 	this.sentCommandStorage.getCountElementsWithoutRespond() +
					// 	' added new ' +
					// 	i
					// )
					break
				}

				// if there is not polling commands, try to generate a new one, but only once
				if (this.pollingQueue.length == 0 && commandsRequested == false) {
					// Do NOT get new commands, if polling is disabled (hower, commands in queue will be send, this help to get device status after connect)
					if ((this.config && this.config.polling) || force) {
						this.pollingQueue = this.getPollingCommands()
					}
					commandsRequested = true
				}
				if (this.pollingQueue.length == 0) {
					// if still no polling commands, stop doing anything
					break
				}

				let command = this.pollingQueue.shift()
				this.sendCommand(command.CMD, command.DAT1, command.DAT2, command.DAT3, command.DAT4)
				if (this.pollingQueue.length == 0 && commandsRequested == true) {
					// all sent, now more for sent, break
					break
				}
			}
		} catch (ex) {
			console.log(ex)
		}
	}

	readStatusAfterConnect() {
		this.sentCommandStorage.deleteAll()
		this.doPolling(true)
	}

	createSocket(host, port) {
		this.myDebug('RGBLinkApiConnector: creating socket ' + host + ':' + port + '...')
		this.config.host = host
		this.config.port = port

		if (this.socket !== undefined) {
			this.socket.destroy()
			delete this.socket
		}

		if (host) {
			this.socket = new UDPHelper(host, port)
			this.socket.on('status_change', (status, message) => {
				this.myDebug('RGBLinkApiConnector: udp status_change:' + status + ' ' + message)
			})

			this.socket.on('error', (err) => {
				this.myDebug('RGBLinkApiConnector: udp error:' + err)
			})

			this.socket.on('data', (message) => {
				if (this.config && this.config.logEveryCommand) {
					this.myDebug('FEEDBACK: ' + message)
				}
				this.onDataReceived(message)
			})
			this.sendConnectMessage()
			this.readStatusAfterConnect()
		}
	}

	onDataReceived(message) {
		try {
			if (message.length !== 19) {
				this.emit(this.EVENT_NAME_ON_DATA_API_NOT_STANDARD_LENGTH, [message])
			} else {
				this.validateReceivedDataAndEmitIfValid(message)
			}
		} catch (ex) {
			console.log(ex)
		}
	}

	logFeedback(redeableMsg, info) {
		if (this.config && this.config.logEveryCommand) {
			this.myDebug('Feedback:' + redeableMsg + ' ' + info)
		}
	}

	onDestroy() {
		if (this.socket !== undefined) {
			this.socket.destroy()
		}
		clearInterval(this.intervalHandler1s)
		clearInterval(this.intervalHandler100ms)
	}

	on = function (event, listener) {
		if (typeof this.eventsListeners[event] !== 'object') {
			this.eventsListeners[event] = []
		}
		this.eventsListeners[event].push(listener)
	}

	emit = function (event, args) {
		if (typeof this.eventsListeners[event] === 'object') {
			let listeners = this.eventsListeners[event].slice()

			if (!Array.isArray(args)) {
				args = [args]
			}
			for (var i = 0; i < listeners.length; i++) {
				listeners[i].apply(this, args)
			}
		}
	}

	sendCommandNative(cmd) {
		//let self = this
		try {
			if (cmd !== undefined && cmd != '') {
				if (this.socket !== undefined) {
					this.socket.send(cmd).then(function () {
						// self.myLog('sent?')
					})
					if (this.config && this.config.logEveryCommand) {
						this.myDebug('SENT    : ' + cmd)
					}
					this.sentCommandStorage.registerSentCommand(cmd)
				} else {
					this.myDebug("Can't send command, socket undefined!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
				}
			}
		} catch (ex) {
			console.log(ex)
		}
	}

	setPolling(polling) {
		this.config.polling = polling
	}

	setPollingEdge(pollingEdge) {
		this.config.pollingEdge = pollingEdge
	}

	setLogEveryCommand(logEveryCommand) {
		this.config.logEveryCommand = logEveryCommand
	}

	getPollingCommands() {
		// to override during implementation with specific device
		// should return array of PollingCommand objects
		return []
	}

	sendCommand(CMD, DAT1, DAT2, DAT3, DAT4) {
		let ADDR = '00'
		this.sendCommandWithAddr(ADDR, CMD, DAT1, DAT2, DAT3, DAT4)
	}

	sendCommandWithAddr(ADDR, CMD, DAT1, DAT2, DAT3, DAT4) {
		let SN = this.byteToTwoSignHex(this.nextSn)
		this.incrementNextSn()
		let checksum = this.calculateChecksum(ADDR, SN, CMD, DAT1, DAT2, DAT3, DAT4)
		let cmd = '<T' + ADDR + SN + CMD + DAT1 + DAT2 + DAT3 + DAT4 + checksum + '>'
		this.sendCommandNative(cmd)
	}

	byteToTwoSignHex(b) {
		let out = parseInt(b).toString(this.PARSE_INT_HEX_MODE).toUpperCase()
		while (out.length < 2) {
			out = '0' + out
		}
		return out
	}

	incrementNextSn() {
		this.nextSn++
		if (this.nextSn > 255) {
			this.nextSn = 0
		}
	}

	validateReceivedDataAndEmitIfValid(message) {
		let redeableMsg = message.toString('utf8').toUpperCase()
		this.sentCommandStorage.registerReceivedCommand(redeableMsg)

		// Checksum checking
		let checksumInMessage = redeableMsg.substr(16, 2)
		let ADDR = redeableMsg.substr(2, 2)
		let SN = redeableMsg.substr(4, 2)
		let CMD = redeableMsg.substr(6, 2)
		let DAT1 = redeableMsg.substr(8, 2)
		let DAT2 = redeableMsg.substr(10, 2)
		let DAT3 = redeableMsg.substr(12, 2)
		let DAT4 = redeableMsg.substr(14, 2)
		let calculatedChecksum = this.calculateChecksum(ADDR, SN, CMD, DAT1, DAT2, DAT3, DAT4)
		if (checksumInMessage != calculatedChecksum) {
			this.emit(this.EVENT_NAME_ON_CONNECTION_WARNING, 'Incorrect checksum ' + redeableMsg)
			this.myDebug('redeableMsg Incorrect checksum: ' + checksumInMessage + ' != ' + calculatedChecksum)
			return
		}

		if (redeableMsg[0] != '<' || redeableMsg[1] != 'F' || redeableMsg[18] != '>') {
			this.emit(this.EVENT_NAME_ON_CONNECTION_WARNING, 'Message is not a feedback:' + redeableMsg)
			return
		}

		if (redeableMsg.includes('FFFFFFFF')) {
			this.emit(this.EVENT_NAME_ON_CONNECTION_WARNING, 'Feedback with error:' + redeableMsg)
			return
		}
		// end of validate section

		this.emit(this.EVENT_NAME_ON_DATA_API, [ADDR, SN, CMD, DAT1, DAT2, DAT3, DAT4])
	}

	calculateChecksum(ADDR, SN, CMD, DAT1, DAT2, DAT3, DAT4) {
		let sum = 0
		sum += parseInt(ADDR, this.PARSE_INT_HEX_MODE)
		sum += parseInt(SN, this.PARSE_INT_HEX_MODE)
		sum += parseInt(CMD, this.PARSE_INT_HEX_MODE)
		sum += parseInt(DAT1, this.PARSE_INT_HEX_MODE)
		sum += parseInt(DAT2, this.PARSE_INT_HEX_MODE)
		sum += parseInt(DAT3, this.PARSE_INT_HEX_MODE)
		sum += parseInt(DAT4, this.PARSE_INT_HEX_MODE)
		let checksum = (sum % 256).toString(this.PARSE_INT_HEX_MODE).toUpperCase()
		while (checksum.length < 2) {
			checksum = '0' + checksum
		}
		return checksum
	}
}

module.exports.RGBLinkApiConnector = RGBLinkApiConnector
module.exports.PollingCommand = PollingCommand
module.exports.ApiConfig = ApiConfig
