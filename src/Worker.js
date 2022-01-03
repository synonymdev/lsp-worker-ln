'use strict'
const { Worker } = require('blocktank-worker')
const NodeMan = require('./NodeMan')
const lnConfig = require('../config/worker.config.json')
const privates = [
  'constructor'
]

class Lightning extends Worker {
  constructor (config) {
    super({
      name: 'svc:ln',
      port: 5812,
      db_url: 'mongodb://localhost:27017'
    })
    this.ln = new NodeMan({ nodes: lnConfig.ln_nodes })
  }

  start () {
    this.ln.start(() => {
      Object.getOwnPropertyNames(Object.getPrototypeOf(this.ln))
        .filter((n) => !privates.includes(n.toLowerCase()))
        .forEach((n) => {
          this[n] = this._handler.bind(this, n)
        })
    })
  }

  _handler (action, config, arg1, arg2) {
    let cb, args
    if (arg2) {
      cb = arg2
      args = arg1
    } else {
      cb = arg1
      args = config
    }
    if (!args || !Array.isArray(args)) {
      args = [{}, args]
    } else if (args.length === 1) {
      args = [{}, args[0]]
    }
    args.push(cb)
    this.ln[action].apply(this.ln, args)
  }
}

module.exports = Lightning
