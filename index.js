/*
maybe do it in future:
* add homepage, bug, git url in package.json
* switch effect - better png, with transparency
* check on configuration update - what happens
* SN ? Currently always zero
* detect device is disconnected
* switch time setting (from 0.5s to 5s)

usefull commands
* yarn format
* yarn headless
* yarn dev-headless

*/

const instance_skel = require('../../instance_skel')

const SWITCH_EFFECT_ICONS = require('./images')
const RGBLinkApiConnector = require('./rgblinkapiconnector')

var DEFAULT_MINI_PORT = 1000

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

const SWITCH_EFFECT = {
	0: 'CUT',
	1: 'FADE',
	2: '<-[]->',
	3: 'L->R',
	4: 'T->B',
	5: 'LT->RB',
	6: '<-+->',
	7: 'R->L',
	8: 'B->T',
	9: 'L<-M->R',
	0x0a: 'T<-M->B',
	0x0b: '->+<-',
	0x0c: '|||->',
	0x0d: '->[]<-',
	0x0e: '<-O->',
}

const PIP_LAYER_A = 0
const PIP_LAYER_B = 1

const SOURCE_CHOICES_PART = [
	{ id: '1', label: '1' },
	{ id: '2', label: '2' },
	{ id: '3', label: '3' },
	{ id: '4', label: '4' },
]

const SWITCH_MODE_CHOICES_PART = [
	{ id: SWITCH_MODE_AUTO, label: 'Quick/Auto (Live output)' },
	{ id: SWITCH_MODE_TBAR, label: 'T-BAR (Preview)' },
]

const PIP_MODE_CHOICES_PART = []
for (let id in PIP_MODES) {
	PIP_MODE_CHOICES_PART.push({ id: id, label: PIP_MODES[id] })
}

const PART_CHOICES_SWITCH_EFFECTS = []
for (let id in SWITCH_EFFECT) {
	PART_CHOICES_SWITCH_EFFECTS.push({ id: id, label: SWITCH_EFFECT[id] })
}

const PART_CHOICES_PIP_LAYERS = [
	{ id: PIP_LAYER_A, label: 'A (main/first)' },
	{ id: PIP_LAYER_B, label: 'B (additional/second)' },
]

class instance extends instance_skel {
	BACKGROUND_COLOR_PREVIEW
	BACKGROUND_COLOR_ON_AIR
	BACKGROUND_COLOR_DEFAULT
	TEXT_COLOR
	intervalHandler = undefined
	apiConnector = new RGBLinkApiConnector() //creation should be overwrited in init()

	deviceStatus = {
		prevSource: undefined,
		liveSource: undefined,
		switchMode: undefined,
		switchEffect: undefined,
		pipMode: undefined,
		pipLayer: undefined,
	}

	constructor(system, id, config) {
		super(system, id, config)
		this.BACKGROUND_COLOR_PREVIEW = this.rgb(0, 255, 0)
		this.BACKGROUND_COLOR_ON_AIR = this.rgb(255, 0, 0)
		this.BACKGROUND_COLOR_DEFAULT = this.rgb(0, 0, 0)
		this.TEXT_COLOR = this.rgb(255, 255, 255)
		this.initActions()
		this.initPresets()
	}

	config_fields() {
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
		this.debug('RGBlink mini: destroy')
		this.sendCommand(DISCONNECT_MSG)
		this.apiConnector.onDestroy()
		clearInterval(this.intervalHandler)
		this.debug('destroy', this.id)
	}

	init() {
		try{
		this.debug('RGBlink mini: init')

		this.initApiConnector()
		this.initFeedbacks()
		let self = this;
		this.intervalHandler = setInterval(function () {
			if (self.config.polling) {
				self.askAboutStatus()
			}
		}, 1000)
	} catch (ex){
		this.status(this.STATUS_ERROR, ex)
		this.debug(ex)
	}
	}

