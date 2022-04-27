const async = require('async')
const Node = require('./Node')
const { EventEmitter } = require('events')

class LightningManager extends EventEmitter {
  constructor (config) {
    super()
    this.config = config
    this.setNode()
  }

  setNode () {
    this.nodes = this.config.nodes
      .map((node) => new Node(node))
  }

  start (cb) {
    if (this.nodes.length === 0) throw new Error('Nodes not set')
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
    const event = this.subscribeToForwards({})
    event.on('forward', (d) => {
      this.config.events.htlc_forward_event.forEach((svc) => {
        this.emit('broadcast', { method: 'newHtlcForward', args: [d], svc })
      })
    })

    const chanAcceptorSvc = this.config.events.channel_acceptor
    if (chanAcceptorSvc) {
      const chanAcceptor = this.subscribeToChannelRequests({})
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
      const peers = this.subscribeToPeers()
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
  }

  getOnChainBalance (config, args, cb) {
    this.getNode(config).getOnChainBalance(args, cb)
  }

  getFeeRate (config, args, cb) {
    this.getNode(config).getFeeRate(args, cb)
  }

  createInvoice (config, args, cb) {
    this.getNode(config).createInvoice(args, cb)
  }

  createHodlInvoice (config, args, cb) {
    this.getNode(config).createHodlInvoice(args, cb)
  }

  settleHodlInvoice (config, args, cb) {
    this.getNode(config).settleHodlInvoice(args, cb)
  }

  cancelInvoice (config, args, cb) {
    this.getNode(config).cancelInvoice(args, cb)
  }

  decodePaymentRequest (config, args, cb) {
    this.getNode(config).decodePayReq(args, cb)
  }

  getNode (config) {
    if (config && config.node_id) {
      const n = this.nodes.filter((n) => {
        return n.info.pubkey === config.node_id
      })
      if (n.length !== 1) {
        throw new Error('Invalid node_id passed.')
      }
      return n.pop()
    }
    return this.nodes[0]
  }

  pay (config, args, cb) {
    this.getNode(config).pay(args, cb)
  }

  getInfo (config, args, cb) {
    this.getNode(config).getInfo(args, cb)
  }

  getInvoice (config, args, cb) {
    this.getNode(config).getInvoice(args, cb)
  }

  listInvoices (config, args, cb) {
    this.getNode(config).listInvoices(args, cb)
  }

  listPayments (config, args, cb) {
    this.getNode(config).listPayments(args, cb)
  }

  getPayment (config, args, cb) {
    this.getNode(config).getPayment(args, cb)
  }

  getSettledPayment (config, args, cb) {
    this.getNode(config).getSettledPayment(args, cb)
  }

  subscribeToInvoices (config) {
    return this.getNode(config).subscribeToInvoices()
  }

  subscribeToPaidInvoices (config) {
    return this.getNode(config).subscribeToPaidInvoices()
  }

  subscribeToPayments (config) {
    return this.getNode(config).subscribeToPayments()
  }

  subscribeToForwards (config) {
    return this.getNode(config).subscribeToForwards()
  }

  subscribeToChannelRequests (config) {
    return this.getNode(config).subscribeToChannelRequests()
  }

  subscribeToPeers (config) {
    return this.getNode(config).subscribeToPeers()
  }

  subscribeToTopology (config) {
    return this.getNode(config).subscribeToTopology()
  }

  getNetworkGraph (config, args, cb) {
    return this.getNode(config).getNetworkGraph(args, cb)
  }

  listChannels (config, args, cb) {
    return new Promise((resolve, reject) => {
      this.getNode(config).listChannels(args, (err, data) => {
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

  listPeers (config, args, cb) {
    return this.getNode(config).listPeers(args, cb)
  }

  listClosedChannels (config, args, cb) {
    return this.getNode(config).listClosedChannels(args, cb)
  }

  getChannel (config, args, cb) {
    return this.getNode(config).getChannel(args, cb)
  }

  openChannel (config, args, cb) {
    return this.getNode(config).openChannel(args, cb)
  }

  closeChannel (config, args, cb) {
    return this.getNode(config).closeChannel(args, cb)
  }

  addPeer (config, args, cb) {
    return this.getNode(config).addPeer(args, cb)
  }

  updateRoutingFees (config, args, cb) {
    return this.getNode(config).updateRoutingFees(args, (err, data) => {
      if (err) {
        return cb(err)
      }
      if (data.failures && data.failures.length > 0) {
        return cb(data.failures)
      }
      cb(null, data)
    })
  }
}

module.exports = LightningManager
