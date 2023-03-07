'use strict'
const { Worker } = require('blocktank-worker')
const NodeMan = require('./NodeMan')
const fs = require("fs")
const path = require("path")
const privates = [
  'constructor'
]

class Lightning extends Worker {
  constructor (config) {
    super({
      name: 'svc:ln',
      port: config.port,
      db_url: 'mongodb://0.0.0.0:27017'
    })
    let lnConfig = {}
    if(config?.ln_nodes){
      lnConfig.ln_nodes = config.ln_nodes
      lnConfig.events ? lnConfig.events : {
        htlc_forward_event: [],
        channel_acceptor: [],
        peer_events: [],
        invoice_paid_events: [],
      }
    } else {
      lnConfig = this._getConfig()
    }

    this.ln = new NodeMan(
      {
        nodes: lnConfig.ln_nodes,
        events: {
          htlc_forward_event: lnConfig.htlc_forward_event,
          channel_acceptor: lnConfig.channel_acceptor,
          peer_events: lnConfig.peer_events,
          invoice_paid_events: lnConfig.invoice_paid_events
        }
      })

    this.ln.on('broadcast', ({ svc, method, args, cb }) => {
      this.callWorker(svc, method, args, cb)
    })
  }

  _getConfig(){
    try{
      return JSON.parse(fs.readFileSync(path.resolve(__dirname,'../config/worker.config.json'),{encoding:"utf8"}))
    } catch(err){
        console.log(err) 
      return this.errRes("FAILED_TO_LOAD_CONFIG")
    }
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
      args = [args]
    } else if (args.length === 1) {
      args = [args[0]]
    }
    this.ln.callAction(action,config,args,cb)
  }
}

module.exports = Lightning
