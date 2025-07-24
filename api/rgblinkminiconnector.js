const { RGBLinkApiConnector, PollingCommand, ApiConfig } = require('./rgblinkapiconnector')

const SWITCH_MODE_AUTO = 0
const SWITCH_MODE_TBAR = 1

const INPUT_SIGNAL_CHANNEL_HDMI = 0
const INPUT_SIGNAL_CHANNEL_SDI = 1

const PIP_LAYER_A = 0
const PIP_LAYER_B = 1

const OUTPUT_PST_PREVIEW = 0
const OUTPUT_PGM_PROGRAM = 1

const PIP_MODE_OFF = 0
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
	0x0: 'CUT',
	0x1: 'FADE',
	0x2: '<-[]->',
	0x3: 'L->R',
	0x4: 'T->B',
	0x5: 'LT->RB',
	0x6: '<-+->',
	0x7: 'R->L',
	0x8: 'B->T',
	0x9: 'L<-M->R',
	0xa: 'T<-M->B',
	0xb: '->+<-',
	0xc: '|||->',
	0xd: '->[]<-',
	0xe: '<-O->',
}

class RGBLinkMiniConnector extends RGBLinkApiConnector {
	EVENT_NAME_ON_DEVICE_STATE_CHANGED = 'on_device_state_changed'

	deviceStatus = {
		prevSource: undefined,
		liveSource: undefined,
		switchMode: undefined,
		switchEffect: undefined,
		pipMode: undefined,
		pipLayer: undefined,
		channelsForInput: [],
		lastSourceOnOutput: [], // czy to duplikat dla prevSource i liveSource?
		tBarPosition: undefined,
		audioFollowVideo: [],
		lineInStatus: undefined,
		mixingAudio: [],
		audioVolume: [],
		lineInVolume: undefined,
		micInVolume: undefined,
	}

	constructor(/*ApiConfig*/ config = new ApiConfig()) {
		super(config)
		var self = this

		this.on(this.EVENT_NAME_ON_DATA_API_NOT_STANDARD_LENGTH, (message) => {
			if (message.length == 22) {
				self.consume22(message)
				this.emit(this.EVENT_NAME_ON_DEVICE_STATE_CHANGED, [])
			}
		})

		this.on(this.EVENT_NAME_ON_DATA_API, (ADDR, SN, CMD, DAT1, DAT2, DAT3, DAT4) => {
			let changedEvents = self.consumeFeedback(ADDR, SN, CMD, DAT1, DAT2, DAT3, DAT4)
			this.emit(this.EVENT_NAME_ON_DEVICE_STATE_CHANGED, changedEvents)
		})
	}

	sendConnectMessage() {
		this.sendCommand('68', '66', '01' /*Connect*/, '00', '00')
	}

	sendDisconnectMessage() {
		this.sendCommand('68', '66', '00' /*Disconnect*/, '00', '00')
	}

	getPollingCommands() {
		let commands = []

		commands.push(new PollingCommand('78', '13', '00', '00', '00')) // asking about switch setting
		commands.push(new PollingCommand('75', '1F', '00', '00', '00')) // asking about PIP mode
		commands.push(new PollingCommand('78', '07', '00', '00', '00')) // asking about switch effect
		commands.push(new PollingCommand('75', '1B', '00', '00', '00')) // asking about PIP layer (A or B)
		commands.push(new PollingCommand('F1', '40', '01', '00', '00')) // asking about special status 22

		if (this.config.pollingEdge) {
			// mini-iso、mini-edge SDI、mini-mx SDI, but what returns mini/mini+/mini pro ?
			commands.push(new PollingCommand('73', '19', '00', '00', '00')) // channel type for input 1 (HDMI/SDI)
			commands.push(new PollingCommand('73', '19', '01', '00', '00')) // channel type for input 2 (HDMI/SDI)
			commands.push(new PollingCommand('73', '19', '02', '00', '00')) // channel type for input 3 (HDMI/SDI)
			commands.push(new PollingCommand('73', '19', '03', '00', '00')) // channel type for input 4 (HDMI/SDI)
			commands.push(new PollingCommand('A2', '18', '00', '00', '00')) // channel type for input(HDMI/SDI)

			commands.push(new PollingCommand('75', '03', '00', '00', '00')) // POC read Signal source switch set
			commands.push(new PollingCommand('75', '03', '00', '00', '01')) // POC read Signal source switch set

			// commands.push(new PollingCommand('81', '01', '00', '00', '00')) // LINE IN STATUS, but for MSP series 405
			commands.push(new PollingCommand('81', '09', '00', '00', '00')) // Read Audio Follow Video - HDMI 1
			commands.push(new PollingCommand('81', '09', '01', '00', '00')) // Read Audio Follow Video - HDMI 2
			commands.push(new PollingCommand('81', '09', '02', '00', '00')) // Read Audio Follow Video - HDMI 3
			commands.push(new PollingCommand('81', '09', '03', '00', '00')) // Read Audio Follow Video - HDMI 4
			commands.push(new PollingCommand('81', '09', '04', '00', '00')) // Read Audio Follow Video - is it works?

			commands.push(new PollingCommand('81', '0D', '00', '00', '00')) // Read Mixing Audio for PST
			commands.push(new PollingCommand('81', '0D', '01', '00', '00')) // Read Mixing Audio for PGM

			commands.push(new PollingCommand('81', '0F', '00', '00', '00')) // Read Audio Volume - HDMI 1
			commands.push(new PollingCommand('81', '0F', '01', '00', '00')) // Read Audio Volume - HDMI 2
			commands.push(new PollingCommand('81', '0F', '02', '00', '00')) // Read Audio Volume - HDMI 3
			commands.push(new PollingCommand('81', '0F', '03', '00', '00')) // Read Audio Volume - HDMI 4
			commands.push(new PollingCommand('81', '0F', '05', '00', '00')) // Read Audio Volume - Output

			commands.push(new PollingCommand('81', '17', '00', '00', '00')) // LINE IN volume
			commands.push(new PollingCommand('81', '17', '01', '00', '00')) // MIC IN volume
		}

		return commands
	}

