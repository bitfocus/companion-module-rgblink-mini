/*
TODO
* odpytywanie co chwila o status auto/tbar
* presets
* zastanowić się nad parametrem SN, możę go trzeba obśłużyć
* ? inne akcje (np pip) + przetestować feedbacki do pip
*/

const udp = require('../../udp')
const instance_skel = require('../../instance_skel')

const SWITCH_TO_SOURCE_MSG = {
	'1': '<T0000750200000077>',
	'2': '<T0000750200010078>',
	'3': '<T0000750200020079>',
	'4': '<T000075020003007A>'
};

const SWITCH_TO_SOURCE_FEEDBACK_MSG = {
	'<F0000750200000077>': 1,
	'<F0000750200010078>': 2,
	'<F0000750200020079>': 3,
	'<F000075020003007A>': 4
};

const READ_SOURCE_FEEDBACK_MSG = {
	'<F0000750300000078>': 1,
	'<F0000750300010079>': 2,
	'<F000075030002007A>': 3,
	'<F000075030003007B>': 4
};

const SWITCH_MODE_AUTO = 0;
const SWITCH_MODE_TBAR = 1;

const SWITCH_MODE_MSG = {};
SWITCH_MODE_MSG[SWITCH_MODE_AUTO] = '<T000078120000008A>';
SWITCH_MODE_MSG[SWITCH_MODE_TBAR] = '<T000078120100008B>';

const SWITCH_MODE_FEEDBACK_MSG = {
	'<F000078120000008A>': SWITCH_MODE_AUTO,
	'<F000078120100008B>': SWITCH_MODE_TBAR,
};

// write mode
const DISCONNECT_MSG = '<T00006866000000CE>';
const CONNECT_MSG = '<T00006866010000CF>';
const CONNECT_FEEDBACK_MSG = '<F00006866010000CF>';

class instance extends instance_skel {
	BACKGROUND_COLOR_PREVIEW;
	BACKGROUND_COLOR_ON_AIR;
	intervalHandler = undefined;

	deviceStatus = {
		selectedSource: undefined,
		switchMode: undefined,
	}

	constructor(system, id, config) {
		super(system, id, config)
		this.BACKGROUND_COLOR_PREVIEW = this.rgb(0, 255, 0);
		this.BACKGROUND_COLOR_ON_AIR = this.rgb(0, 255, 0);
		//console.log('RGBlink mini: constructor');
		this.initActions();
		this.initPresets();
	}

	config_fields() {
		//console.log('RGBlink mini: config_fields');
		return [
			{
				type: 'textinput',
				id: 'host',
				label: 'IP address of RGBlink mini device',
				width: 6,
				regex: this.REGEX_IP,
			},
			{
				type: 'text',
				id: 'info',
				width: 12,
				label: 'Port',
				value: 'Will be used default port ' + this.config.port,
			},
		]
	}

	destroy() {
		//console.log('RGBlink mini: destroy');
		this.sendCommand(DISCONNECT_MSG)
		if (this.socket !== undefined) {
			this.socket.destroy()
		}
		clearInterval(this.intervalHandler);
		this.debug('destroy', this.id)
	}

