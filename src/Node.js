'use strict'
const LND = require('./LND')

class LightningNode {
  constructor (config) {
    this.config = config
    this.setNode()
    this.info = {}
  }

  setNode () {
    if (this.config.node_type === 'LND') {
      this.node = new LND(this.config)
      return
    }

    throw new Error('Invalid node_type')
  }

  start (cb) {
    this.getInfo((err, data) => {
      if (err) throw err
      this.info = {
        node_name: this.config.node_name,
        pubkey: data.public_key,
        ...data
      }
      cb(null, data)
    })
  }

  getInfo (args, cb) {
    if (typeof args === 'function') cb = args
    this.node.getInfo(cb)
  }

  getInvoice (args, cb) {
    this.node.getInvoice(args, cb)
  }

  getFeeRate (args, cb) {
    this.node.getFeeRate(args, cb)
  }

  getOnChainBalance (args, cb) {
    this.node.getOnChainBalance(args, cb)
  }

  createInvoice ({ memo, expiry, amount }, cb) {
    this.node.createInvoice({
      memo, expiry, amount
    }, (err, data) => {
      if (err) throw err
      data.node_pub_key = this.info.public_key
      cb(err, data)
    })
  }

  createHodlInvoice ({ memo, expiry, amount }, cb) {
    this.node.createHodlInvoice({
      memo, expiry, amount
    }, (err, data) => {
      if (err) throw err
      data.node_pub_key = this.info.pubkey
      cb(err, data)
    })
  }

  cancelInvoice (args, cb) {
    this.node.cancelInvoice(args, cb)
  }

  settleHodlInvoice ({ secret }, cb) {
    this.node.settleHodlInvoice({ secret }, cb)
  }

  decodePayReq (payReq, cb) {
    this.node.decodePaymentRequest({
      request: payReq
    }, cb)
  }

  pay ({ invoice }, cb) {
    this.node.pay(invoice, cb)
  }

  getForwards(args,cb){
    this.node.getForwards(args,cb)    
  }

  getPayment (args, cb) {
    this.node.getPayment(args, cb)
  }

  getSettledPayment (args, cb) {
    this.node.getPayment(args, cb)
  }

  subscribeToInvoices () {
    return this.node.subscribeToInvoices()
  }

  subscribeToPaidInvoices () {
    return this.node.subscribeToPaidInvoices()
  }

  subscribeToPayments () {
    return this.node.subscribeToPayments()
  }

  subscribeToForwards () {
    return this.node.subscribeToForwards()
  }

  subscribeToChannelRequests () {
    return this.node.subscribeToChannelRequests()
  }

  subscribeToPeers () {
    return this.node.subscribeToPeers()
  }

  subscribeToTopology () {
    return this.node.subscribeToGraph()
  }

  getNetworkGraph (args, cb) {
    return this.node.getNetworkGraph(args, cb)
  }

  openChannel (args, cb) {
    return this.node.openChannel(args, cb)
  }

  closeChannel (args, cb) {
    return this.node.closeChannel(args, cb)
  }

  listChannels (args, cb) {
    return this.node.listChannels(args, cb)
  }

  listPeers (args, cb) {
    return this.node.listPeers(args, cb)
  }

  listClosedChannels (args, cb) {
    return this.node.listClosedChannels(args, cb)
  }

  getChannel (args, cb) {
    return this.node.getChannel(args, cb)
  }

  addPeer (args, cb) {
    return this.node.addPeer(args, cb)
  }

  updateRoutingFees (args, cb) {
    return this.node.updateRoutingFees(args, cb)
  }

  listInvoices (args, cb) {
    return this.node.getInvoices(args, cb)
  }

  listPayments (args, cb) {
    return this.node.listPayments(args, cb)
  }

  getChannelBalance(args,cb){
    return this.node.getChannelBalance(args, cb)
  }

  getChainBalance(args,cb){
    return this.node.getChainBalance(args, cb)
  }

  getPendingChainBalance(args,cb){
    return this.node.getPendingChainBalance(args, cb)
  }
}

module.exports = LightningNode
