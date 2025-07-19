const { InstanceBase, runEntrypoint, InstanceStatus, Regex } = require('@companion-module/base')
const UpgradeScripts = require('./upgrades')
const { combineRgb } = require('@companion-module/base')

const SWITCH_EFFECT_ICONS = require('./images')
const {
	RGBLinkMiniConnector,
	SWITCH_MODE_TBAR,
	SWITCH_MODE_AUTO,
	PIP_LAYER_A,
	PIP_LAYER_B,
	PIP_MODE_OFF,
	PIP_MODES,
	SWITCH_EFFECT,
	INPUT_SIGNAL_CHANNEL_HDMI,
	INPUT_SIGNAL_CHANNEL_SDI
} = require('./api/rgblinkminiconnector')
const { ApiConfig } = require('./api/rgblinkapiconnector')

const SOURCE_CHOICES_PART = [
	{ id: '1', label: '1' },
	{ id: '2', label: '2' },
	{ id: '3', label: '3' },
	{ id: '4', label: '4' },
	{ id: '5', label: '5 - EXPERIMENTAL' },
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

const INPUT_CHANNEL_CHOICES_PART = [
	{ id: INPUT_SIGNAL_CHANNEL_HDMI, label: '0 - HDMI' },
	{ id: INPUT_SIGNAL_CHANNEL_SDI, label: '1 - SDI' },
]

class MiniModuleInstance extends InstanceBase {
	BACKGROUND_COLOR_PREVIEW
	BACKGROUND_COLOR_ON_AIR
	BACKGROUND_COLOR_DEFAULT
	TEXT_COLOR
	apiConnector = new RGBLinkMiniConnector() //creation should be overwrited in init()

	constructor(internal) {
		super(internal)
		this.BACKGROUND_COLOR_PREVIEW = combineRgb(0, 128, 0)
		this.BACKGROUND_COLOR_ON_AIR = combineRgb(255, 0, 0)
		this.BACKGROUND_COLOR_DEFAULT = combineRgb(0, 0, 0)
		this.TEXT_COLOR = combineRgb(255, 255, 255)
	}

	getConfigFields() {
		return [
			{
				type: 'textinput',
				id: 'host',
				label: 'Target IP',
				width: 8,
				regex: Regex.IP,
			},
			{
				type: 'textinput',
				id: 'port',
				label: 'Target Port',
				width: 4,
				default: '1000',
				regex: Regex.PORT,
			},
			{
				type: 'checkbox',
				label: 'Status polling (ask for status every second)',
				id: 'polling',
				width: 12,
				default: true,
			},
			{
				type: 'checkbox',
				label: 'Debug logging of every sent/received command (may slow down your computer)',
				tooltip: 'test toolitp',
				description: 'test descri',
				id: 'logEveryCommand',
				width: 12,
				default: false,
			},
		]
	}

	destroy() {
		this.log('debug', 'destroy')
		this.apiConnector.sendDisconnectMessage()
		this.apiConnector.onDestroy()
		this.log('debug', 'destroy', this.id)
	}

	async init(config) {
		this.config = config

		try {
			this.log('debug', 'init')
			this.initApiConnector()

			this.updateActions()
			this.updateFeedbacks()
			this.updatePresets()
		} catch (ex) {
			this.updateStatus(InstanceStatus.UnknownError, ex)
			console.log(ex)
			this.log('error', ex)
		}
	}

	initApiConnector() {
		let self = this
		this.apiConnector = new RGBLinkMiniConnector(
			new ApiConfig(
				this.config.host,
				this.config.port ? this.config.port : 1000,
				this.config.polling,
				this.config.logEveryCommand ? this.config.logEveryCommand : false
			)
		)
		this.apiConnector.enableLog(this)
		this.apiConnector.on(this.apiConnector.EVENT_NAME_ON_DEVICE_STATE_CHANGED, (changedEvents) => {
			self.checkAllFeedbacks(changedEvents)
		})
		this.apiConnector.on(this.apiConnector.EVENT_NAME_ON_CONNECTION_OK, (message) => {
			self.updateStatus(InstanceStatus.Ok, message)
		})
		this.apiConnector.on(this.apiConnector.EVENT_NAME_ON_CONNECTION_WARNING, (message) => {
			self.updateStatus(InstanceStatus.UnknownWarning, message)
		})
		this.apiConnector.on(this.apiConnector.EVENT_NAME_ON_CONNECTION_ERROR, (message) => {
			self.updateStatus(InstanceStatus.UnknownError, message)
		})
		this.updateStatus(InstanceStatus.Connecting)
		this.apiConnector.setLogEveryCommand(this.config.logEveryCommand)
	}

	updateActions() {
		let actions = {}

		actions['switch_mode_and_source'] = {
			name: 'Select source and target',
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
			callback: async (action /*, bank*/) => {
				this.apiConnector.sendSwitchModeMessage(action.options.mode)
				this.apiConnector.sendPIPModeMessage(PIP_MODE_OFF)
				this.apiConnector.sendSwitchToSourceMessage(action.options.sourceNumber)
			},
		}
		actions['build_pip_sources_and_target'] = {
			name: 'Build PIP from selected sources',
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
			callback: async (action /*, bank*/) => {
				this.apiConnector.sendBuildPipMessages(
					action.options.mode,
					action.options.pipMode,
					action.options.sourceNumberA,
					action.options.sourceNumberB
				)
			},
		}
		actions['switch_to_source'] = {
			name: 'Switch to signal source',
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
			callback: async (action /*, bank*/) => {
				this.apiConnector.sendSwitchToSourceMessage(action.options.sourceNumber)
			},
		}
		actions['switch_mode'] = {
			name: 'Switch mode (T-BAR/Auto)',
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
			callback: async (action /*, bank*/) => {
				this.apiConnector.sendSwitchModeMessage(action.options.mode)
			},
		}
		actions['pip_mode'] = {
			name: 'Picture-In-Picture mode',
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
			callback: async (action /*, bank*/) => {
				this.apiConnector.sendPIPModeMessage(action.options.mode)
			},
		}

		actions['switch_effect'] = {
			name: 'Switch effect',
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
			callback: async (action /*, bank*/) => {
				this.apiConnector.sendSwitchEffectMessage(action.options.mode)
			},
		}

		actions['pip_layer'] = {
			name: 'PIP layer (A or B)',
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
			callback: async (action /*, bank*/) => {
				this.apiConnector.sendSwitchPipLayerMessage(action.options.layer)
			},
		}

		// HDMI or SDI
		actions['switch_input_signal_channel'] = {
			name: 'EXPERIMENTAL: Switch input signal channel (HDMI/SDI), if hardware support id (mini-iso, mini-edge SDI, mini-mx SDI)',
			options: [
				{
					type: 'dropdown',
					label: 'Input source number',
					id: 'sourceNumber',
					default: '1',
					tooltip: 'Choose source number to switch channel',
					choices: SOURCE_CHOICES_PART,
					minChoicesForSearch: 0,
				},
				{
					type: 'dropdown',
					label: 'Channel type',
					id: 'type',
					default: INPUT_SIGNAL_CHANNEL_HDMI,
					tooltip: 'Choose channel type: HDMI or SDI',
					choices: INPUT_CHANNEL_CHOICES_PART,
					minChoicesForSearch: 0,
				},
			],
			callback: async (action /*, bank*/) => {
				this.apiConnector.sendSwitchInputSignalChannel(action.options.sourceNumber, action.options.type)
			},
		}

		this.setActionDefinitions(actions)
	}

	checkAllFeedbacks() {
		this.checkFeedbacks('set_source')
		this.checkFeedbacks('set_source_preview')
		this.checkFeedbacks('set_mode')
		this.checkFeedbacks('set_pip_mode')
		this.checkFeedbacks('set_pip_layer')
		this.checkFeedbacks('set_switch_effect')
		this.checkFeedbacks('set_switch_input_signal_channel')
	}

	async configUpdated(config) {
		this.log('debug', 'updateConfig')
		try {
			let resetConnection = false

			if (this.config.host != config.host || this.config.port != config.port) {
				resetConnection = true
			}

			this.config = config

			if (resetConnection === true) {
				this.apiConnector.createSocket(config.host, config.port)
			}

			this.apiConnector.setPolling(this.config.polling)
			this.apiConnector.setLogEveryCommand(this.config.logEveryCommand ? this.config.logEveryCommand : false)
		} catch (ex) {
			this.updateStatus(InstanceStatus.UnknownError, ex)
			console.log(ex)
			this.log('error', ex)
		}
	}

	updateFeedbacks() {
		const feedbacks = {}
		feedbacks['set_source'] = {
			type: 'boolean',
			name: 'Live source',
			description: 'Source of HDMI signal',
			defaultStyle: {
				color: combineRgb(255, 255, 255),
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
			callback: (feedback) => {
				return feedback.options.sourceNumber == this.apiConnector.deviceStatus.liveSource
			},
		}
		feedbacks['set_source_preview'] = {
			type: 'boolean',
			name: 'Preview source',
			description: 'Source of HDMI signal',
			defaultStyle: {
				color: combineRgb(255, 255, 255),
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
			callback: (feedback) => {
				return feedback.options.sourceNumber == this.apiConnector.deviceStatus.prevSource
			},
		}

		feedbacks['set_mode'] = {
			type: 'boolean',
			name: 'Selected switch mode',
			description: 'Mode Auto/T-Bar',
			defaultStyle: {
				color: combineRgb(255, 255, 255),
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
			callback: (feedback) => {
				return feedback.options.mode == this.apiConnector.deviceStatus.switchMode
			},
		}
		feedbacks['set_pip_mode'] = {
			type: 'boolean',
			name: 'Selected PIP mode',
			description: 'Picture-In-Picture mode',
			defaultStyle: {
				color: combineRgb(255, 255, 255),
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
			callback: (feedback) => {
				return feedback.options.mode == this.apiConnector.deviceStatus.pipMode
			},
		}

		feedbacks['set_pip_layer'] = {
			type: 'boolean',
			name: 'Selected PIP layer',
			description: 'PIP layer (A or B)',
			defaultStyle: {
				color: combineRgb(255, 255, 255),
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
			callback: (feedback) => {
				return feedback.options.layer == this.apiConnector.deviceStatus.pipLayer
			},
		}
		feedbacks['set_switch_effect'] = {
			type: 'boolean',
			name: 'Selected switch effect',
			description: 'Switch effect between sources/streams',
			defaultStyle: {
				color: combineRgb(255, 255, 255),
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
			callback: (feedback) => {
				return feedback.options.mode == this.apiConnector.deviceStatus.switchEffect
			},
		}

		feedbacks['set_switch_input_signal_channel'] = {
			type: 'boolean',
			name: 'Input channel (HDMI/SDI) linked to button',
			description: 'Assigned channel (HDMI/SDI) for button',
			defaultStyle: {
				color: combineRgb(255, 255, 255),
				bgcolor: this.BACKGROUND_COLOR_ON_AIR,
			},
			options: [
				{
					type: 'dropdown',
					label: 'Input source number',
					id: 'sourceNumber',
					default: '1',
					tooltip: 'Choose source number to test',
					choices: SOURCE_CHOICES_PART,
					minChoicesForSearch: 0,
				},
				{
					type: 'dropdown',
					label: 'Channel type',
					id: 'type',
					default: INPUT_SIGNAL_CHANNEL_HDMI,
					tooltip: 'Choose channel type: HDMI or SDI',
					choices: INPUT_CHANNEL_CHOICES_PART,
					minChoicesForSearch: 0,
				},
			],
			callback: (feedback) => {
				return (feedback.options.type == this.apiConnector.deviceStatus.channelsForInput[feedback.options.sourceNumber])
			},
		}

		this.setFeedbackDefinitions(feedbacks)
	}

	updatePresets() {
		let presets = []
		for (const item of SOURCE_CHOICES_PART) {
			presets.push({
				type: 'button',
				category: 'Select source on live output',
				name: 'Live source\\n' + item.label,
				style: {
					text: 'Live source\\n' + item.label,
					size: 'auto',
					color: this.TEXT_COLOR,
					bgcolor: this.BACKGROUND_COLOR_DEFAULT,
				},
				steps: [
					{
						down: [
							{
								actionId: 'switch_mode_and_source',
								options: {
									sourceNumber: item.id,
									mode: SWITCH_MODE_AUTO,
								},
							},
						],
						up: [],
					},
				],
				feedbacks: [
					{
						feedbackId: 'set_source',
						options: {
							sourceNumber: item.id,
						},
						style: {
							color: this.TEXT_COLOR,
							bgcolor: this.BACKGROUND_COLOR_ON_AIR,
						},
					},
				],
			})
		}
		for (const item of SOURCE_CHOICES_PART) {
			presets.push({
				type: 'button',
				category: 'Select source on preview',
				name: 'Preview source\\n' + item.label,
				style: {
					text: 'Preview source\\n' + item.label,
					size: 'auto',
					color: this.TEXT_COLOR,
					bgcolor: this.BACKGROUND_COLOR_DEFAULT,
				},
				steps: [
					{
						down: [
							{
								actionId: 'switch_mode_and_source',
								options: {
									sourceNumber: item.id,
									mode: SWITCH_MODE_TBAR,
								},
							},
						],
						up: [],
					},
				],
				feedbacks: [
					{
						feedbackId: 'set_source_preview',
						options: {
							sourceNumber: item.id,
						},
						style: {
							color: this.TEXT_COLOR,
							bgcolor: this.BACKGROUND_COLOR_PREVIEW,
						},
					},
				],
			})
		}
		for (const item of SOURCE_CHOICES_PART) {
			presets.push({
				type: 'button',
				category: 'Select source',
				name: 'Source\\n' + item.label,
				style: {
					text: 'Source\\n' + item.label,
					size: 'auto',
					color: this.TEXT_COLOR,
					bgcolor: this.BACKGROUND_COLOR_DEFAULT,
				},
				steps: [
					{
						down: [
							{
								actionId: 'switch_to_source',
								options: {
									sourceNumber: item.id,
								},
							},
						],
						up: [],
					},
				],
				feedbacks: [
					{
						feedbackId: 'set_source_preview',
						options: {
							sourceNumber: item.id,
						},
						style: {
							color: this.TEXT_COLOR,
							bgcolor: this.BACKGROUND_COLOR_PREVIEW,
						},
					},
					{
						feedbackId: 'set_source',
						options: {
							sourceNumber: item.id,
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
			type: 'button',
			category: 'PIP examples',
			name: 'PIP center\\nPreview\\nSrc 1 + 2',
			style: {
				text: 'PIP center\\nPreview\\nSrc 1 + 2',
				size: 'auto',
				color: this.TEXT_COLOR,
				bgcolor: this.BACKGROUND_COLOR_DEFAULT,
			},
			steps: [
				{
					down: [
						{
							actionId: 'build_pip_sources_and_target',
							options: {
								mode: SWITCH_MODE_TBAR,
								pipMode: 1,
								sourceNumberA: 1,
								sourceNumberB: 2,
							},
						},
					],
					up: [],
				},
			],
		})
		presets.push({
			type: 'button',
			category: 'PIP examples',
			name: 'PIP left top\\nPreview\\nSrc 1 + 2',
			style: {
				text: 'PIP left top\\nPreview\\nSrc 1 + 2',
				size: 'auto',
				color: this.TEXT_COLOR,
				bgcolor: this.BACKGROUND_COLOR_DEFAULT,
			},
			steps: [
				{
					down: [
						{
							actionId: 'build_pip_sources_and_target',
							options: {
								mode: SWITCH_MODE_TBAR,
								pipMode: 2,
								sourceNumberA: 1,
								sourceNumberB: 2,
							},
						},
					],
					up: [],
				},
			],
			feedbacks: [],
		})
		presets.push({
			type: 'button',
			category: 'PIP examples',
			name: 'PIP right top\\nLive output\\nSrc 1 + 2',
			style: {
				text: 'PIP right top\\nLive output\\nSrc 1 + 2',
				size: 'auto',
				color: this.TEXT_COLOR,
				bgcolor: this.BACKGROUND_COLOR_DEFAULT,
			},
			steps: [
				{
					down: [
						{
							actionId: 'build_pip_sources_and_target',
							options: {
								mode: SWITCH_MODE_AUTO,
								pipMode: 3,
								sourceNumberA: 1,
								sourceNumberB: 2,
							},
						},
					],
					up: [],
				},
			],
		})

		for (var id in PIP_MODES) {
			presets.push({
				type: 'button',
				category: 'PIP mode',
				name: 'PIP mode\\n' + PIP_MODES[id],
				style: {
					text: 'PIP mode\\n' + PIP_MODES[id],
					size: 'auto',
					color: this.TEXT_COLOR,
					bgcolor: this.BACKGROUND_COLOR_DEFAULT,
				},
				steps: [
					{
						down: [
							{
								actionId: 'pip_mode',
								options: {
									mode: id,
								},
							},
						],
						up: [],
					},
				],
				feedbacks: [
					{
						feedbackId: 'set_pip_mode',
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
			type: 'button',
			category: 'PIP layer',
			name: 'PIP layer\\nA',
			style: {
				text: 'PIP layer\\nA',
				size: 'auto',
				color: this.TEXT_COLOR,
				bgcolor: this.BACKGROUND_COLOR_DEFAULT,
			},
			steps: [
				{
					down: [
						{
							actionId: 'pip_layer',
							options: {
								layer: PIP_LAYER_A,
							},
						},
					],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: 'set_pip_layer',
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
			type: 'button',
			category: 'PIP layer',
			name: 'PIP layer\\nB',
			style: {
				text: 'PIP layer\\nB',
				size: 'auto',
				color: this.TEXT_COLOR,
				bgcolor: this.BACKGROUND_COLOR_DEFAULT,
			},
			steps: [
				{
					down: [
						{
							actionId: 'pip_layer',
							options: {
								layer: PIP_LAYER_B,
							},
						},
					],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: 'set_pip_layer',
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
			type: 'button',
			category: 'Select switch mode (Auto / T-BAR)',
			name: 'Switch mode\\nAuto',
			style: {
				text: 'Switch mode\\nAuto',
				size: 'auto',
				color: this.TEXT_COLOR,
				bgcolor: this.BACKGROUND_COLOR_DEFAULT,
			},
			steps: [
				{
					down: [
						{
							actionId: 'switch_mode',
							options: {
								mode: SWITCH_MODE_AUTO,
							},
						},
					],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: 'set_mode',
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
			type: 'button',
			category: 'Select switch mode (Auto / T-BAR)',
			name: 'Switch mode\\nT-BAR',
			style: {
				text: 'Switch mode\\nT-BAR',
				size: 'auto',
				color: this.TEXT_COLOR,
				bgcolor: this.BACKGROUND_COLOR_DEFAULT,
			},
			steps: [
				{
					down: [
						{
							actionId: 'switch_mode',
							options: {
								mode: SWITCH_MODE_TBAR,
							},
						},
					],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: 'set_mode',
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
				type: 'button',
				category: 'Switch effect',
				name: SWITCH_EFFECT[id],
				style: {
					style: 'png',
					size: 'auto',
					color: this.TEXT_COLOR,
					bgcolor: this.BACKGROUND_COLOR_DEFAULT,
					png64: SWITCH_EFFECT_ICONS[id],
					pngalignment: 'center:center',
				},
				steps: [
					{
						down: [
							{
								actionId: 'switch_effect',
								options: {
									mode: id,
								},
							},
						],
						up: [],
					},
				],
				feedbacks: [
					{
						feedbackId: 'set_switch_effect',
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
			type: 'button',
			category: 'Switch effect',
			name: 'autodetect effect',
			style: {
				style: 'png',
				text: 'autodetect effect',
				size: 'auto',
				color: this.TEXT_COLOR,
				bgcolor: this.BACKGROUND_COLOR_DEFAULT,
			},
			steps: [
				{
					down: [],
					up: [],
				},
			],
			feedbacks: [],
		}
		for (id in SWITCH_EFFECT) {
			showEffectPreset.feedbacks.push({
				feedbackId: 'set_switch_effect',
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

		for (const item of SOURCE_CHOICES_PART) {
			for (const item2 of INPUT_CHANNEL_CHOICES_PART) {
				presets.push({
					type: 'button',
					category: 'Select source channel (HDMI/SDI)',
					name: 'Source ' + item.label + '\\n' + item2.label,
					style: {
						text: 'Source ' + item.label + '\\n' + item2.label,
						size: 'auto',
						color: this.TEXT_COLOR,
						bgcolor: this.BACKGROUND_COLOR_DEFAULT,
					},
					steps: [
						{
							down: [
								{
									actionId: 'switch_input_signal_channel',
									options: {
										sourceNumber: item.id,
										type: item2.id,
									},
								},
							],
							up: [],
						},
					],
					feedbacks: [
						{
							feedbackId: 'set_switch_input_signal_channel',
							options: {
								sourceNumber: item.id,
								type: item2.id,
							},
							style: {
								color: this.TEXT_COLOR,
								bgcolor: this.BACKGROUND_COLOR_ON_AIR,
							},
						},
					],
				})
			}
		}

		presets.push(showEffectPreset)

		this.setPresetDefinitions(presets)
	}
}
runEntrypoint(MiniModuleInstance, UpgradeScripts)

/*
maybe do it in future:
* switch effect - better png, with transparency
* switch time setting (from 0.5s to 5s)

usefull commands
* yarn format
* yarn headless
* yarn dev-headless

*/