	init() {
		//console.log('RGBlink mini: init');
		this.initUDPConnection()
		this.initFeedbacks();
		var self = this;
		this.intervalHandler = setInterval(function () {
			self.askAboutSignal();
		}, 1000);
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
						{ id: '4', label: '4' }
					],
					minChoicesForSearch: 0
				},
			],
			callback: (action, bank) => {
				//console.log('onAction');
				this.sendCommand(SWITCH_TO_SOURCE_MSG[action.options.sourceNumber]);
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
					minChoicesForSearch: 0
				},
			],
			callback: (action, bank) => {
				//console.log('onAction');
				this.sendCommand(SWITCH_MODE_MSG[action.options.mode]);
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
						{ id: '4', label: '4' }
					],
					minChoicesForSearch: 0
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
					minChoicesForSearch: 0
				},
			],
			callback: (action, bank) => {
				//console.log('onAction');
				this.sendCommand(SWITCH_MODE_MSG[action.options.mode] + SWITCH_TO_SOURCE_MSG[action.options.sourceNumber]);
			},
		}

		this.setActions(actions)
	}

	askAboutSignal() {
		this.sendCommand('<T0000750300000078>')
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
				console.log('RGBlink mini: initUDPConnection error');
				this.debug('Network error', err)
				this.log('error', 'Network error: ' + err.message)
			})

			this.socket.on('data', (message, metadata) => {
				//console.log('RGBlink mini: initUDPConnection data');
				//console.log(message);
				//console.log(metadata);

				if (metadata.size !== 19) {
					this.status(this.STATUS_WARNING, 'Feedback length != 19')
					return;
				}

				if (metadata.address != this.config.host || metadata.port != this.config.port) {
					this.status(this.STATUS_WARNING, 'Feedback received from different sender ' + metadata.address + ":" + metadata.port)
					return;
				}

				let redeableMsg = message.toString('utf8').toUpperCase();
				console.log('GOT  ' + redeableMsg);

				// Checksum checking
				let sum = 0;
				for (var i = 4; i <= 14; i += 2) {
					sum += parseInt(redeableMsg.substr(i, 2), 16);
				}
				let msgCheckSum = parseInt(redeableMsg.substr(16, 2), 16);
				if (sum != msgCheckSum) {
					this.status(this.STATUS_WARNING, 'Incorrect checksum')
					return;
				}

				if (redeableMsg.includes('FFFFFFFF')) {
					this.status(this.STATUS_WARNING, 'Feedback with error:' + redeableMsg)
					return;
				}

				// end of validate section
				this.parseAndConsumeFeedback(redeableMsg);
			})



			this.sendCommand(CONNECT_MSG);
			this.askAboutSignal();
		}
	}

	parseAndConsumeFeedback(redeableMsg) {
		if (redeableMsg == CONNECT_FEEDBACK_MSG) {
			// OK, connect confirmed
			this.status(this.STATUS_OK)
		} else if (redeableMsg in SWITCH_TO_SOURCE_FEEDBACK_MSG) {
			this.status(this.STATUS_OK)
			this.deviceStatus.selectedSource = SWITCH_TO_SOURCE_FEEDBACK_MSG[redeableMsg];
		} else if (redeableMsg in SWITCH_MODE_FEEDBACK_MSG) {
			this.status(this.STATUS_OK)
			this.deviceStatus.switchMode = SWITCH_MODE_FEEDBACK_MSG[redeableMsg];
		} else if (redeableMsg in READ_SOURCE_FEEDBACK_MSG) {
			this.status(this.STATUS_OK)
			this.deviceStatus.selectedSource = READ_SOURCE_FEEDBACK_MSG[redeableMsg];
		} else {
			console.log('Unrecognized message:' + redeableMsg)
		}

		this.checkFeedbacks('set_source')
		this.checkFeedbacks('set_mode')
	}

	initPresets() {
		//console.log('initPresets');
		let presets = [];
		presets.push({
			category: 'Select source',
			bank: {
				style: 'text',
				text: 'Source\\n1',
				size: 'auto',
				color: '16777215',
				bgcolor: 0
			},
			actions: [
				{
					action: 'switch_to_source',
					options: {
						sourceNumber: '1',
					}
				}
			],
			feedbacks: [
				{
					type: 'set_source',
					options: {
						sourceNumber: '1',
					},
					style: {
						color: this.rgb(255, 255, 255),
						bgcolor: this.BACKGROUND_COLOR_ON_AIR
					},
				}
			],
		});
		this.setPresetDefinitions(presets);
		//console.log('after initPresets');
	}

	sendCommand(cmd) {
		//console.log('RGBlink mini: sendCommand');
		//console.log(this.socket.connected);
		if (cmd !== undefined && cmd != '') {
			if (this.socket !== undefined /*&& this.socket.connected*/) {
				this.socket.send(cmd)
				console.log('SENT ' + cmd);
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
			let ret = (feedback.options.sourceNumber == this.deviceStatus.selectedSource);
			//console.log(ret);
			return ret;
		} else if (feedback.type == 'set_mode') {
			let ret = (feedback.options.mode == this.deviceStatus.switchMode);
			//console.log('feedback:' + feedback.options.mode + ' ' + this.deviceStatus.switchMode + ' ' + ret)
			return ret;
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
				bgcolor: this.BACKGROUND_COLOR_ON_AIR
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
						{ id: '4', label: '4' }
					],
					minChoicesForSearch: 0
				},
			],
		}
		feedbacks['set_mode'] = {
			type: 'boolean',
			label: 'Selected mode',
			description: 'Mode Auto/T-Bar',
			style: {
				color: this.rgb(255, 255, 255),
				bgcolor: this.BACKGROUND_COLOR_ON_AIR
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
					minChoicesForSearch: 0
				},
			],
		}
		this.setFeedbackDefinitions(feedbacks)
	}
}

exports = module.exports = instance