	sendSwitchModeMessage(mode) {
		if (mode == SWITCH_MODE_AUTO || mode == SWITCH_MODE_TBAR) {
			let modeHex = this.byteToTwoSignHex(mode)
			this.sendCommand('78', '12', modeHex, '00', '00')
		} else {
			this.myWarn('Unknown mode ' + mode)
		}
	}

	sendSwitchToSourceMessage(source) {
		this.sendSwitchToSourceToOutputMessage(source, OUTPUT_PST_PREVIEW)
	}

	sendSwitchToSourceToOutputMessage(source, output) {
		if (this.isSourceNumberValid(source)) {
			let sourceHex = this.byteToTwoSignHex(source - 1)
			if (this.isOutputValid(output)) {
				let outputHex = this.byteToTwoSignHex(output)
				this.sendCommand('75', '02', '00', sourceHex, outputHex)
			} else {
				this.myWarn('Bad output:' + output)
			}
		} else {
			this.myWarn('Bad source:' + source)
		}
	}

	sendPIPModeMessage(mode) {
		this.sendCommand('75', '1E' /*Write*/, '00', this.byteToTwoSignHex(mode), '00')
	}

	sendSwitchEffectMessage(effect) {
		this.sendCommand('78', '06' /*Write*/, this.byteToTwoSignHex(effect), '00', '00')
	}

	sendSwitchPipLayerMessage(layer) {
		let layerCode
		if (layer == PIP_LAYER_A) {
			layerCode = '00'
		} else if (layer == PIP_LAYER_B) {
			layerCode = '01'
		} else {
			this.myWarn('Bad layer id:' + layer)
			return
		}
		this.sendCommand('75', '1A' /*Write*/, '00', layerCode, '00')
	}

	sendBuildPipMessages(mode /*T-BAR - preview / Auto - live output */, pipMode, sourceOnLayerA, sourceOnLayerB) {
		if (mode == SWITCH_MODE_AUTO || mode == SWITCH_MODE_TBAR) {
			this.sendSwitchModeMessage(mode)
		} else {
			this.myWarn('Bad mode:' + mode)
			return
		}
		this.sendPIPModeMessage(pipMode)
		if (sourceOnLayerA >= 0 && sourceOnLayerA <= 3) {
			this.sendSwitchPipLayerMessage(PIP_LAYER_A)
			this.sendSwitchToSourceMessage(sourceOnLayerA)
		}
		if (sourceOnLayerB >= 0 && sourceOnLayerB <= 3) {
			this.sendSwitchPipLayerMessage(PIP_LAYER_B)
			this.sendSwitchToSourceMessage(sourceOnLayerB)
		}
	}

	sendSwitchInputSignalChannel(source, type) {
		if (this.isSourceNumberValid(source)) {
			let sourceHex = this.byteToTwoSignHex(source - 1)
			if (this.isChannelTypeValid(type)) {
				let typeHex = this.byteToTwoSignHex(type)
				this.sendCommand('73', '18', sourceHex, typeHex, '00')
			} else {
				this.myWarn('Bad type:' + type)
			}
		} else {
			this.myWarn('Bad source:' + source)
		}
	}

