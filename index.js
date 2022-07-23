/*
TODO
* sprawdzanie połaczneia na początku - OK pokazuje się, nawet gdy urządzenie niepodłączone do prądu
* konfitguracja akcji - select source
* feedbacki
* inne akcje (np pip)
* przetestować feedbacki do pip
* presets
*/

const udp = require('../../udp')
const instance_skel = require('../../instance_skel')

class instance extends instance_skel {

	swtichToSourceMsg = {
		'0' : '<T0000750200000077>',
		'1' : '<T0000750200010078>',
		'2' : '<T0000750200020079>',
		'3' : '<T000075020003007A>'
	};

	constructor(system, id, config) {
		super(system, id, config)
		console.log('RGBlink mini: constructor');
		this.initActions()
	}

	config_fields() {
		console.log('RGBlink mini: config_fields');
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
		console.log('RGBlink mini: destroy');
		if (this.socket !== undefined) {
			this.socket.destroy()
		}

		this.debug('destroy', this.id)
	}

	init() {
		console.log('RGBlink mini: init');
		this.initUDPConnection()
		this.initFeedbacks();

	}

	initActions() {
		console.log('RGBlink mini: initActions');
		let actions = {}

		actions['switch_to_source'] = {
			label: 'Switch to signal source',
			options: [
				{
					type: 'dropdown',
					label: 'Source number',
					id: 'sourceNumber',
					default: '0',
					tooltip: 'Choose source number, which should be selected',
					choices: [
					  { id: '0', label: '1' },
					  { id: '1', label: '2' },
					  { id: '2', label: '3' },
					  { id: '3', label: '4' }
					],
					minChoicesForSearch: 0
				},
			],
			callback: (action, bank) => {
				console.log('onAction');
				this.sendCommand(this.swtichToSourceMsg[action.options.sourceNumber]);
			},
		}

		this.setActions(actions)
	}

	initUDPConnection() {
		console.log('RGBlink mini: initUDPConnection');
		console.log(this.socket);
		console.log(this.config);
		if (this.socket !== undefined) {
			this.socket.destroy()
			delete this.socket
		}

		if (this.config.port === undefined) {
			this.config.port = 1000
		}

		this.status(this.STATUS_WARNING, 'Connecting')

		if (this.config.host) {
			console.log('RGBlink mini: initializing....');
			this.socket = new udp(this.config.host, this.config.port)
			console.log(this.socket);
			this.socket.on('status_change', (status, message) => {
				console.log('RGBlink mini: initUDPConnection status_change:' + status + ' ' + message);
				this.status(status, message)
			})

			this.socket.on('error', (err) => {
				console.log('RGBlink mini: initUDPConnection error');
				this.debug('Network error', err)
				this.log('error', 'Network error: ' + err.message)
			})

			this.socket.on('data', (message, metadata) => {
				console.log('RGBlink mini: initUDPConnection data');
				console.log(message);
				console.log(metadata);

				if(metadata.size !== 19){
					this.status(this.STATUS_WARNING, 'Feedback length != 19')
					return;
				}

				if(metadata.address != this.config.host || metadata.port != this.config.port ){
					this.status(this.STATUS_WARNING, 'Feedback received from different sender ' + metadata.address + ":" + metadata.port)
					return;
				}

				console.log(message.toString('utf8'))

				this.status(this.STATUS_OK)
			})

			//this.sendCommand('<T0000750200010078>'); //Switch to signal source 2
			//this.sendCommand('<T0000750200020079>'); //Switch to signal source 3
			//this.sendCommand('<T000075020003007A>'); //Switch to signal source 4

		}
	}

	sendCommand(cmd) {
		console.log('RGBlink mini: sendCommand');
		//console.log(this.socket.connected);
		console.log(cmd);
		if (cmd !== undefined && cmd != '') {
			if (this.socket !== undefined /*&& this.socket.connected*/) {
				this.socket.send(cmd)
				//console.log(this.socket);
			}
		}
	}

	updateConfig(config) {
		console.log('RGBlink mini: updateConfig');
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
		console.log('RGBlink mini: feedback:' + feedback + " bank:" + bank);
	}

	initFeedbacks() {
		var self = this
		var feedbacks = {}

		feedbacks['playStatus'] = {
			label: 'Change colors based on Play/Pause status',
			description: 'Change colors based on Play/Pause status',
			options: [
				{
					type: 'colorpicker',
					label: 'Foreground color',
					id: 'fg',
					default: self.rgb(255, 255, 255)
				},
				{
					type: 'colorpicker',
					label: 'Background color',
					id: 'bg',
					default: self.rgb(0, 255, 0)
				},
				{
					type: 'dropdown',
					label: 'Status',
					id: 'playPause',
					default: 'Playing',
					choices: [
						{ id: 'Playing', label: 'Playing' },
						{ id: 'Paused', label: 'Paused' }
					]
				}
			]
		}
		self.setFeedbackDefinitions(feedbacks)
	}
}

exports = module.exports = instance

//const feedbacks = {}
// feedbacks['set_source'] = {
//     type: 'boolean', // Feedbacks can either a simple boolean, or can be an 'advanced' style change (until recently, all feedbacks were 'advanced')
//     label: 'Brief description of the feedback here',
//     description: 'Longer description of the feedback',
//     style: {
//         // The default style change for a boolean feedback
//         // The user will be able to customise these values as well as the fields that will be changed
//         color: self.rgb(0, 0, 0),
//         bgcolor: self.rgb(255, 0, 0)
//     },
//     // options is how the user can choose the condition the feedback activates for
//     options: [{
//         type: 'number',
//         label: 'Source',
//         id: 'source',
//         default: 1
//     }],
//     callback: function (feedback) {
// 		console.log('feedbacK:' + feedback)
//         // This callback will be called whenever companion wants to check if this feedback is 'active' and should affect the button style
//         if (self.some_device_state.source == options.source) {
// 			return true
// 		} else {
//             return false
//         }
//     }
// }
// self.setFeedbackDefinitions(feedbacks);