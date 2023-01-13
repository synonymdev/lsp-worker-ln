const async = require('async')
const {find} = require('lodash')
const Node = require('./Node')
const { EventEmitter } = require('events')

class LightningManager extends EventEmitter {
  constructor (config) {
    super()
    this.config = config
  }

  start (cb) {
    if (this.config.nodes.length === 0) throw new Error('Nodes not set')
    this.nodes = this.config.nodes.map((node) => new Node(node))
    async.map(this.nodes, (node, next) => {
      node.start(next)
    }, (err) => {
      if (err) throw err
      this.setupNodes((err, data) => {
        if (err) throw err
        cb(null, this)
      })
    })
  }

  setupNodes (cb) {
    this.listenToEvents()
    cb()
  }

  listenToEvents () {

    this.getNode({all: true}).map(node => {
      const eventEmitter = this.subscribeToPaidInvoices(node)
      eventEmitter.on('invoice_paid', (invoice) => {
        console.log('config', this.config)
        this.config.events.invoice_paid.forEach((svc) => {
          this.emit('broadcast', { method: 'invoicePaid', args: [invoice], svc })
        })
      })
    })

    this.getNode({all:true}).map((node)=>{
      const event = this.subscribeToForwards(node)
      event.on('forward', (d) => {
        this.config.events.htlc_forward_event.forEach((svc) => {
          this.emit('broadcast', { method: 'newHtlcForward', args: [d], svc })
        })
      })

      const chanAcceptorSvc = this.config.events.channel_acceptor
      if (chanAcceptorSvc) {
        const chanAcceptor = this.subscribeToChannelRequests(node)
        // TODO: Multi node support
        console.log('Channel acceptor is listening: service: ' + chanAcceptorSvc)
        chanAcceptor.on('channel_request', (chan) => {
          console.log('New Channel Request:')
          console.log(`ID: ${chan.id}`)
          console.log(`Capacity: ${chan.capacity}`)
          console.log(`Remote Node: ${chan.partner_public_key}`)
          this.emit('broadcast', {
            method: 'newChannelRequest',
            args: chan,
            svc: chanAcceptorSvc,
            cb: (err, data) => {
              if (err) {
                console.log('CHANNEL_ACCEPTOR_ERROR: ', err)
                console.log('Rejecting channel', chan.id)
                return chan.reject()
              }
              if (data.accept) {
                console.log('Accepted channel', chan.id)
                chan.accept()
              } else {
                console.log('Rejected channel', chan.id, data.reason)
                chan.reject()
              }
            }
          })
        })
      }

      const peerSvc = this.config.events.peer_events
      if (peerSvc) {
        const peers = this.subscribeToPeers(node)
        peers.on('connected', (p) => {
          peerSvc.forEach((svc) => {
            this.emit('broadcast', { method: 'newPeerEvent', args: { event: 'connected', peer: p }, svc })
          })
        })

        peers.on('disconnected', (p) => {
          peerSvc.forEach((svc) => {
            this.emit('broadcast', { method: 'newPeerEvent', args: { event: 'disconnected', peer: p }, svc })
          })
        })
      }
      })

  }

  getOnChainBalance (node, args, cb) {
    return node.getOnChainBalance(args, cb)
  }

  getFeeRate (node, args, cb) {
   return node.getFeeRate(args, cb)
  }

  createInvoice (node, args, cb) {
   return node.createInvoice(args, cb)
  }

  createHodlInvoice (node, args, cb) {
   return node.createHodlInvoice(args, cb)
  }

  settleHodlInvoice (node, args, cb) {
   return node.settleHodlInvoice(args, cb)
  }

  cancelInvoice (node, args, cb) {
   return node.cancelInvoice(args, cb)
  }

  node (config, args, cb) {
   return node.decodePayReq(args, cb)
  }

