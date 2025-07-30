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
	INPUT_SIGNAL_CHANNEL_SDI,
	OUTPUT_PST_PREVIEW,
	OUTPUT_PGM_PROGRAM,
	KNOWN_DEVICE_MODEL_VERSIONS
} = require('./api/rgblinkminiconnector')
const { ApiConfig } = require('./api/rgblinkapiconnector')

const SOURCE_CHOICES_PART = [
	{ id: '1', label: '1' },
	{ id: '2', label: '2' },
	{ id: '3', label: '3' },
	{ id: '4', label: '4' },
	{ id: '5', label: '5 (BETA - if the hardware has)' },
]

const INPUT_OUTPUT_AUDIO_VOLUME_CHOICES_PART = [
	{ id: '0', label: 'Input 1' },
	{ id: '1', label: 'Input 2' },
	{ id: '2', label: 'Input 3' },
	{ id: '3', label: 'Input 4' },
	{ id: '5', label: 'Output' },
]

const LINE_IN_AUDIO_VOLUME_LEVEL_CHOICES_PART = []
for (let i = 0; i <= 0x1F; i++) {
	const value = (12 + (i * 1.5)).toFixed(1)
	LINE_IN_AUDIO_VOLUME_LEVEL_CHOICES_PART.push({ id: i, label: `${value} dB` })
}

const MIC_IN_AUDIO_VOLUME_LEVEL_CHOICES_PART = []
for (let i = 0; i <= 0x08; i++) {
	const value = ((i * 5)).toFixed(0)
	MIC_IN_AUDIO_VOLUME_LEVEL_CHOICES_PART.push({ id: i, label: `${value} dB` })
}

const SOURCE_CHOICES_PART_ONLY_FOUR = SOURCE_CHOICES_PART.slice(0, -1)

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
	{ id: INPUT_SIGNAL_CHANNEL_HDMI, label: 'HDMI' },
	{ id: INPUT_SIGNAL_CHANNEL_SDI, label: 'SDI' },
]

const SIGNAL_SWITCH_OUTPUT_CHOICES_PART = [
	{ id: OUTPUT_PST_PREVIEW, label: 'PST (Preview)' },
	{ id: OUTPUT_PGM_PROGRAM, label: 'PGM (Program)' },
]

const TBAR_POSITION_CHOICES = [
	{ id: 0, label: 'MIN' },
	{ id: 0xFFFF, label: 'MAX' },
]

const AUDIO_ON_OFF_CHOICES = [
	{ id: 0, label: 'OFF' },
	{ id: 1, label: 'ON' },
]

const TRANSITION_TYPE_CHOICES_PART = [
	{ id: 0, label: 'TAKE / Scene take' },
	{ id: 1, label: 'CUT / Black take' },
]

