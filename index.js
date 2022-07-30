/*
TODO
* SN ? Currently always zero
* switch effect?
* detect device is disconnected
* undocummented options (like select pip layer?)
*/

const udp = require('../../udp')
const instance_skel = require('../../instance_skel')

const SWITCH_TO_SOURCE_MSG = {
	1: '<T0000750200000077>',
	2: '<T0000750200010078>',
	3: '<T0000750200020079>',
	4: '<T000075020003007A>',
}

const SWITCH_MODE_AUTO = 0
const SWITCH_MODE_TBAR = 1

const SWITCH_MODE_MSG = {}
SWITCH_MODE_MSG[SWITCH_MODE_AUTO] = '<T000078120000008A>'
SWITCH_MODE_MSG[SWITCH_MODE_TBAR] = '<T000078120100008B>'

// write mode
const DISCONNECT_MSG = '<T00006866000000CE>'
const CONNECT_MSG = '<T00006866010000CF>'

const PIP_MODES = {
	0: 'PIP off',
	1: 'PWP center',
	2: 'PWP left top',
	3: 'PWP right top',
	4: 'PWP left bottom',
	5: 'PWP right bottom',
	6: 'PBP top',
	7: 'PBP bottom',
	8: 'PBP left',
	9: 'PBP right',
}

const PARSE_INT_HEX_MODE = 16

class instance extends instance_skel {
	BACKGROUND_COLOR_PREVIEW
	BACKGROUND_COLOR_ON_AIR
	BACKGROUND_COLOR_DEFAULT
	TEXT_COLOR
	intervalHandler = undefined

	deviceStatus = {
		selectedSource: undefined,
		switchMode: undefined,
		pipMode: undefined,
	}

	constructor(system, id, config) {
		super(system, id, config)
		this.BACKGROUND_COLOR_PREVIEW = this.rgb(0, 255, 0)
		this.BACKGROUND_COLOR_ON_AIR = this.rgb(255, 0, 0)
		this.BACKGROUND_COLOR_DEFAULT = this.rgb(0, 0, 0)
		this.TEXT_COLOR = this.rgb(255, 255, 255)
		//console.log('RGBlink mini: constructor');
		this.initActions()
		this.initPresets()
	}

	config_fields() {
		//console.log('RGBlink mini: config_fields');
		return [
			{
				type: 'textinput',
				id: 'host',
				label: 'IP address of RGBlink mini device',
				width: 12,
				regex: this.REGEX_IP,
			},
			{
				type: 'text',
				id: 'info',
				width: 12,
				label: 'Port',
				value: 'Will be used default port ' + this.config.port,
			},
			{
				type: 'checkbox',
				label: 'Status polling (ask for status every second)',
				id: 'polling',
				width: 12,
				default: true,
			},
		]
	}

	destroy() {
		//console.log('RGBlink mini: destroy');
		this.sendCommand(DISCONNECT_MSG)
		if (this.socket !== undefined) {
			this.socket.destroy()
		}
		clearInterval(this.intervalHandler)
		this.debug('destroy', this.id)
	}

	init() {
		//console.log('RGBlink mini: init');
		this.initUDPConnection()
		this.initFeedbacks()
		var self = this
		this.intervalHandler = setInterval(function () {
			if (self.config.polling) {
				self.askAboutStatus()
			}
		}, 1000)
	}