  callAction(action,config, args,cb){
    const n = this.getNode(config)
    if(Array.isArray(n)){
      const result = n.reduce((prev,current)=>{
        prev[current.info._internal_node_name] = {
          node_public_key: current.info.public_key,
          data:[],
        }
        return prev
      },{})
      return async.forEach(n,(node,next)=>{
        this[action](node,args[0],(err,data)=>{
          if(err) return next(err)
          result[node.info._internal_node_name].data = data
          next(null)
        })
      },(err)=>{
        if(err) return cb(err)
        cb(null,result)
      })
    }
    return this[action](n,args[0],cb)
  }

  getNode (config) {
    if (config) {
      if(config.node_id){
        const n = this.nodes.filter((n) => {
          return n.info.pubkey === config.node_id || n.info.node_name === config.node_id
        })
        if (n.length !== 1) {
          throw new Error('Invalid node_id passed.')
        }
        return n.pop()
      }
      if(config.all){
        return this.nodes
      }
    }
    return this.nodes[0]
  }

  pay (node, args, cb) {
   node.pay(args, cb)
  }

  getInfo (node, args, cb) {
   node.getInfo(args, cb)
  }

  getInvoice (node, args, cb) {
   node.getInvoice(args, cb)
  }

  listInvoices (node, args, cb) {
   node.listInvoices(args, cb)
  }

  listPayments (node, args, cb) {
   node.listPayments(args, cb)
  }

  getPayment (node, args, cb) {
   node.getPayment(args, cb)
  }

  getSettledPayment (node, args, cb) {
   node.getSettledPayment(args, cb)
  }

  subscribeToInvoices (node) {
    return node.subscribeToInvoices()
  }

  subscribeToPaidInvoices (node) {
    return node.subscribeToPaidInvoices()
  }

  subscribeToPayments (node) {
    return node.subscribeToPayments()
  }

  subscribeToForwards (node) {
    return node.subscribeToForwards()
  }

  subscribeToChannelRequests (node) {
    return node.subscribeToChannelRequests()
  }

  subscribeToPeers (node) {
    return node.subscribeToPeers()
  }

  subscribeToTopology (node) {
    return node.subscribeToTopology()
  }

  getNetworkGraph (node, args, cb) {
    return node.getNetworkGraph(args, cb)
  }

  listChannels (node, args, cb) {
    return new Promise((resolve, reject) => {
      node.listChannels(args, (err, data) => {
        if (err) return cb ? cb(err) : reject(err)
        if (args && args.remote_node) {
          data = data.filter((ch) => {
            return ch.partner_public_key === args.remote_node
          })
        }
        cb ? cb(null, data) : resolve(data)
      })
    })
  }

  listPeers (node, args, cb) {
    return node.listPeers(args, cb)
  }

  listClosedChannels (node, args, cb) {
    return node.listClosedChannels(args, cb)
  }

  getChannel (node, args, cb) {
    return node.getChannel(args, cb)
  }

  openChannel (node, args, cb) {
    return node.openChannel(args, cb)
  }

  closeChannel (node, args, cb) {
    return node.closeChannel(args, cb)
  }

  addPeer (node, args, cb) {
    return node.addPeer(args, cb)
  }

  getForwards(node,args,cb){
    return node.getForwards(args, cb)
  }

  updateRoutingFees (node, args, cb) {
    return node.updateRoutingFees(args, (err, data) => {
      if (err) {
        return cb(err)
      }
      if (data.failures && data.failures.length > 0) {
        return cb(data.failures)
      }
      cb(null, data)
    })
  }

  getChannelBalance(node,args,cb){
    return node.getChannelBalance(args, cb)
  }

  getChainBalance(node,args,cb){
    return node.getChainBalance(args, cb)
  }

  getPendingChainBalance(node,args,cb){
    return node.getPendingChainBalance(args, cb)
  }

  getNodeOfClosedChannel(node,args,cb){
    let nodeChan = null
    async.eachSeries(this.nodes,(n, next)=>{
      if(nodeChan) return next()
      n.listClosedChannels({},(err,data)=>{
        if(err) return next(err)
        nodeChan = find(data,{id: args.channel_id},null)
        next()
      })
    },(err,data)=>{
      if(err) return cb(err)
      if(!nodeChan) return cb(null, null)
      cb(null,{
        public_key: nodeChan.partner_public_key,
      })
    })
  }
}

module.exports = LightningManager