	sendSetTBarPosition(value) {
		value = value & 0xFFFF;
		let lowHex = this.byteToTwoSignHex(value % 256)
		let hiHex = this.byteToTwoSignHex(Math.floor(value / 256))
		this.sendCommand('78', '08', lowHex, hiHex, '00') // set T-BAR position
	}

	sendSetAudioFollowVideo(source, onOff) {
		if (this.isSourceNumberValid(source)) {
			let sourceHex = this.byteToTwoSignHex(source - 1)
			if (this.isOnOffValid(onOff)) {
				let onOffHex = this.byteToTwoSignHex(onOff)
				this.sendCommand('81', '08', sourceHex, onOffHex, '00')
			} else {
				this.myWarn('Bad onOff:' + onOff)
			}
		} else {
			this.myWarn('Bad source:' + source)
		}
	}

	sendSetLineInStatus(onOff) {
		if (this.isOnOffValid(onOff)) {
			let onOffHex = this.byteToTwoSignHex(onOff)
			this.sendCommand('81', '00', '00', onOffHex, '00')
		} else {
			this.myWarn('Bad onOff:' + onOff)
		}
	}

	sendSetAudioMixing(outputPstOrPgm, bit0, bit1, bit2, bit3, bit4) {
		if (this.isOutputValid(outputPstOrPgm) && this.isOnOffValid(bit0) && this.isOnOffValid(bit1) && this.isOnOffValid(bit2) && this.isOnOffValid(bit3) && this.isOnOffValid(bit4)) {
			let value =
				(bit4 << 4) |
				(bit3 << 3) |
				(bit2 << 2) |
				(bit1 << 1) |
				(bit0 << 0)
			let dat3 = this.byteToTwoSignHex(value)
			this.sendCommand('81', '0C', this.byteToTwoSignHex(outputPstOrPgm), dat3, '00')
		} else {
			this.myWarn(`Bad param(s) output;${outputPstOrPgm} bits: ${bit0},${bit1},${bit2},${bit3},${bit4}`)
		}
	}

	sendSetAudioVolume(inputOrOutput, volume) {
		if (this.isInputOrOutputAudioValid(inputOrOutput)) {
			if (this.isVolumeLevelValid(volume)) {
				this.sendCommand('81', '0E', this.byteToTwoSignHex(inputOrOutput), this.byteToTwoSignHex(volume), '00')
			} else {
				this.myWarn(`Bad volume level: ${volume}`)
			}
		} else {
			this.myWarn(`Bad input or output number: ${inputOrOutput}`)
		}
	}

	sendSetLineInVolume(volume) {
		if (this.isLineInVolumeLevelValid(volume)) {
			this.sendCommand('81', '16', '00', this.byteToTwoSignHex(volume), '00')
		} else {
			this.myWarn(`Bad LINE IN volume level ${volume}`)
		}
	}

	sendSetMicInVolume(volume) {
		if (this.isMicInVolumeLevelValid(volume)) {
			this.sendCommand('81', '16', '01', this.byteToTwoSignHex(volume), '00')
		} else {
			this.myWarn(`Bad MIC IN volume level ${volume}`)
		}
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
	}

	isSourceNumberValid(src) {
		return (src >= 1 && src <= 5)
	}

	isChannelTypeValid(type) {
		return (type == INPUT_SIGNAL_CHANNEL_HDMI || type == INPUT_SIGNAL_CHANNEL_SDI)
	}

	isOutputValid(output) {
		return (output == OUTPUT_PST_PREVIEW || output == OUTPUT_PGM_PROGRAM)
	}

	isOnOffValid(onOff) {
		return (onOff == 0 || onOff == 1)
	}

	isInputOrOutputAudioValid(inputOrOutput) {
		return (inputOrOutput == 5 || (inputOrOutput >= 0 && inputOrOutput <= 3))
	}

	isVolumeLevelValid(volume) {
		return volume >= 0 && volume <= 100
	}

	isLineInVolumeLevelValid(volume) {
		return volume >= 0 && volume <= 0x1F
	}

	isMicInVolumeLevelValid(volume) {
		return volume >= 0 && volume <= 8
	}