	initApiConnector(){
		let self = this;
		this.apiConnector = new RGBLinkApiConnector(this.config.host, DEFAULT_MINI_PORT, this.debug)
		this.apiConnector.on(this.apiConnector.EVENT_NAME_ON_DATA_API, (redeableMsg) => {
			self.parseAndConsumeFeedback(redeableMsg)
			self.checkAllFeedbacks()
		})
		this.apiConnector.on(this.apiConnector.EVENT_NAME_ON_DATA_API_NOT_STANDARD_LENGTH, (message, metadata) => {
			if (metadata.size == 22) {
				this.consume22(message)
			} else {
				//self.status(this.STATUS_WARNING, "Unknown message length:" + metadata.size)
			}
		})
		this.apiConnector.on(this.apiConnector.EVENT_NAME_ON_CONNECTION_OK, (message) => {
			self.status(self.STATUS_OK, message)
		})
		this.apiConnector.on(this.apiConnector.EVENT_NAME_ON_CONNECTION_WARNING, (message) => {
			self.status(self.STATUS_WARNING, message)
		})
		this.apiConnector.on(this.apiConnector.EVENT_NAME_ON_CONNECTION_ERROR, (message) => {
			self.status(self.STATUS_ERROR, message)
		})
		this.status(this.STATUS_WARNING, 'Connecting')
		this.sendCommand(CONNECT_MSG)
		this.askAboutStatus()
	}

	initActions() {
		let actions = {}

		actions['switch_mode_and_source'] = {
			label: 'Select source and target',
			options: [
				{
					type: 'dropdown',
					label: 'Source number',
					id: 'sourceNumber',
					default: '1',
					tooltip: 'Choose source number, which should be selected',
					choices: SOURCE_CHOICES_PART,
					minChoicesForSearch: 0,
				},
				{
					type: 'dropdown',
					label: 'Mode',
					id: 'mode',
					default: SWITCH_MODE_AUTO,
					tooltip: 'Choose mode',
					choices: SWITCH_MODE_CHOICES_PART,
					minChoicesForSearch: 0,
				},
			],
			callback: (action /*, bank*/) => {
				this.sendCommand(SWITCH_MODE_MSG[action.options.mode] + SWITCH_TO_SOURCE_MSG[action.options.sourceNumber])
			},
		}
		actions['build_pip_sources_and_target'] = {
			label: 'Build PIP from selected sources',
			options: [
				{
					type: 'dropdown',
					label: 'Mode - where pip will be visible',
					tooltip: 'Choose mode',
					id: 'mode',
					default: SWITCH_MODE_AUTO,
					choices: SWITCH_MODE_CHOICES_PART,
					minChoicesForSearch: 0,
				},
				{
					type: 'dropdown',
					label: 'PIP mode',
					id: 'pipMode',
					default: 0,
					tooltip: 'Choose mode',
					choices: PIP_MODE_CHOICES_PART,
					minChoicesForSearch: 0,
				},
				{
					type: 'dropdown',
					label: 'Source for layer A (main/first)',
					id: 'sourceNumberA',
					default: '1',
					tooltip: 'Choose source number',
					choices: SOURCE_CHOICES_PART,
					minChoicesForSearch: 0,
				},
				{
					type: 'dropdown',
					label: 'Source for layer B (additional/second)',
					id: 'sourceNumberB',
					default: '2',
					tooltip: 'Choose source number',
					choices: SOURCE_CHOICES_PART,
					minChoicesForSearch: 0,
				},
			],
			callback: (action /*, bank*/) => {
				this.sendCommandBuildPip(
					action.options.mode,
					action.options.pipMode,
					action.options.sourceNumberA,
					action.options.sourceNumberB
				)
			},
		}
		actions['switch_to_source'] = {
			label: 'Switch to signal source',
			options: [
				{
					type: 'dropdown',
					label: 'Source number',
					id: 'sourceNumber',
					default: '1',
					tooltip: 'Choose source number, which should be selected',
					choices: SOURCE_CHOICES_PART,
					minChoicesForSearch: 0,
				},
			],
			callback: (action /*, bank*/) => {
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
					choices: SWITCH_MODE_CHOICES_PART,
					minChoicesForSearch: 0,
				},
			],
			callback: (action /*, bank*/) => {
				this.sendCommand(SWITCH_MODE_MSG[action.options.mode])
			},
		}
		actions['pip_mode'] = {
			label: 'Picture-In-Picture mode',
			options: [
				{
					type: 'dropdown',
					label: 'Mode',
					id: 'mode',
					default: 0,
					tooltip: 'Choose mode',
					choices: PIP_MODE_CHOICES_PART,
					minChoicesForSearch: 0,
				},
			],
			callback: (action /*, bank*/) => {
				this.sendCommandPIPMode(action.options.mode)
			},
		}

