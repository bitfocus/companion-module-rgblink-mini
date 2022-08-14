const RGBLinkApiConnector = require('./rgblinkapiconnector')

const SWITCH_MODE_AUTO = 0
const SWITCH_MODE_TBAR = 1

const PIP_LAYER_A = 0
const PIP_LAYER_B = 1

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
	}

	constructor(host, port, debug, polling) {
		super(host, port, debug, polling)
		var self = this

		this.on(this.EVENT_NAME_ON_DATA_API_NOT_STANDARD_LENGTH, (message, metadata) => {
			if (metadata.size == 22) {
				self.consume22(message)
				this.emit(this.EVENT_NAME_ON_DEVICE_STATE_CHANGED, [])
			} else {
				//self.status(this.STATUS_WARNING, "Unknown message length:" + metadata.size)
			}
		})

		this.on(this.EVENT_NAME_ON_DATA_API, (ADDR, SN, CMD, DAT1, DAT2, DAT3, DAT4) => {
			self.consumeFeedback(ADDR, SN, CMD, DAT1, DAT2, DAT3, DAT4)
			this.emit(this.EVENT_NAME_ON_DEVICE_STATE_CHANGED, [])
		})
	}

	sendConnectMessage() {
		this.sendCommand('68', '66', '01' /*Connect*/, '00', '00')
	}

	sendDisconnectMessage() {
		this.sendCommand('68', '66', '00' /*Disconnect*/, '00', '00')
	}

	askAboutStatus() {
		this.sendCommand('78', '13', '00', '00', '00') // asking about switch setting
		this.sendCommand('75', '1F', '00', '00', '00') // asking about PIP mode
		this.sendCommand('78', '07', '00', '00', '00') // asking about switch effect
		this.sendCommand('75', '1B', '00', '00', '00') // asking about PIP layer (A or B)
		this.sendCommand('F1', '40', '01', '00', '00') // asking about special status 22
		//<T00c3f103000000b7> // special status2
	}

	sendSwitchModeMessage(mode) {
		if (mode == SWITCH_MODE_AUTO || mode == SWITCH_MODE_TBAR) {
			let modeHex = this.byteToTwoSignHex(mode)
			this.sendCommand('78', '12', modeHex, '00', '00')
		} else {
			this.debug('Unknown mode ' + mode)
		}
	}

	sendSwitchToSourceMessage(source) {
		if (source >= 1 && source <= 4) {
			let sourceHex = this.byteToTwoSignHex(source - 1)
			this.sendCommand('75', '02', '00', sourceHex, '00')
		} else {
			this.debug('Bad source:' + source)
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
			this.debug('Bad layer id:' + layer)
			return
		}
		this.sendCommand('75', '1A' /*Write*/, '00', layerCode, '00')
	}

	sendBuildPipMessages(mode /*T-BAR - preview / Auto - live output */, pipMode, sourceOnLayerA, sourceOnLayerB) {
		if (mode == SWITCH_MODE_AUTO || mode == SWITCH_MODE_TBAR) {
			this.sendSwitchModeMessage(mode)
		} else {
			this.debug('Bad mode:' + mode)
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

	consumeFeedback(ADDR, SN, CMD, DAT1, DAT2, DAT3, DAT4) {
		let redeableMsg = [ADDR, SN, CMD, DAT1, DAT2, DAT3, DAT4].join(' ')

		let importantPart = CMD + DAT1 + DAT2 + DAT3 + DAT4
		if ('F140011600' == importantPart) {
			// readed status, it's ok
			this.emitConnectionStatusOK()
			return this.logFeedback(redeableMsg, 'Status readed')
		} else if (CMD == 'A2' && DAT1 == '18') {
			// t-bar position update
			this.emitConnectionStatusOK()
			return this.logFeedback(redeableMsg, 'T-BAR position changed')
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
		} else if (CMD == '75') {
			// 0x75 Read/write video processor information
			if (DAT1 == '02' || DAT1 == '03') {
				// Signal source switching Settings
				// 0x02(Write), 0x03(Read)
				let src = parseInt(DAT3) + 1
				if (src >= 1 && src <= 4) {
					this.emitConnectionStatusOK()
					this.deviceStatus.liveSource = src
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
			}
		}

		this.debug('Unrecognized feedback message:' + redeableMsg)
	}

	logFeedback(redeableMsg, info) {
		this.debug('Feedback:' + redeableMsg + ' ' + info)
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
module.exports.PIP_MODES = PIP_MODES
module.exports.SWITCH_EFFECT = SWITCH_EFFECT