	consumeFeedback(ADDR, SN, CMD, DAT1, DAT2, DAT3, DAT4) {
		let redeableMsg = [ADDR, SN, CMD, DAT1, DAT2, DAT3, DAT4].join(' ')
		try {
			let importantPart = CMD + DAT1 + DAT2 + DAT3 + DAT4
			if ('F140011600' == importantPart) {
				// readed status, it's ok
				this.emitConnectionStatusOK()
				return this.logFeedback(redeableMsg, 'Status readed')
			}

			if (CMD == '68') {
				// 0x68 Establish/disconnect communication
				// eg. '<F00006866010000CF>';
				if (DAT2 == '00') {
					this.emitConnectionStatusOK()
					return this.logFeedback(redeableMsg, 'Device disconnected')
				} else if (DAT2 == '01') {
					this.emitConnectionStatusOK()
					return this.logFeedback(redeableMsg, 'Device connected')
				}
			} else if (CMD == '73') {
				// 0x73 Switch input signal channel: HDMI/SDI
				if (DAT1 == '18' || DAT1 == '19') {
					// 0x18 Set input signal channel
					// 0x19 Read input signal channel
					let src = parseInt(DAT2) + 1
					let type = parseInt(DAT3)
					if (this.isSourceNumberValid(src) && this.isChannelTypeValid(type)) {
						this.emitConnectionStatusOK()
						this.deviceStatus.channelsForInput[src] = type
						return this.logFeedback(redeableMsg, 'Input ' + src + ' use channel ' + type + ' (' + (type == 1 ? 'HDMI' : 'SDI') + ')')
					}
				}
			} else if (CMD == '75') {
				// 0x75 Read/write video processor information
				if (DAT1 == '02' || DAT1 == '03') {
					// Signal source switching Settings
					// 0x02(Write), 0x03(Read)
					let src = parseInt(DAT3) + 1
					if (this.isSourceNumberValid(src)) {
						this.emitConnectionStatusOK()
						this.deviceStatus.liveSource = src
						// lets try
						let output = parseInt(DAT4)
						if (output == OUTPUT_PST_PREVIEW || output == OUTPUT_PGM_PROGRAM) {
							this.deviceStatus.lastSourceOnOutput[output] = src
						}
						// lets try - end
						return this.logFeedback(redeableMsg, 'Choosed signal ' + this.deviceStatus.liveSource)
					}
				} else if (DAT1 == '1A' || DAT1 == '1B') {
					// T0000751B00000090 PIP layer (A or B)
					if (DAT3 == '00') {
						this.emitConnectionStatusOK()
						this.deviceStatus.pipLayer = PIP_LAYER_A
						return this.logFeedback(redeableMsg, 'PIP Layer A')
					} else if (DAT3 == '01') {
						this.emitConnectionStatusOK()
						this.deviceStatus.pipLayer = PIP_LAYER_B
						return this.logFeedback(redeableMsg, 'PIP Layer B')
					}
				} else if (DAT1 == '1E' || DAT1 == '1F') {
					// Picture-In-Picture mode
					// 0x1E(Write), 0x1F(Read)
					let mode = parseInt(DAT3)
					if (mode >= 0 && mode <= 9) {
						this.emitConnectionStatusOK()
						this.deviceStatus.pipMode = mode
						return this.logFeedback(redeableMsg, 'PIP mode: ' + PIP_MODES[mode])
					}
				}
			} else if (CMD == '78') {
				// 0x78 Switching Setting
				if (DAT1 == '12' || DAT1 == '13') {
					// T-BAR/Auto
					if (DAT2 == '00') {
						this.emitConnectionStatusOK()
						this.deviceStatus.switchMode = parseInt(DAT2)
						return this.logFeedback(redeableMsg, 'Swtich mode Auto')
					} else if (DAT2 == '01') {
						this.emitConnectionStatusOK()
						this.deviceStatus.switchMode = parseInt(DAT2)
						return this.logFeedback(redeableMsg, 'Swtich mode T-BAR')
					}
				} else if (DAT1 == '06' || DAT1 == '07') {
					// Switching effect setting
					let effect = parseInt(DAT2, this.PARSE_INT_HEX_MODE)
					if (effect >= 0 && effect <= 0x0e) {
						this.emitConnectionStatusOK()
						this.deviceStatus.switchEffect = effect
						return this.logFeedback(redeableMsg, 'Switch effect: ' + SWITCH_EFFECT[effect])
					}
				} else if (DAT1 == '08' || DAT1 == '09') {
					// Set T-BAR position
					let position = parseInt(DAT2, this.PARSE_INT_HEX_MODE) + parseInt(DAT3, this.PARSE_INT_HEX_MODE) * 256
					this.emitConnectionStatusOK()
					this.deviceStatus.tBarPosition = position
					return this.logFeedback(redeableMsg, 'T-BAR position: ' + position)
				}
			} else if (CMD == 'A2') {
				if (DAT1 == '18') {
					// T-BAR position status changed
					let position = parseInt(DAT2, this.PARSE_INT_HEX_MODE) + parseInt(DAT3, this.PARSE_INT_HEX_MODE) * 256
					this.emitConnectionStatusOK()
					this.deviceStatus.tBarPosition = position
					return this.logFeedback(redeableMsg, 'T-BAR position: ' + position)
				}
			} else if (CMD == '81') {
				if (DAT1 == '00' || DAT1 == '01') {
					// 0x00 Set LINE IN status
					// 0x01 Read LINE IN status
					let onOff = parseInt(DAT3)
					if (this.isOnOffValid(onOff)) {
						this.emitConnectionStatusOK()
						this.deviceStatus.lineInStatus = onOff
						return this.logFeedback(redeableMsg, 'LINE IN status:' + onOff)
					}
				} else if (DAT1 == '08' || DAT1 == '09') {
					// 0x08/0x09 AFV (Audio Follow Video)
					let src = parseInt(DAT2) + 1
					let onOff = parseInt(DAT3)
					if (this.isSourceNumberValid(src) && this.isOnOffValid(onOff)) {
						this.emitConnectionStatusOK()
						this.deviceStatus.audioFollowVideo[src] = onOff
						return this.logFeedback(redeableMsg, 'AFV status for input:' + src + ' is:' + onOff)
					}
				} else if (DAT1 == '16' || DAT1 == '17') {
					// 0x16/0x17 Extended audio volume setting
					let lineMicIn = parseInt(DAT2)
					let volume = parseInt(DAT3)
					if (lineMicIn == 0 && this.isLineInVolumeLevelValid(volume)) {
						// line in
						this.emitConnectionStatusOK()
						this.deviceStatus.lineInVolume = volume
						return this.logFeedback(redeableMsg, 'LINE IN volume level:' + volume)
					} else if (lineMicIn == 1 && this.isMicInVolumeLevelValid(volume)) {
						// mic in
						this.emitConnectionStatusOK()
						this.deviceStatus.micInVolume = volume
						return this.logFeedback(redeableMsg, 'MIC IN volume level:' + volume)
					}
				} else if (DAT1 == '0C' || DAT1 == '0D') {
					// 0x0C/0x0D Mixing Audio
					let outputPstOrPgm = parseInt(DAT2)
					let onOffValue = parseInt(DAT3, this.PARSE_INT_HEX_MODE)
					if (this.isOutputValid(outputPstOrPgm)) {
						this.emitConnectionStatusOK()
						this.deviceStatus.mixingAudio[outputPstOrPgm] = onOffValue
						return this.logFeedback(redeableMsg, `Mixing audio value for ${outputPstOrPgm} is ${onOffValue}`)
					}
				} else if (DAT1 == '0E' || DAT1 == '0F') {
					// 0x0E/0x0F HDMI and output audio volume setting
					let inputOrOutput = parseInt(DAT2)
					let volume = parseInt(DAT3, this.PARSE_INT_HEX_MODE)
					if (this.isInputOrOutputAudioValid(inputOrOutput) && this.isVolumeLevelValid(volume)) {
						this.emitConnectionStatusOK()
						this.deviceStatus.audioVolume[inputOrOutput] = volume
						return this.logFeedback(redeableMsg, `Audio volume for ${inputOrOutput} is ${volume}`)
					}
				}
			}

		} catch (ex) {
			console.log(ex)
		}

		this.myWarn('Unrecognized feedback message:' + redeableMsg)
	}

	emitConnectionStatusOK() {
		this.emit(this.EVENT_NAME_ON_CONNECTION_OK, [])
	}
}

module.exports.RGBLinkMiniConnector = RGBLinkMiniConnector
module.exports.SWITCH_MODE_AUTO = SWITCH_MODE_AUTO
module.exports.SWITCH_MODE_TBAR = SWITCH_MODE_TBAR
module.exports.PIP_LAYER_A = PIP_LAYER_A
module.exports.PIP_LAYER_B = PIP_LAYER_B
module.exports.PIP_MODE_OFF = PIP_MODE_OFF
module.exports.PIP_MODES = PIP_MODES
module.exports.SWITCH_EFFECT = SWITCH_EFFECT
module.exports.INPUT_SIGNAL_CHANNEL_HDMI = INPUT_SIGNAL_CHANNEL_HDMI
module.exports.INPUT_SIGNAL_CHANNEL_SDI = INPUT_SIGNAL_CHANNEL_SDI
module.exports.OUTPUT_PST_PREVIEW = OUTPUT_PST_PREVIEW
module.exports.OUTPUT_PGM_PROGRAM = OUTPUT_PGM_PROGRAM