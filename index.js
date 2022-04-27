'use strict'
const NodeMan = require('./src/NodeMan')

module.exports = function BlocktankNodeManager (lnConfig) {
  return new NodeMan(
    {
      nodes: lnConfig.ln_nodes,
      events: {
        htlc_forward_event: lnConfig.htlc_forward_event,
        channel_acceptor: lnConfig.channel_acceptor,
        peer_events: lnConfig.peer_events
      }
    })
}