const SCENES_VIEWS_CHOICES_PART = []
for (let i = 1; i <= 16; i++) {
	SCENES_VIEWS_CHOICES_PART.push({ id: i - 1, label: `scene/view ${i}` })
}


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
				label: 'Status polling (requests status every second)',
				id: 'polling',
				width: 12,
				default: true,
			},
			{
				type: 'checkbox',
				label: 'EXPERIMENTAL: Status polling – extra for mini-edge (requests status every second)',
				id: 'pollingEdge',
				width: 12,
				default: false,
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
			this.updateVariableDefinitions()
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
				this.config.pollingEdge,
				this.config.logEveryCommand ? this.config.logEveryCommand : false
			)
		)
		this.apiConnector.enableLog(this)
		this.apiConnector.on(this.apiConnector.EVENT_NAME_ON_DEVICE_STATE_CHANGED, (changedEvents) => {
			self.checkAllFeedbacks(changedEvents)
			self.updateVariableValues()
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
			description: 'Combines Switch signal source and Switch mode (T-BAR/Auto). May behave differently than expected. 5th input is in BETA. Tested with: mini, mini-edge SDI.',
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
			description: 'Set PIP mode, select two sources and output (Live or Preview). Combines Select PIP mode, Select PIP layer (A or B), and Switch signal source. Tested with: mini.',
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
			name: 'Switch signal source',
			description: 'Similar to pressing the 1/2/3/4/5 source button on the device. 5th input is in BETA. Tested with: mini.',
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
			description: 'Choose between T-BAR or Auto mode for switching. Tested with: mini, mini-edge SDI.',
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
			name: 'Select PIP mode',
			description: 'Select picture-in-picture mode (off, center, top, bottom, left, right, etc.). Tested with: mini.',
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
			name: 'Set switch effect',
			description: 'Set a transition effect, such as cut or fade. See hardware manual or presets for more. Tested with: mini.',
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
			name: 'Select PIP layer (A or B)',
			description: 'Select the PIP layer before setting the signal source. Tested with: mini.',
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

		// Load scene
		actions['load_scene_view'] = {
			name: 'EXPERIMENTAL: Load scene/view to Preview (PVM)',
			description: 'Load saved earlier scene/view to Preview. Not yet tested. Should be compatible with mini-kind devices, which support scenes.',
			options: [
				{
					type: 'dropdown',
					label: 'Scene/view number',
					id: 'scene',
					default: '1',
					// tooltip: 'Choose source number to switch channel',
					choices: SCENES_VIEWS_CHOICES_PART,
					minChoicesForSearch: 0,
				},
			],
			callback: async (action /*, bank*/) => {
				this.apiConnector.sendLoadScene(action.options.scene)
			},
		}

		// HDMI or SDI
		actions['switch_input_signal_channel'] = {
			name: 'BETA: Switch input signal channel (HDMI/SDI)',
			description: 'Select the input channel (HDMI or SDI) for numbered inputs, if supported by hardware. Tested with: mini-edge SDI.',
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
					choices: SOURCE_CHOICES_PART_ONLY_FOUR,
					minChoicesForSearch: 0,
				},
			],
			callback: async (action /*, bank*/) => {
				this.apiConnector.sendSwitchInputSignalChannel(action.options.sourceNumber, action.options.type)
			},
		}

		actions['switch_to_source_to_output'] = {
			name: 'BETA: Switch signal source (PST or PGM)',
			description: 'Switch the selected signal to PST or PGM. Likely a better alternative to Select source and target, but untested on mini. Tested with: mini-edge SDI.',
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
					label: 'Choose output (PST or PGM)',
					id: 'output',
					default: OUTPUT_PST_PREVIEW,
					tooltip: 'Choose output (preview or program)',
					choices: SIGNAL_SWITCH_OUTPUT_CHOICES_PART,
					minChoicesForSearch: 0,
				},
				{
					type: 'checkbox',
					label: 'EXPERIMENTAL: IF PGM, try to move previous PGM to PST',
					id: 'movePgmToPst',
					width: 12,
					default: false,
				},
			],
			callback: async (action /*, bank*/) => {
				this.apiConnector.sendSwitchToSourceToOutputMessage(action.options.sourceNumber, action.options.output)
				if (action.options.output == OUTPUT_PGM_PROGRAM && action.options.movePgmToPst) {
					let prevPgm = this.apiConnector.deviceStatus.lastSourceOnOutput[OUTPUT_PGM_PROGRAM]
					if (prevPgm && prevPgm != action.options.sourceNumber) {
						this.apiConnector.sendSwitchToSourceToOutputMessage(this.apiConnector.deviceStatus.lastSourceOnOutput[OUTPUT_PGM_PROGRAM], OUTPUT_PST_PREVIEW)
					}
				}
			},
		}

		actions['switch_tbar_position'] = {
			name: 'EXPERIMENTAL: Set T-BAR position',
			description: 'Set the T-BAR position to MIN or MAX. Not yet tested. Based on API v1.0.6 20250611, is it possible on mini Series: mini-pro, mini-pro v3, mini-ISO',
			options: [
				{
					type: 'dropdown',
					label: 'Position',
					id: 'position',
					default: 0,
					tooltip: 'Choose position',
					choices: TBAR_POSITION_CHOICES,
					minChoicesForSearch: 0,
				},
			],
			callback: async (action /*, bank*/) => {
				this.apiConnector.sendSetTBarPosition(action.options.position)
			},
		}

		actions['perform_transition'] = {
			name: 'EXPERIMENTAL: Performs a transition between Program and Preview',
			description: 'Performs a transition between Program and Preview (TAKE/CUT). Not yet tested.',
			options: [
				{
					type: 'dropdown',
					label: 'Transition type',
					id: 'transitionType',
					default: 0,
					// tooltip: 'Choose position',
					choices: TRANSITION_TYPE_CHOICES_PART,
					minChoicesForSearch: 0,
				},
			],
			callback: async (action /*, bank*/) => {
				this.apiConnector.sendPerformTransition(action.options.transitionType)
			},
		}

		actions['line_in_status'] = {
			name: 'EXPERIMENTAL: Set LINE IN on/off',
			description: 'Turn on/off LINE IN. Not yet tested. Based on API v1.0.6 20250611, is it possible on MSP Series: MSP 405',
			options: [
				{
					type: 'dropdown',
					label: 'LINE IN status',
					id: 'onOff',
					default: 0,
					tooltip: 'Choose status',
					choices: AUDIO_ON_OFF_CHOICES,
					minChoicesForSearch: 0,
				},
			],
			callback: async (action /*, bank*/) => {
				this.apiConnector.sendSetLineInStatus(action.options.onOff)
			},
		}

		actions['audio_follow_video'] = {
			name: 'BETA: Set AFV (Audio Follow Video)',
			description: 'Enable or disable AFV for selected input (HDMI only?). Tested with: mini-edge SDI.',
			options: [
				{
					type: 'dropdown',
					label: 'Source number',
					id: 'sourceNumber',
					default: '1',
					tooltip: 'Choose source number',
					choices: SOURCE_CHOICES_PART_ONLY_FOUR,
					minChoicesForSearch: 0,
				},
				{
					type: 'dropdown',
					label: 'AFV status',
					id: 'onOff',
					default: 0,
					tooltip: 'Choose status',
					choices: AUDIO_ON_OFF_CHOICES,
					minChoicesForSearch: 0,
				},
			],
			callback: async (action /*, bank*/) => {
				this.apiConnector.sendSetAudioFollowVideo(action.options.sourceNumber, action.options.onOff)
			},
		}

		actions['mixing_audio'] = {
			name: 'EXPERIMENTAL: Set mixing audio',
			description: 'Turn on/off audio from sources. Not yet tested. Based on API v1.0.6 20250611, is it possible on mini Series: mini-pro, mini-pro v3, mini-ISO',
			options: [
				{
					type: 'dropdown',
					label: 'Choose output (PST or PGM)',
					id: 'output',
					default: OUTPUT_PST_PREVIEW,
					tooltip: 'Choose output (preview or program)',
					choices: SIGNAL_SWITCH_OUTPUT_CHOICES_PART,
					minChoicesForSearch: 0,
				},
				{
					type: 'dropdown',
					label: 'Source 1',
					id: 'onOff1',
					default: 0,
					tooltip: 'Choose status',
					choices: AUDIO_ON_OFF_CHOICES,
					minChoicesForSearch: 0,
				},
				{
					type: 'dropdown',
					label: 'Source 2',
					id: 'onOff2',
					default: 0,
					tooltip: 'Choose status',
					choices: AUDIO_ON_OFF_CHOICES,
					minChoicesForSearch: 0,
				},
				{
					type: 'dropdown',
					label: 'Source 3',
					id: 'onOff3',
					default: 0,
					tooltip: 'Choose status',
					choices: AUDIO_ON_OFF_CHOICES,
					minChoicesForSearch: 0,
				},
				{
					type: 'dropdown',
					label: 'Source 4',
					id: 'onOff4',
					default: 0,
					tooltip: 'Choose status',
					choices: AUDIO_ON_OFF_CHOICES,
					minChoicesForSearch: 0,
				},
				{
					type: 'dropdown',
					label: 'External',
					id: 'onOff5',
					default: 0,
					tooltip: 'Choose status',
					choices: AUDIO_ON_OFF_CHOICES,
					minChoicesForSearch: 0,
				},
			],
			callback: async (action /*, bank*/) => {
				this.apiConnector.sendSetAudioMixing(
					action.options.output,
					action.options.onOff1,
					action.options.onOff2,
					action.options.onOff3,
					action.options.onOff4,
					action.options.onOff5
				)
			},
		}

		actions['audio_volume'] = {
			name: 'EXPERIMENTAL: Set audio volume',
			description: 'Set audio volume for inputs and output.  Not yet tested. Based on API v1.0.6 20250611, is it possible on mini Series: mini-pro, mini-pro v3, mini-ISO',
			options: [
				{
					type: 'dropdown',
					label: 'Input or output',
					id: 'inputOrOutput',
					default: 0,
					tooltip: 'Choose input or output',
					choices: INPUT_OUTPUT_AUDIO_VOLUME_CHOICES_PART,
					minChoicesForSearch: 0,
				},
				{
					type: 'number',
					label: 'Volume',
					id: 'volume',
					default: 0,
					tooltip: 'Value 0-100',
					min: 0,
					max: 100,
				},
			],
			callback: async (action /*, bank*/) => {
				this.apiConnector.sendSetAudioVolume(action.options.inputOrOutput, action.options.volume)
			},
		}

		actions['line_in_volume'] = {
			name: 'EXPERIMENTAL: Set LINE IN volume',
			description: 'Set volume for LINE IN.  Not yet tested. Based on API v1.0.6 20250611, is it possible on mini Series: mini-pro, mini-pro v3, mini-ISO',
			options: [
				{
					type: 'dropdown',
					label: 'Volume',
					id: 'volume',
					default: 0,
					tooltip: 'Choose input or output',
					choices: LINE_IN_AUDIO_VOLUME_LEVEL_CHOICES_PART,
					minChoicesForSearch: 0,
				},
			],
			callback: async (action /*, bank*/) => {
				this.apiConnector.sendSetLineInVolume(action.options.volume)
			},
		}

		actions['mic_in_volume'] = {
			name: 'EXPERIMENTAL: Set MIC IN volume',
			description: 'Set volume for MIC IN.  Not yet tested. Based on API v1.0.6 20250611, is it possible on mini Series: mini-pro, mini-pro v3, mini-ISO',
			options: [
				{
					type: 'dropdown',
					label: 'Volume',
					id: 'volume',
					default: 0,
					tooltip: 'Choose input or output',
					choices: MIC_IN_AUDIO_VOLUME_LEVEL_CHOICES_PART,
					minChoicesForSearch: 0,
				},
			],
			callback: async (action /*, bank*/) => {
				this.apiConnector.sendSetMicInVolume(action.options.volume)
			},
		}

		/*
		   actions to consider		
		   0x16/0x17 Extended audio volume setting Supported devices: mini Series:mini-pro,mini-pro v3,mini-ISO
		 */

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
		this.checkFeedbacks('set_switch_to_source_to_output')
		this.checkFeedbacks('set_switch_tbar_position')
		this.checkFeedbacks('set_audio_follow_video')
		this.checkFeedbacks('set_line_in_status')
		this.checkFeedbacks('set_mixing_audio')
		this.checkFeedbacks('set_audio_volume')
		this.checkFeedbacks('set_line_in_volume')
		this.checkFeedbacks('set_mic_in_volume')
		this.checkFeedbacks('set_perform_transition')
		this.checkFeedbacks('set_load_scene_view')
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
			this.apiConnector.setPollingEdge(this.config.pollingEdge)
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
			name: 'BETA: Switch input signal channel (HDMI/SDI)',
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
					choices: SOURCE_CHOICES_PART_ONLY_FOUR,
					minChoicesForSearch: 0,
				},
			],
			callback: (feedback) => {
				return (feedback.options.type == this.apiConnector.deviceStatus.channelsForInput[feedback.options.sourceNumber])
			},
		}

		feedbacks['set_load_scene_view'] = {
			type: 'boolean',
			name: 'EXPERIMENTAL: Last loaded scene/view to Preview (PVM)',
			description: 'Last loaded scene/view to Preview (PVM)',
			defaultStyle: {
				color: combineRgb(255, 255, 255),
				bgcolor: this.BACKGROUND_COLOR_ON_AIR,
			},
			options: [
				{
					type: 'dropdown',
					label: 'Scene/view number',
					id: 'scene',
					default: '1',
					// tooltip: 'Choose source number to switch channel',
					choices: SCENES_VIEWS_CHOICES_PART,
					minChoicesForSearch: 0,
				},
			],
			callback: (feedback) => {
				return (feedback.options.scene == this.apiConnector.deviceStatus.lastLoadedScene)
			},
		}

		feedbacks['set_switch_to_source_to_output'] = {
			type: 'boolean',
			name: 'BETA: Switch signal source (PST or PGM)',
			description: 'Source switched to output (PST or PGM)',
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
					label: 'Choose output (PST or PGM)',
					id: 'output',
					default: OUTPUT_PST_PREVIEW,
					tooltip: 'Choose output (preview or program)',
					choices: SIGNAL_SWITCH_OUTPUT_CHOICES_PART,
					minChoicesForSearch: 0,
				},
			],
			callback: (feedback) => {
				return (feedback.options.sourceNumber == this.apiConnector.deviceStatus.lastSourceOnOutput[feedback.options.output])
			},
		}

		feedbacks['set_switch_tbar_position'] = {
			type: 'boolean',
			name: 'EXPERIMENTAL: T-BAR position',
			description: 'Is T-BAR on selected position',
			defaultStyle: {
				color: combineRgb(255, 255, 255),
				bgcolor: this.BACKGROUND_COLOR_ON_AIR,
			},
			options: [
				{
					type: 'dropdown',
					label: 'Position',
					id: 'position',
					default: 0,
					tooltip: 'Choose position',
					choices: TBAR_POSITION_CHOICES,
					minChoicesForSearch: 0,
				},
			],
			callback: (feedback) => {
				return (feedback.options.position == this.apiConnector.deviceStatus.tBarPosition)
			},
		}


		feedbacks['set_perform_transition'] = {
			type: 'boolean',
			name: 'EXPERIMENTAL: Last transition between Program and Preview',
			description: 'What was the last transition',
			defaultStyle: {
				color: combineRgb(255, 255, 255),
				bgcolor: this.BACKGROUND_COLOR_ON_AIR,
			},
			options: [
				{
					type: 'dropdown',
					label: 'Transition type',
					id: 'transitionType',
					default: 0,
					// tooltip: 'Choose position',
					choices: TRANSITION_TYPE_CHOICES_PART,
					minChoicesForSearch: 0,
				},
			],
			callback: (feedback) => {
				return (feedback.options.transitionType == this.apiConnector.deviceStatus.lastTransitionType)
			},
		}

		feedbacks['set_line_in_status'] = {
			type: 'boolean',
			name: 'EXPERIMENTAL: LINE IN on/off',
			description: 'Is LINE IN on/off',
			defaultStyle: {
				color: combineRgb(255, 255, 255),
				bgcolor: this.BACKGROUND_COLOR_ON_AIR,
			},
			options: [
				{
					type: 'dropdown',
					label: 'LINE IN status',
					id: 'onOff',
					default: 0,
					tooltip: 'Choose status',
					choices: AUDIO_ON_OFF_CHOICES,
					minChoicesForSearch: 0,
				},
			],
			callback: (feedback) => {
				return (feedback.options.onOff == this.apiConnector.deviceStatus.lineInStatus)
			},
		}

		feedbacks['set_audio_follow_video'] = {
			type: 'boolean',
			name: 'BETA: AFV (Audio Follow Video) status',
			description: 'Is AFV on/off for selected input',
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
					choices: SOURCE_CHOICES_PART_ONLY_FOUR,
					minChoicesForSearch: 0,
				},
				{
					type: 'dropdown',
					label: 'AFV status',
					id: 'onOff',
					default: 0,
					tooltip: 'Choose status',
					choices: AUDIO_ON_OFF_CHOICES,
					minChoicesForSearch: 0,
				},
			],
			callback: (feedback) => {
				return (feedback.options.onOff == this.apiConnector.deviceStatus.audioFollowVideo[feedback.options.sourceNumber])
			},
		}

		feedbacks['set_mixing_audio'] = {
			type: 'boolean',
			name: 'EXPERIMENAL: Mixing audio status',
			description: 'Mixing audio statuses for inputs',
			defaultStyle: {
				color: combineRgb(255, 255, 255),
				bgcolor: this.BACKGROUND_COLOR_ON_AIR,
			},
			options: [
				{
					type: 'dropdown',
					label: 'Choose output (PST or PGM)',
					id: 'output',
					default: OUTPUT_PST_PREVIEW,
					tooltip: 'Choose output (preview or program)',
					choices: SIGNAL_SWITCH_OUTPUT_CHOICES_PART,
					minChoicesForSearch: 0,
				},
				{
					type: 'dropdown',
					label: 'Source 1',
					id: 'onOff1',
					default: 0,
					tooltip: 'Choose status',
					choices: AUDIO_ON_OFF_CHOICES,
					minChoicesForSearch: 0,
				},
				{
					type: 'dropdown',
					label: 'Source 2',
					id: 'onOff2',
					default: 0,
					tooltip: 'Choose status',
					choices: AUDIO_ON_OFF_CHOICES,
					minChoicesForSearch: 0,
				},
				{
					type: 'dropdown',
					label: 'Source 3',
					id: 'onOff3',
					default: 0,
					tooltip: 'Choose status',
					choices: AUDIO_ON_OFF_CHOICES,
					minChoicesForSearch: 0,
				},
				{
					type: 'dropdown',
					label: 'Source 4',
					id: 'onOff4',
					default: 0,
					tooltip: 'Choose status',
					choices: AUDIO_ON_OFF_CHOICES,
					minChoicesForSearch: 0,
				},
				{
					type: 'dropdown',
					label: 'External',
					id: 'onOff5',
					default: 0,
					tooltip: 'Choose status',
					choices: AUDIO_ON_OFF_CHOICES,
					minChoicesForSearch: 0,
				},
			],
			callback: (feedback) => {
				let value =
					(feedback.options.onOff5 << 4) |
					(feedback.options.onOff4 << 3) |
					(feedback.options.onOff3 << 2) |
					(feedback.options.onOff2 << 1) |
					(feedback.options.onOff1 << 0)
				return (value == this.apiConnector.deviceStatus.mixingAudio[feedback.options.output])
			},
		}

		feedbacks['set_audio_volume'] = {
			type: 'boolean',
			name: 'EXPERIMENTAL: Current audio volume',
			description: 'Check current audio volume for selected input or output',
			defaultStyle: {
				color: combineRgb(255, 255, 255),
				bgcolor: this.BACKGROUND_COLOR_ON_AIR,
			},
			options: [
				{
					type: 'dropdown',
					label: 'Input or output',
					id: 'inputOrOutput',
					default: 0,
					tooltip: 'Choose input or output',
					choices: INPUT_OUTPUT_AUDIO_VOLUME_CHOICES_PART,
					minChoicesForSearch: 0,
				},
				{
					type: 'number',
					label: 'Volume',
					id: 'volume',
					default: 0,
					tooltip: 'Value 0-100',
					min: 0,
					max: 100,
				},
			],
			callback: (feedback) => {
				return (feedback.options.volume == this.apiConnector.deviceStatus.audioVolume[feedback.options.inputOrOutput])
			},
		}

		feedbacks['set_line_in_volume'] = {
			type: 'boolean',
			name: 'EXPERIMENTAL: LINE IN volume',
			description: 'Check current LINE IN volume',
			defaultStyle: {
				color: combineRgb(255, 255, 255),
				bgcolor: this.BACKGROUND_COLOR_ON_AIR,
			},
			options: [
				{
					type: 'dropdown',
					label: 'Volume',
					id: 'volume',
					default: 0,
					tooltip: 'Choose input or output',
					choices: LINE_IN_AUDIO_VOLUME_LEVEL_CHOICES_PART,
					minChoicesForSearch: 0,
				},
			],
			callback: (feedback) => {
				return (feedback.options.volume == this.apiConnector.deviceStatus.lineInVolume)
			},
		}

		feedbacks['set_mic_in_volume'] = {
			type: 'boolean',
			name: 'EXPERIMENTAL: MIC IN volume',
			description: 'Check current MIC IN volume',
			defaultStyle: {
				color: combineRgb(255, 255, 255),
				bgcolor: this.BACKGROUND_COLOR_ON_AIR,
			},
			options: [
				{
					type: 'dropdown',
					label: 'Volume',
					id: 'volume',
					default: 0,
					tooltip: 'Choose input or output',
					choices: MIC_IN_AUDIO_VOLUME_LEVEL_CHOICES_PART,
					minChoicesForSearch: 0,
				},
			],
			callback: (feedback) => {
				return (feedback.options.volume == this.apiConnector.deviceStatus.micInVolume)
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
		presets.push(showEffectPreset)

		for (const item of SOURCE_CHOICES_PART_ONLY_FOUR) {
			for (const item2 of INPUT_CHANNEL_CHOICES_PART) {
				presets.push({
					type: 'button',
					category: 'BETA: Switch input signal channel (HDMI/SDI)',
					name: 'BETA: Source ' + item.label + '\\n- ' + item2.label,
					style: {
						text: 'BETA: Source ' + item.label + '\\n- ' + item2.label,
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

		let colorsForPstPgm = []
		colorsForPstPgm[OUTPUT_PST_PREVIEW] = this.BACKGROUND_COLOR_PREVIEW
		colorsForPstPgm[OUTPUT_PGM_PROGRAM] = this.BACKGROUND_COLOR_ON_AIR

		for (const item of SOURCE_CHOICES_PART) {
			for (const item2 of SIGNAL_SWITCH_OUTPUT_CHOICES_PART) {
				let color
				presets.push({
					type: 'button',
					category: 'BETA: Switch signal source (PST or PGM)',
					name: 'BETA: Source ' + item.label + '\\nto ' + item2.label,
					style: {
						text: 'BETA: Source ' + item.label + '\\nto ' + item2.label,
						size: 'auto',
						color: this.TEXT_COLOR,
						bgcolor: this.BACKGROUND_COLOR_DEFAULT,
					},
					steps: [
						{
							down: [
								{
									actionId: 'switch_to_source_to_output',
									options: {
										sourceNumber: item.id,
										output: item2.id,
									},
								},
							],
							up: [],
						},
					],
					feedbacks: [
						{
							feedbackId: 'set_switch_to_source_to_output',
							options: {
								sourceNumber: item.id,
								output: item2.id,
							},
							style: {
								color: this.TEXT_COLOR,
								bgcolor: colorsForPstPgm[item2.id],
							},
						},
					],
				})
			}
		}

		for (const item of TBAR_POSITION_CHOICES) {
			presets.push({
				type: 'button',
				category: 'EXPERIMENTAL: T-BAR position',
				name: 'EXPERIMENTAL: T-BAR position ' + item.label,
				style: {
					text: 'EXPERIMENTAL: T-BAR position ' + item.label,
					size: 'auto',
					color: this.TEXT_COLOR,
					bgcolor: this.BACKGROUND_COLOR_DEFAULT,
				},
				steps: [
					{
						down: [
							{
								actionId: 'switch_tbar_position',
								options: {
									position: item.id,
								},
							},
						],
						up: [],
					},
				],
				feedbacks: [
					{
						feedbackId: 'set_switch_tbar_position',
						options: {
							position: item.id,
						},
						style: {
							color: this.TEXT_COLOR,
							bgcolor: this.BACKGROUND_COLOR_ON_AIR,
						},
					},
				],
			})
		}

		for (const item of SOURCE_CHOICES_PART_ONLY_FOUR) {
			for (const item2 of AUDIO_ON_OFF_CHOICES) {
				presets.push({
					type: 'button',
					category: 'BETA: Set AFV status',
					name: 'BETA: Source ' + item.label + '\\n AFV ' + item2.label,
					style: {
						text: 'BETA: Source ' + item.label + '\\n AFV ' + item2.label,
						size: 'auto',
						color: this.TEXT_COLOR,
						bgcolor: this.BACKGROUND_COLOR_DEFAULT,
					},
					steps: [
						{
							down: [
								{
									actionId: 'audio_follow_video',
									options: {
										sourceNumber: item.id,
										onOff: item2.id,
									},
								},
							],
							up: [],
						},
					],
					feedbacks: [
						{
							feedbackId: 'set_audio_follow_video',
							options: {
								sourceNumber: item.id,
								onOff: item2.id,
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


		for (const item of AUDIO_ON_OFF_CHOICES) {
			presets.push({
				type: 'button',
				category: 'EXPERIMENTAL: Set LINE IN status',
				name: 'EXPERIMENTAL: LINE IN is ' + item.label,
				style: {
					text: 'EXPERIMENTAL: LINE IN is ' + item.label,
					size: 'auto',
					color: this.TEXT_COLOR,
					bgcolor: this.BACKGROUND_COLOR_DEFAULT,
				},
				steps: [
					{
						down: [
							{
								actionId: 'line_in_status',
								options: {
									onOff: item.id,
								},
							},
						],
						up: [],
					},
				],
				feedbacks: [
					{
						feedbackId: 'set_line_in_status',
						options: {
							onOff: item.id,
						},
						style: {
							color: this.TEXT_COLOR,
							bgcolor: this.BACKGROUND_COLOR_ON_AIR,
						},
					},
				],
			})
		}

		for (const item of SIGNAL_SWITCH_OUTPUT_CHOICES_PART) {
			presets.push({
				type: 'button',
				category: 'EXPERIMENTAL: Mixing audio',
				name: 'EXPERIMENTAL: All audio ON for ' + item.label,
				style: {
					text: 'EXPERIMENTAL: All audio ON for ' + item.label,
					size: 'auto',
					color: this.TEXT_COLOR,
					bgcolor: this.BACKGROUND_COLOR_DEFAULT,
				},
				steps: [
					{
						down: [
							{
								actionId: 'mixing_audio',
								options: {
									output: item.id,
									onOff1: 1,
									onOff2: 1,
									onOff3: 1,
									onOff4: 1,
									onOff5: 1,
								},
							},
						],
						up: [],
					},
				],
				feedbacks: [
					{
						feedbackId: 'set_mixing_audio',
						options: {
							output: item.id,
							onOff1: 1,
							onOff2: 1,
							onOff3: 1,
							onOff4: 1,
							onOff5: 1,
						},
						style: {
							color: this.TEXT_COLOR,
							bgcolor: colorsForPstPgm[item.id],
						},
					},
				],
			})

			presets.push({
				type: 'button',
				category: 'EXPERIMENTAL: Mixing audio',
				name: 'EXPERIMENTAL: All audio OFF for ' + item.label,
				style: {
					text: 'EXPERIMENTAL: All audio OFF for ' + item.label,
					size: 'auto',
					color: this.TEXT_COLOR,
					bgcolor: this.BACKGROUND_COLOR_DEFAULT,
				},
				steps: [
					{
						down: [
							{
								actionId: 'mixing_audio',
								options: {
									output: item.id,
									onOff1: 0,
									onOff2: 0,
									onOff3: 0,
									onOff4: 0,
									onOff5: 0,
								},
							},
						],
						up: [],
					},
				],
				feedbacks: [
					{
						feedbackId: 'set_mixing_audio',
						options: {
							output: item.id,
							onOff1: 0,
							onOff2: 0,
							onOff3: 0,
							onOff4: 0,
							onOff5: 0,
						},
						style: {
							color: this.TEXT_COLOR,
							bgcolor: colorsForPstPgm[item.id],
						},
					},
				],
			})
		}

		let inputOutputVolumeExamples = [0, 25, 50, 75, 100]
		for (const volume of inputOutputVolumeExamples) {
			for (const item2 of INPUT_OUTPUT_AUDIO_VOLUME_CHOICES_PART) {
				presets.push({
					type: 'button',
					category: 'EXPERIMENTAL: Set audio volume',
					name: 'EXPERIMENTAL: Set ' + item2.label + '\\nto ' + volume,
					style: {
						text: 'EXPERIMENTAL: Set ' + item2.label + '\\nto ' + volume,
						size: 'auto',
						color: this.TEXT_COLOR,
						bgcolor: this.BACKGROUND_COLOR_DEFAULT,
					},
					steps: [
						{
							down: [
								{
									actionId: 'audio_volume',
									options: {
										inputOrOutput: item2.id,
										volume: volume,
									},
								},
							],
							up: [],
						},
					],
					feedbacks: [
						{
							feedbackId: 'set_audio_volume',
							options: {
								inputOrOutput: item2.id,
								volume: volume,
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

		for (const item of LINE_IN_AUDIO_VOLUME_LEVEL_CHOICES_PART) {
			presets.push({
				type: 'button',
				category: 'EXPERIMENTAL: Set LINE IN volume',
				name: 'EXPERIMENTAL: Set LINE IN ' + item.label,
				style: {
					text: 'EXPERIMENTAL: Set LINE IN ' + item.label,
					size: 'auto',
					color: this.TEXT_COLOR,
					bgcolor: this.BACKGROUND_COLOR_DEFAULT,
				},
				steps: [
					{
						down: [
							{
								actionId: 'line_in_volume',
								options: {
									volume: item.id,
								},
							},
						],
						up: [],
					},
				],
				feedbacks: [
					{
						feedbackId: 'set_line_in_volume',
						options: {
							volume: item.id,
						},
						style: {
							color: this.TEXT_COLOR,
							bgcolor: this.BACKGROUND_COLOR_ON_AIR,
						},
					},
				],
			})
		}

		for (const item of MIC_IN_AUDIO_VOLUME_LEVEL_CHOICES_PART) {
			presets.push({
				type: 'button',
				category: 'EXPERIMENTAL: Set MIC IN volume',
				name: 'EXPERIMENTAL: Set MIC IN ' + item.label,
				style: {
					text: 'EXPERIMENTAL: Set MIC IN ' + item.label,
					size: 'auto',
					color: this.TEXT_COLOR,
					bgcolor: this.BACKGROUND_COLOR_DEFAULT,
				},
				steps: [
					{
						down: [
							{
								actionId: 'mic_in_volume',
								options: {
									volume: item.id,
								},
							},
						],
						up: [],
					},
				],
				feedbacks: [
					{
						feedbackId: 'set_mic_in_volume',
						options: {
							volume: item.id,
						},
						style: {
							color: this.TEXT_COLOR,
							bgcolor: this.BACKGROUND_COLOR_ON_AIR,
						},
					},
				],
			})
		}

		for (const item of SCENES_VIEWS_CHOICES_PART) {
			presets.push({
				type: 'button',
				category: 'EXPERIMENTAL: Load scene',
				name: 'EXPERIMENTAL: Load\n' + item.label,
				style: {
					text: 'EXPERIMENTAL: Load\n' + item.label,
					size: 'auto',
					color: this.TEXT_COLOR,
					bgcolor: this.BACKGROUND_COLOR_DEFAULT,
				},
				steps: [
					{
						down: [
							{
								actionId: 'load_scene_view',
								options: {
									scene: item.id,
								},
							},
						],
						up: [],
					},
				],
				feedbacks: [
					{
						feedbackId: 'set_load_scene_view',
						options: {
							scene: item.id,
						},
						style: {
							color: this.TEXT_COLOR,
							bgcolor: this.BACKGROUND_COLOR_PREVIEW,
						},
					},
				],
			})
		}

		for (const item of TRANSITION_TYPE_CHOICES_PART) {
			presets.push({
				type: 'button',
				category: 'EXPERIMENTAL: Performs transition',
				name: 'EXPERIMENTAL: Performs transition\n' + item.label,
				style: {
					text: 'EXPERIMENTAL: Performs transition\n' + item.label,
					size: 'auto',
					color: this.TEXT_COLOR,
					bgcolor: this.BACKGROUND_COLOR_DEFAULT,
				},
				steps: [
					{
						down: [
							{
								actionId: 'perform_transition',
								options: {
									transitionType: item.id,
								},
							},
						],
						up: [],
					},
				],
				feedbacks: [
					{
						feedbackId: 'set_perform_transition',
						options: {
							transitionType: item.id,
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
	}

	updateVariableDefinitions() {
		this.setVariableDefinitions([
			{ variableId: 'device.key', name: 'Device model/version key' },
			{ variableId: 'device.name', name: 'Known name of device' },
		])
		this.updateVariableValues()
	}

	updateVariableValues() {
		let values = []
		values['device.key'] = this.apiConnector.deviceStatus.deviceModelKey
		values['device.name'] = KNOWN_DEVICE_MODEL_VERSIONS[this.apiConnector.deviceStatus.deviceModelKey]
		this.setVariableValues(values)
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
