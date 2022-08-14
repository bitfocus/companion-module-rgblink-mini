const RGBLinkApiConnector = require('./rgblinkapiconnector')

const SWITCH_MODE_AUTO = 0
const SWITCH_MODE_TBAR = 1

const PIP_LAYER_A = 0
const PIP_LAYER_B = 1

class RGBLinkMiniConnector extends RGBLinkApiConnector {
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
}

module.exports.RGBLinkMiniConnector = RGBLinkMiniConnector
module.exports.SWITCH_MODE_AUTO = SWITCH_MODE_AUTO
module.exports.SWITCH_MODE_TBAR = SWITCH_MODE_TBAR
module.exports.PIP_LAYER_A = PIP_LAYER_A
module.exports.PIP_LAYER_B = PIP_LAYER_B