	initActions() {
		//console.log('RGBlink mini: initActions');
		let actions = {}

		actions['switch_to_source'] = {
			label: 'Switch to signal source',
			options: [
				{
					type: 'dropdown',
					label: 'Source number',
					id: 'sourceNumber',
					default: '1',
					tooltip: 'Choose source number, which should be selected',
					choices: [
						{ id: '1', label: '1' },
						{ id: '2', label: '2' },
						{ id: '3', label: '3' },
						{ id: '4', label: '4' },
					],
					minChoicesForSearch: 0,
				},
			],
			callback: (action, bank) => {
				//console.log('onAction');
				this.sendCommand(SWITCH_TO_SOURCE_MSG[action.options.sourceNumber])
			},
		}
		actions['switch_mode'] = {
			label: 'Switch mode (T-BAR/Auto)',
			options: [
				{
					type: 'dropdown',
					label: 'Mode',
					id: 'mode',
					default: SWITCH_MODE_AUTO,
					tooltip: 'Choose mode',
					choices: [
						{ id: SWITCH_MODE_AUTO, label: 'Auto (Take)' },
						{ id: SWITCH_MODE_TBAR, label: 'T-BAR (Preview)' },
					],
					minChoicesForSearch: 0,
				},
			],
			callback: (action, bank) => {
				//console.log('onAction');
				this.sendCommand(SWITCH_MODE_MSG[action.options.mode])
			},
		}
		actions['switch_mode_and_source'] = {
			label: 'Select source and target',
			options: [
				{
					type: 'dropdown',
					label: 'Source number',
					id: 'sourceNumber',
					default: '1',
					tooltip: 'Choose source number, which should be selected',
					choices: [
						{ id: '1', label: '1' },
						{ id: '2', label: '2' },
						{ id: '3', label: '3' },
						{ id: '4', label: '4' },
					],
					minChoicesForSearch: 0,
				},
				{
					type: 'dropdown',
					label: 'Mode',
					id: 'mode',
					default: SWITCH_MODE_AUTO,
					tooltip: 'Choose mode',
					choices: [
						{ id: SWITCH_MODE_AUTO, label: 'Auto (Take)' },
						{ id: SWITCH_MODE_TBAR, label: 'T-BAR (Preview)' },
					],
					minChoicesForSearch: 0,
				},
			],
			callback: (action, bank) => {
				//console.log('onAction');
				this.sendCommand(SWITCH_MODE_MSG[action.options.mode] + SWITCH_TO_SOURCE_MSG[action.options.sourceNumber])
			},
		}
		actions['pip_mode'] = {
			label: 'Picture-In-Picture mode',
			tooltip: 'XXX test',
			options: [
				{
					type: 'dropdown',
					label: 'Mode',

					id: 'mode',
					default: 0,
					tooltip: 'Choose mode',
					choices: [
						//{ id: 0, label: 'PIP off' },
					],
					minChoicesForSearch: 0,
				},
			],
			callback: (action, bank) => {
				this.sendCommandPIPMode(action.options.mode)
			},
		}
		for (let id in PIP_MODES) {
			actions['pip_mode'].options[0].choices.push({ id: id, label: PIP_MODES[id] })
		}

		this.setActions(actions)
	}

	askAboutStatus() {
		this.sendCommand('<T0000750300000078>') // asking about signal
		this.sendCommand('<T000078130000008B>') // asking about switch setting
		this.sendCommand('<T0000751F00000094>') // asking about PIP mode
	}

	initUDPConnection() {
		//console.log('RGBlink mini: initUDPConnection');
		//console.log(this.socket);
		//console.log(this.config);
		if (this.socket !== undefined) {
			this.socket.destroy()
			delete this.socket
		}

		if (this.config.port === undefined) {
			this.config.port = 1000
		}

		this.status(this.STATUS_WARNING, 'Connecting')

		if (this.config.host) {
			//console.log('RGBlink mini: initializing....');
			this.socket = new udp(this.config.host, this.config.port)
			//console.log(this.socket);
			this.socket.on('status_change', (status, message) => {
				//console.log('RGBlink mini: initUDPConnection status_change:' + status + ' ' + message);
			})

			this.socket.on('error', (err) => {
				console.log('RGBlink mini: initUDPConnection error')
				this.debug('Network error', err)
				this.log('error', 'Network error: ' + err.message)
			})

			this.socket.on('data', (message, metadata) => {
				this.onDataReceivedFromDevice(message, metadata)
			})

			this.sendCommand(CONNECT_MSG)
			this.askAboutStatus()
		}
	}

	onDataReceivedFromDevice(message, metadata) {
		//console.log('RGBlink mini: initUDPConnection data');
		//console.log(message);
		//console.log(metadata);

		// consume message, if received data are valid
		let redeableMsg = this.validateReceivedDataAndTranslateMessage(message, metadata)
		if (redeableMsg) {
			this.parseAndConsumeFeedback(redeableMsg)

			this.checkFeedbacks('set_source')
			this.checkFeedbacks('set_mode')
			this.checkFeedbacks('set_pip_mode')
		}
	}

	logFeedback(redeableMsg, info) {
		console.log('Feedback:' + redeableMsg + ' ' + info)
	}