		actions['switch_effect'] = {
			label: 'Switch effect',
			options: [
				{
					type: 'dropdown',
					label: 'Effect',
					id: 'mode',
					default: 0,
					tooltip: 'Choose effect',
					choices: PART_CHOICES_SWITCH_EFFECTS,
					minChoicesForSearch: 0,
				},
			],
			callback: (action /*, bank*/) => {
				this.sendCommandSwitchEffect(action.options.mode)
			},
		}

		actions['pip_layer'] = {
			label: 'PIP layer (A or B)',
			options: [
				{
					type: 'dropdown',
					label: 'Layer',
					id: 'layer',
					default: PIP_LAYER_A,
					tooltip: 'Choose layer',
					choices: PART_CHOICES_PIP_LAYERS,
					minChoicesForSearch: 0,
				},
			],
			callback: (action /*, bank*/) => {
				this.sendCommandSwitchPipLayer(action.options.layer)
			},
		}

		this.setActions(actions)
	}

	askAboutStatus() {
		//this.sendCommand('<T0000750300000078>') // asking about signal
		this.sendCommand('<T000078130000008B>') // asking about switch setting
		this.sendCommand('<T0000751F00000094>') // asking about PIP mode
		this.sendCommand('<T000078070000007F>') // asking about switch effect
		this.sendCommand('<T0000751B00000090>') // asking about PIP layer (A or B)
		this.sendCommand('<T0001F14001000033>')
		//<T00c3f103000000b7>
	}

	checkAllFeedbacks() {
		this.checkFeedbacks('set_source')
		this.checkFeedbacks('set_source_preview')
		this.checkFeedbacks('set_mode')
		this.checkFeedbacks('set_pip_mode')
		this.checkFeedbacks('set_pip_layer')
		this.checkFeedbacks('set_switch_effect')
	}

	logFeedback(redeableMsg, info) {
		this.debug('Feedback:' + redeableMsg + ' ' + info)
	}

	parseAndConsumeFeedback(redeableMsg) {
		//let ADDR = redeableMsg.substr(2, 2)
		//let SN = redeableMsg.substr(4, 2)
		let CMD = redeableMsg.substr(6, 2)
		let DAT1 = redeableMsg.substr(8, 2)
		let DAT2 = redeableMsg.substr(10, 2)
		let DAT3 = redeableMsg.substr(12, 2)
		let DAT4 = redeableMsg.substr(14, 2)

		let importantPart = CMD + DAT1 + DAT2 + DAT3 + DAT4
		if ('F140011600' == importantPart) {
			// readed status, it's ok
			this.status(this.STATUS_OK)
			return this.logFeedback(redeableMsg, 'Status readed')
		} else if (CMD == 'A2' && DAT1 == '18') {
			// t-bar position update
			this.status(this.STATUS_OK)
			return this.logFeedback(redeableMsg, 'T-BAR position changed')
		}

		if (CMD == '68') {
			// 0x68 Establish/disconnect communication
			// eg. '<F00006866010000CF>';
			if (DAT2 == '00') {
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
					this.deviceStatus.liveSource = src
					return this.logFeedback(redeableMsg, 'Choosed signal ' + this.deviceStatus.liveSource)
				}
			} else if (DAT1 == '1A' || DAT1 == '1B') {
				// T0000751B00000090 PIP layer (A or B)
				if (DAT3 == '00') {
					this.status(this.STATUS_OK)
					this.deviceStatus.pipLayer = PIP_LAYER_A
					return this.logFeedback(redeableMsg, 'PIP Layer A')
				} else if (DAT3 == '01') {
					this.status(this.STATUS_OK)
					this.deviceStatus.pipLayer = PIP_LAYER_B
					return this.logFeedback(redeableMsg, 'PIP Layer B')
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
			} else if (DAT1 == '06' || DAT1 == '07') {
				// Switching effect setting
				let effect = parseInt(DAT2, this.apiConnector.PARSE_INT_HEX_MODE)
				if (effect >= 0 && effect <= 0x0e) {
					this.status(this.STATUS_OK)
					this.deviceStatus.switchEffect = effect
					return this.logFeedback(redeableMsg, 'Switch effect: ' + SWITCH_EFFECT[effect])
				}
			}
		}

		this.debug('Unrecognized feedback message:' + redeableMsg)
	}

	consume22(message) {
		let prev = message[0]
		if (prev <= 3) {
			this.deviceStatus.prevSource = prev + 1
		}

		let src = message[2]
		if (src <= 3) {
			this.deviceStatus.liveSource = src + 1
		}

		this.checkAllFeedbacks()
	}

	sendCommandPIPMode(mode) {
		this.buildAndSendCommand('75', '1E' /*Write*/, '00', '0' + mode, '00')
	}

	sendCommandSwitchEffect(effect) {
		let encoded = '0' + parseInt(effect).toString(this.apiConnector.PARSE_INT_HEX_MODE).toUpperCase()
		this.buildAndSendCommand('78', '06' /*Write*/, encoded, '00', '00')
	}

	sendCommandSwitchPipLayer(layer) {
		// 0 - layer A
		// 1 - layer B
		// example layer A <T00f3751a00000082>
		// example lyaer B <T0046751a000100d6>
		let layerCode
		if (layer == PIP_LAYER_A) {
			layerCode = '00'
		} else if (layer == PIP_LAYER_B) {
			layerCode = '01'
		} else {
			this.status(this.STATUS_WARNING, 'Bad layer id')
			return
		}
		this.buildAndSendCommand('75', '1A' /*Write*/, '00', layerCode, '00')
	}

	sendCommandBuildPip(mode /*T-BAR - preview / Auto - live output */, pipMode, sourceOnLayerA, sourceOnLayerB) {
		if (mode == SWITCH_MODE_AUTO || mode == SWITCH_MODE_TBAR) {
			this.sendCommand(SWITCH_MODE_MSG[mode])
		} else {
			this.status(this.STATUS_WARNING, 'Bad mode')
			return
		}
		this.sendCommandPIPMode(pipMode)
		if (sourceOnLayerA >= 0 && sourceOnLayerA <= 3) {
			this.sendCommandSwitchPipLayer(PIP_LAYER_A)
			this.sendCommand(SWITCH_TO_SOURCE_MSG[sourceOnLayerA])
		}
		if (sourceOnLayerB >= 0 && sourceOnLayerB <= 3) {
			this.sendCommandSwitchPipLayer(PIP_LAYER_B)
			this.sendCommand(SWITCH_TO_SOURCE_MSG[sourceOnLayerB])
		}
	}

	buildAndSendCommand(CMD, DAT1, DAT2, DAT3, DAT4) {
		let ADDR = '00'
		let SN = '00'
		let checksum = this.calculateChecksum(ADDR, SN, CMD, DAT1, DAT2, DAT3, DAT4)
		let cmd = '<T' + ADDR + SN + CMD + DAT1 + DAT2 + DAT3 + DAT4 + checksum + '>'
		this.sendCommand(cmd)
	}

	sendCommand(cmd) {
		this.apiConnector.sendCommand(cmd)
	}

	updateConfig(config) {
		this.debug('RGBlink mini: updateConfig')
		let resetConnection = false

		if (this.config.host != config.host) {
			resetConnection = true
		}

		this.config = config

		if (resetConnection === true) {
			this.apiConnector.createSocket(config.host, DEFAULT_MINI_PORT)
		}
	}

	feedback(feedback /*, bank*/) {
		if (feedback.type == 'set_source') {
			return feedback.options.sourceNumber == this.deviceStatus.liveSource
		} else if (feedback.type == 'set_source_preview') {
			return feedback.options.sourceNumber == this.deviceStatus.prevSource
		} else if (feedback.type == 'set_mode') {
			return feedback.options.mode == this.deviceStatus.switchMode
		} else if (feedback.type == 'set_pip_mode') {
			return feedback.options.mode == this.deviceStatus.pipMode
		} else if (feedback.type == 'set_switch_effect') {
			return feedback.options.mode == this.deviceStatus.switchEffect
		} else if (feedback.type == 'set_pip_layer') {
			return feedback.options.layer == this.deviceStatus.pipLayer
		}

		return false
	}

	initFeedbacks() {
		const feedbacks = {}
		feedbacks['set_source'] = {
			type: 'boolean',
			label: 'Live source',
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
					choices: SOURCE_CHOICES_PART,
					minChoicesForSearch: 0,
				},
			],
		}
		feedbacks['set_source_preview'] = {
			type: 'boolean',
			label: 'Preview source',
			description: 'Source of HDMI signal',
			style: {
				color: this.rgb(255, 255, 255),
				bgcolor: this.BACKGROUND_COLOR_PREVIEW,
			},
			options: [
				{
					type: 'dropdown',
					label: 'Source number',
					id: 'sourceNumber',
					default: '1',
					tooltip: 'Choose source number',
					choices: SOURCE_CHOICES_PART,
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
					choices: SWITCH_MODE_CHOICES_PART,
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
					choices: PIP_MODE_CHOICES_PART,
					minChoicesForSearch: 0,
				},
			],
		}

		feedbacks['set_pip_layer'] = {
			type: 'boolean',
			label: 'Selected PIP layer',
			description: 'PIP layer (A or B)',
			style: {
				color: this.rgb(255, 255, 255),
				bgcolor: this.BACKGROUND_COLOR_ON_AIR,
			},
			options: [
				{
					type: 'dropdown',
					label: 'Layer',
					id: 'layer',
					default: SWITCH_MODE_AUTO,
					tooltip: 'Choose mode',
					choices: PART_CHOICES_PIP_LAYERS,
					minChoicesForSearch: 0,
				},
			],
		}
		feedbacks['set_switch_effect'] = {
			type: 'boolean',
			label: 'Selected switch effect',
			description: 'Switch effect between sources/streams',
			style: {
				color: this.rgb(255, 255, 255),
				bgcolor: this.BACKGROUND_COLOR_ON_AIR,
			},
			options: [
				{
					type: 'dropdown',
					label: 'Effect',
					id: 'mode',
					default: 0,
					tooltip: 'Choose effect',
					choices: PART_CHOICES_SWITCH_EFFECTS,
					minChoicesForSearch: 0,
				},
			],
		}

		this.setFeedbackDefinitions(feedbacks)
	}

	initPresets() {
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
		for (i = 1; i <= 4; i++) {
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
				feedbacks: [
					{
						type: 'set_source_preview',
						options: {
							sourceNumber: i,
						},
						style: {
							color: this.TEXT_COLOR,
							bgcolor: this.BACKGROUND_COLOR_PREVIEW,
						},
					},
				],
			})
		}
		for (i = 1; i <= 4; i++) {
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
						type: 'set_source_preview',
						options: {
							sourceNumber: i,
						},
						style: {
							color: this.TEXT_COLOR,
							bgcolor: this.BACKGROUND_COLOR_PREVIEW,
						},
					},
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
			category: 'PIP examples',
			bank: {
				style: 'text',
				text: 'PIP center\\nPreview\\nSrc 1 + 2',
				size: 'auto',
				color: this.TEXT_COLOR,
				bgcolor: this.BACKGROUND_COLOR_DEFAULT,
			},
			actions: [
				{
					action: 'build_pip_sources_and_target',
					options: {
						mode: SWITCH_MODE_TBAR,
						pipMode: 1,
						sourceNumberA: 1,
						sourceNumberB: 2,
					},
				},
			],
		})
		presets.push({
			category: 'PIP examples',
			bank: {
				style: 'text',
				text: 'PIP left top\\nPreview\\nSrc 1 + 2',
				size: 'auto',
				color: this.TEXT_COLOR,
				bgcolor: this.BACKGROUND_COLOR_DEFAULT,
			},
			actions: [
				{
					action: 'build_pip_sources_and_target',
					options: {
						mode: SWITCH_MODE_TBAR,
						pipMode: 2,
						sourceNumberA: 1,
						sourceNumberB: 2,
					},
				},
			],
		})
		presets.push({
			category: 'PIP examples',
			bank: {
				style: 'text',
				text: 'PIP right top\\nLive output\\nSrc 1 + 2',
				size: 'auto',
				color: this.TEXT_COLOR,
				bgcolor: this.BACKGROUND_COLOR_DEFAULT,
			},
			actions: [
				{
					action: 'build_pip_sources_and_target',
					options: {
						mode: SWITCH_MODE_AUTO,
						pipMode: 3,
						sourceNumberA: 1,
						sourceNumberB: 2,
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

		presets.push({
			category: 'PIP layer',
			bank: {
				style: 'text',
				text: 'PIP layer\\nA',
				size: 'auto',
				color: this.TEXT_COLOR,
				bgcolor: this.BACKGROUND_COLOR_DEFAULT,
			},
			actions: [
				{
					action: 'pip_layer',
					options: {
						layer: PIP_LAYER_A,
					},
				},
			],
			feedbacks: [
				{
					type: 'set_pip_layer',
					options: {
						layer: PIP_LAYER_A,
					},
					style: {
						color: this.TEXT_COLOR,
						bgcolor: this.BACKGROUND_COLOR_ON_AIR,
					},
				},
			],
		})
		presets.push({
			category: 'PIP layer',
			bank: {
				style: 'text',
				text: 'PIP layer\\nB',
				size: 'auto',
				color: this.TEXT_COLOR,
				bgcolor: this.BACKGROUND_COLOR_DEFAULT,
			},
			actions: [
				{
					action: 'pip_layer',
					options: {
						layer: PIP_LAYER_B,
					},
				},
			],
			feedbacks: [
				{
					type: 'set_pip_layer',
					options: {
						layer: PIP_LAYER_B,
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

		for (id in SWITCH_EFFECT) {
			presets.push({
				category: 'Switch effect',
				bank: {
					style: 'png',
					size: 'auto',
					color: this.TEXT_COLOR,
					bgcolor: this.BACKGROUND_COLOR_DEFAULT,
					png64: SWITCH_EFFECT_ICONS[id],
					pngalignment: 'center:center',
				},
				actions: [
					{
						action: 'switch_effect',
						options: {
							mode: id,
						},
					},
				],
				feedbacks: [
					{
						type: 'set_switch_effect',
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

		let showEffectPreset = {
			category: 'Switch effect',
			bank: {
				style: 'png',
				text: 'autodetect effect',
				size: 'auto',
				color: this.TEXT_COLOR,
				bgcolor: this.BACKGROUND_COLOR_DEFAULT,
			},
			feedbacks: [],
		}
		for (id in SWITCH_EFFECT) {
			showEffectPreset.feedbacks.push({
				type: 'set_switch_effect',
				options: {
					mode: id,
				},
				style: {
					color: this.TEXT_COLOR,
					bgcolor: this.BACKGROUND_COLOR_ON_AIR,
					png64: SWITCH_EFFECT_ICONS[id],
					pngalignment: 'center:center',
					text: '',
				},
			})
		}
		presets.push(showEffectPreset)

		this.setPresetDefinitions(presets)
	}
}

exports = module.exports = instance
