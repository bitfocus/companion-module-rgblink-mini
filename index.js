/*
maybe do it in future:
* switch effect - better png, with transparency
* switch time setting (from 0.5s to 5s)

usefull commands
* yarn format
* yarn headless
* yarn dev-headless

*/

const instance_skel = require('../../instance_skel')

const SWITCH_EFFECT_ICONS = require('./images')
const {
	RGBLinkMiniConnector,
	SWITCH_MODE_TBAR,
	SWITCH_MODE_AUTO,
	PIP_LAYER_A,
	PIP_LAYER_B,
	PIP_MODES,
	SWITCH_EFFECT,
} = require('./rgblinkminiconnector')

var DEFAULT_MINI_PORT = 1000

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
	apiConnector = new RGBLinkMiniConnector() //creation should be overwrited in init()

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
		this.apiConnector.sendDisconnectMessage()
		this.apiConnector.onDestroy()
		this.debug('destroy', this.id)
	}

	init() {
		try {
			this.debug('RGBlink mini: init')
			this.initApiConnector()
			this.initFeedbacks()
		} catch (ex) {
			this.status(this.STATUS_ERROR, ex)
			this.debug(ex)
		}
	}

	initApiConnector() {
		let self = this
		this.apiConnector = new RGBLinkMiniConnector(this.config.host, DEFAULT_MINI_PORT, this.debug, this.config.polling)
		this.apiConnector.on(this.apiConnector.EVENT_NAME_ON_DEVICE_STATE_CHANGED, () => {
			self.checkAllFeedbacks()
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
		this.apiConnector.sendConnectMessage()
		this.apiConnector.askAboutStatus()
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
				this.apiConnector.sendSwitchModeMessage(action.options.mode)
				this.apiConnector.sendSwitchToSourceMessage(action.options.sourceNumber)
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
				this.apiConnector.sendBuildPipMessages(
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
				this.apiConnector.sendSwitchToSourceMessage(action.options.sourceNumber)
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
				this.apiConnector.sendSwitchModeMessage(action.options.mode)
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
				this.apiConnector.sendPIPModeMessage(action.options.mode)
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
				this.apiConnector.sendSwitchEffectMessage(action.options.mode)
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
				this.apiConnector.sendSwitchPipLayerMessage(action.options.layer)
			},
		}

		this.setActions(actions)
	}

	checkAllFeedbacks() {
		this.checkFeedbacks('set_source')
		this.checkFeedbacks('set_source_preview')
		this.checkFeedbacks('set_mode')
		this.checkFeedbacks('set_pip_mode')
		this.checkFeedbacks('set_pip_layer')
		this.checkFeedbacks('set_switch_effect')
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

		this.apiConnector.setPolling(config.polling)
	}

	feedback(feedback /*, bank*/) {
		if (feedback.type == 'set_source') {
			return feedback.options.sourceNumber == this.apiConnector.deviceStatus.liveSource
		} else if (feedback.type == 'set_source_preview') {
			return feedback.options.sourceNumber == this.apiConnector.deviceStatus.prevSource
		} else if (feedback.type == 'set_mode') {
			return feedback.options.mode == this.apiConnector.deviceStatus.switchMode
		} else if (feedback.type == 'set_pip_mode') {
			return feedback.options.mode == this.apiConnector.deviceStatus.pipMode
		} else if (feedback.type == 'set_switch_effect') {
			return feedback.options.mode == this.apiConnector.deviceStatus.switchEffect
		} else if (feedback.type == 'set_pip_layer') {
			return feedback.options.layer == this.apiConnector.deviceStatus.pipLayer
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