	validateReceivedDataAndTranslateMessage(message, metadata) {
		if (metadata.size !== 19) {
			this.status(this.STATUS_WARNING, 'Feedback length != 19')
			return false
		}

		if (metadata.address != this.config.host) {
			this.status(
				this.STATUS_WARNING,
				'Feedback received from different sender ' + metadata.address + ':' + metadata.port
			)
			return false
		}

		let redeableMsg = message.toString('utf8').toUpperCase()
		//console.log('GOT  ' + redeableMsg);

		// Checksum checking
		let checksumInMessage = redeableMsg.substr(16, 2)
		let calculatedChecksum = this.calculateChecksum(
			redeableMsg.substr(2, 2),
			redeableMsg.substr(4, 2),
			redeableMsg.substr(6, 2),
			redeableMsg.substr(8, 2),
			redeableMsg.substr(10, 2),
			redeableMsg.substr(12, 2),
			redeableMsg.substr(14, 2)
		)
		if (checksumInMessage != calculatedChecksum) {
			this.status(this.STATUS_WARNING, 'Incorrect checksum')
			return false
		}

		if (redeableMsg[0] != '<' || redeableMsg[1] != 'F' || redeableMsg[18] != '>') {
			this.status(this.STATUS_WARNING, 'Message is not a feedback:' + redeableMsg)
			return false
		}

		if (redeableMsg.includes('FFFFFFFF')) {
			this.status(this.STATUS_WARNING, 'Feedback with error:' + redeableMsg)
			return false
		}
		// end of validate section

		return redeableMsg
	}

	calculateChecksum(ADDR, SN, CMD, DAT1, DAT2, DAT3, DAT4) {
		let sum = 0
		sum += parseInt(ADDR, PARSE_INT_HEX_MODE)
		sum += parseInt(SN, PARSE_INT_HEX_MODE)
		sum += parseInt(CMD, PARSE_INT_HEX_MODE)
		sum += parseInt(DAT1, PARSE_INT_HEX_MODE)
		sum += parseInt(DAT2, PARSE_INT_HEX_MODE)
		sum += parseInt(DAT3, PARSE_INT_HEX_MODE)
		sum += parseInt(DAT4, PARSE_INT_HEX_MODE)
		let checksum = sum.toString(PARSE_INT_HEX_MODE).toUpperCase()
		return checksum
	}

	parseAndConsumeFeedback(redeableMsg) {
		let ADDR = redeableMsg.substr(2, 2)
		let SN = redeableMsg.substr(4, 2)
		let CMD = redeableMsg.substr(6, 2)
		let DAT1 = redeableMsg.substr(8, 2)
		let DAT2 = redeableMsg.substr(10, 2)
		let DAT3 = redeableMsg.substr(12, 2)
		let DAT4 = redeableMsg.substr(14, 2)

		let importantPart = CMD + DAT1 + DAT2 + DAT3 + DAT4

		if (CMD == '68') {
			// 0x68 Establish/disconnect communication
			// eg. '<F00006866010000CF>';
			if ((DAT2 = '00')) {
				this.status(this.STATUS_OK)
				return this.logFeedback(redeableMsg, 'Device disconnected')
			} else if (DAT2 == '01') {
				this.status(this.STATUS_OK)
				return this.logFeedback(redeableMsg, 'Device connected')
			}
		} else if (CMD == '75') {
			// 0x75 Read/write video processor information
			if (DAT1 == '02' || DAT1 == '03') {
				// Signal source switching Settings
				// 0x02(Write), 0x03(Read)
				let src = parseInt(DAT3) + 1
				if (src >= 1 && src <= 4) {
					this.status(this.STATUS_OK)
					this.deviceStatus.selectedSource = src
					return this.logFeedback(redeableMsg, 'Choosed signal ' + this.deviceStatus.selectedSource)
				}
			} else if (DAT1 == '1E' || DAT1 == '1F') {
				// Picture-In-Picture mode
				// 0x1E(Write), 0x1F(Read)
				let mode = parseInt(DAT3)
				if (mode >= 0 && mode <= 9) {
					this.status(this.STATUS_OK)
					this.deviceStatus.pipMode = mode
					return this.logFeedback(redeableMsg, 'PIP mode: ' + PIP_MODES[mode])
				}
			}
			// PIP not parsed, maybe in future
		} else if (CMD == '78') {
			// 0x78 Switching Setting
			if (DAT1 == '12' || DAT1 == '13') {
				// T-BAR/Auto
				if (DAT2 == '00') {
					this.status(this.STATUS_OK)
					this.deviceStatus.switchMode = parseInt(DAT2)
					return this.logFeedback(redeableMsg, 'Swtich mode Auto')
				} else if (DAT2 == '01') {
					this.status(this.STATUS_OK)
					this.deviceStatus.switchMode = parseInt(DAT2)
					return this.logFeedback(redeableMsg, 'Swtich mode T-BAR')
				}
			}
			// Switching effect setting - nod parsed, maybe in future
		}

		console.log('Unrecognized feedback message:' + redeableMsg)
	}

