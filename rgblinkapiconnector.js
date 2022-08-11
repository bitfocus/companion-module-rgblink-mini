// version 1.0

const UDPSocket = require('../../udp')

class RGBLinkApiConnector {
    debug
    socket = new UDPSocket()
    eventsListeners = []
    EVENT_NAME_ON_DATA = 'on_data'
    EVENT_NAME_ON_STATUS_CHANGE = 'on_status_change'

    constructor(host, port, debug) {
        this.debug = debug
        if (host) {
            this.createSocket(host, port)
        }
    }

    createSocket(host, port) {
        this.debug('RGBLinkApiConnector: creating socket ' + host + ':' + port + '...')

        if (this.socket !== undefined) {
            this.socket.destroy()
            delete this.socket
        }

        if (host) {
            this.socket = new UDPSocket(host, port)
            this.socket.on('status_change', (status, message) => {
                this.debug('RGBLinkApiConnector: udp status_change:' + status + ' ' + message)
            })

            this.socket.on('error', (err) => {
                this.debug('RGBLinkApiConnector: udp error:' + err)
            })

            this.socket.on('data', (message, metadata) => {
                this.emit(this.EVENT_NAME_ON_DATA, [message, metadata])
            })
        }

    }

    onDestroy() {
        if (this.socket !== undefined) {
            this.socket.destroy()
        }
    }

    on = function (event, listener) {
        if (typeof this.eventsListeners[event] !== 'object') {
            this.eventsListeners[event] = [];
        }
        this.eventsListeners[event].push(listener)
    }

    emit = function (event, args) {
        let listeners = this.eventsListeners[event].slice();
        for (var i = 0; i < listeners.length; i++) {
            listeners[i].apply(this, args)
        }
    }

    sendCommand(cmd) {
        try {
            if (cmd !== undefined && cmd != '') {
                if (this.socket !== undefined) {
                    this.socket.send(cmd)
                } else {
                    this.debug("Can't send command, socket undefined!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
                }
            }
        } catch (ex) {
            this.debug("error")
            this.debug(ex)
        }
    }

}

module.exports = RGBLinkApiConnector  