	initPresets() {
		//console.log('initPresets');
		let presets = []
		for (var i = 1; i <= 4; i++) {
			presets.push({
				category: 'Select source on live output',
				bank: {
					style: 'text',
					text: 'Live source\\n' + i,
					size: 'auto',
					color: this.TEXT_COLOR,
					bgcolor: this.BACKGROUND_COLOR_DEFAULT,
				},
				actions: [
					{
						action: 'switch_mode_and_source',
						options: {
							sourceNumber: i,
							mode: SWITCH_MODE_AUTO,
						},
					},
				],
				feedbacks: [
					{
						type: 'set_source',
						options: {
							sourceNumber: i,
						},
						style: {
							color: this.TEXT_COLOR,
							bgcolor: this.BACKGROUND_COLOR_ON_AIR,
						},
					},
				],
			})
		}
		for (var i = 1; i <= 4; i++) {
			presets.push({
				category: 'Select source on preview',
				bank: {
					style: 'text',
					text: 'Preview source\\n' + i,
					size: 'auto',
					color: this.TEXT_COLOR,
					bgcolor: this.BACKGROUND_COLOR_DEFAULT,
				},
				actions: [
					{
						action: 'switch_mode_and_source',
						options: {
							sourceNumber: i,
							mode: SWITCH_MODE_TBAR,
						},
					},
				],
			})
		}
		for (var i = 1; i <= 4; i++) {
			presets.push({
				category: 'Select source',
				bank: {
					style: 'text',
					text: 'Source\\n' + i,
					size: 'auto',
					color: this.TEXT_COLOR,
					bgcolor: this.BACKGROUND_COLOR_DEFAULT,
				},
				actions: [
					{
						action: 'switch_to_source',
						options: {
							sourceNumber: i,
						},
					},
				],
				feedbacks: [
					{
						type: 'set_source',
						options: {
							sourceNumber: i,
						},
						style: {
							color: this.TEXT_COLOR,
							bgcolor: this.BACKGROUND_COLOR_ON_AIR,
						},
					},
				],
			})
		}
		presets.push({
			category: 'Select switch mode (Auto / T-BAR)',
			bank: {
				style: 'text',
				text: 'Switch mode\\nAuto',
				size: 'auto',
				color: this.TEXT_COLOR,
				bgcolor: this.BACKGROUND_COLOR_DEFAULT,
			},
			actions: [
				{
					action: 'switch_mode',
					options: {
						mode: SWITCH_MODE_AUTO,
					},
				},
			],
			feedbacks: [
				{
					type: 'set_mode',
					options: {
						mode: SWITCH_MODE_AUTO,
					},
					style: {
						color: this.TEXT_COLOR,
						bgcolor: this.BACKGROUND_COLOR_ON_AIR,
					},
				},
			],
		})
		presets.push({
			category: 'Select switch mode (Auto / T-BAR)',
			bank: {
				style: 'text',
				text: 'Switch mode\\nT-BAR',
				size: 'auto',
				color: this.TEXT_COLOR,
				bgcolor: this.BACKGROUND_COLOR_DEFAULT,
			},
			actions: [
				{
					action: 'switch_mode',
					options: {
						mode: SWITCH_MODE_TBAR,
					},
				},
			],
			feedbacks: [
				{
					type: 'set_mode',
					options: {
						mode: SWITCH_MODE_TBAR,
					},
					style: {
						color: this.TEXT_COLOR,
						bgcolor: this.BACKGROUND_COLOR_PREVIEW,
					},
				},
			],
		})
		for (var id in PIP_MODES) {
			presets.push({
				category: 'PIP mode',
				bank: {
					style: 'text',
					text: 'PIP mode\\n' + PIP_MODES[id],
					size: 'auto',
					color: this.TEXT_COLOR,
					bgcolor: this.BACKGROUND_COLOR_DEFAULT,
				},
				actions: [
					{
						action: 'pip_mode',
						options: {
							mode: id,
						},
					},
				],
				feedbacks: [
					{
						type: 'set_pip_mode',
						options: {
							mode: id,
						},
						style: {
							color: this.TEXT_COLOR,
							bgcolor: this.BACKGROUND_COLOR_ON_AIR,
						},
					},
				],
			})
		}

		this.setPresetDefinitions(presets)
		//console.log('after initPresets');
	}

	sendCommandPIPMode(mode) {
		this.buildAndSendCommand('75', '1E' /*Write*/, '00', '0' + mode, '00')
	}

	buildAndSendCommand(CMD, DAT1, DAT2, DAT3, DAT4) {
		let ADDR = '00'
		let SN = '00'
		let checksum = this.calculateChecksum(ADDR, SN, CMD, DAT1, DAT2, DAT3, DAT4)
		let cmd = '<T' + ADDR + SN + CMD + DAT1 + DAT2 + DAT3 + DAT4 + checksum + '>'
		this.sendCommand(cmd)
	}

	sendCommand(cmd) {
		//console.log('RGBlink mini: sendCommand');
		//console.log(this.socket.connected);
		if (cmd !== undefined && cmd != '') {
			if (this.socket !== undefined /*&& this.socket.connected*/) {
				this.socket.send(cmd)
				console.log('SENT ' + cmd)
				//console.log(this.socket);
			}
		}
	}

	updateConfig(config) {
		//console.log('RGBlink mini: updateConfig');
		let resetConnection = false

		if (this.config.host != config.host) {
			resetConnection = true
		}

		this.config = config

		if (resetConnection === true || this.socket === undefined) {
			this.initUDPConnection()
		}
	}

	feedback(feedback, bank) {
		//console.log('RGBlink mini: feedback:' + feedback + " bank:" + bank);
		//console.log(feedback)

		if (feedback.type == 'set_source') {
			//console.log(feedback.options.sourceNumber + ' ' + this.deviceStatus.selectedSource)
			let ret = feedback.options.sourceNumber == this.deviceStatus.selectedSource
			//console.log(ret);
			return ret
		} else if (feedback.type == 'set_mode') {
			let ret = feedback.options.mode == this.deviceStatus.switchMode
			//console.log('feedback:' + feedback.options.mode + ' ' + this.deviceStatus.switchMode + ' ' + ret)
			return ret
		} else if (feedback.type == 'set_pip_mode') {
			return feedback.options.mode == this.deviceStatus.pipMode
		}

		return false
	}

	initFeedbacks() {
		const feedbacks = {}
		feedbacks['set_source'] = {
			type: 'boolean',
			label: 'Selected source',
			description: 'Source of HDMI signal',
			style: {
				color: this.rgb(255, 255, 255),
				bgcolor: this.BACKGROUND_COLOR_ON_AIR,
			},
			options: [
				{
					type: 'dropdown',
					label: 'Source number',
					id: 'sourceNumber',
					default: '1',
					tooltip: 'Choose source number',
					choices: [
						{ id: '1', label: '1' },
						{ id: '2', label: '2' },
						{ id: '3', label: '3' },
						{ id: '4', label: '4' },
					],
					minChoicesForSearch: 0,
				},
			],
		}
		feedbacks['set_mode'] = {
			type: 'boolean',
			label: 'Selected mode',
			description: 'Mode Auto/T-Bar',
			style: {
				color: this.rgb(255, 255, 255),
				bgcolor: this.BACKGROUND_COLOR_ON_AIR,
			},
			options: [
				{
					type: 'dropdown',
					label: 'Mode',
					id: 'mode',
					default: SWITCH_MODE_AUTO,
					tooltip: 'Choose mode',
					choices: [
						{ id: SWITCH_MODE_AUTO, label: 'Auto (Take)' },
						{ id: SWITCH_MODE_TBAR, label: 'T-BAR (Preview)' },
					],
					minChoicesForSearch: 0,
				},
			],
		}
		feedbacks['set_pip_mode'] = {
			type: 'boolean',
			label: 'Selected PIP mode',
			description: 'Picture-In-Picture mode',
			style: {
				color: this.rgb(255, 255, 255),
				bgcolor: this.BACKGROUND_COLOR_ON_AIR,
			},
			options: [
				{
					type: 'dropdown',
					label: 'PIP mode',
					id: 'mode',
					default: '0',
					tooltip: 'Choose mode',
					choices: [
						//{ id: '1', label: '1' },
					],
					minChoicesForSearch: 0,
				},
			],
		}
		for (let id in PIP_MODES) {
			feedbacks['set_pip_mode'].options[0].choices.push({ id: id, label: PIP_MODES[id] })
		}

		this.setFeedbackDefinitions(feedbacks)
	}
}

exports = module.exports = instance
