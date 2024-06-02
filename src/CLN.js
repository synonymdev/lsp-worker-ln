
const request = require('request')
const { EventEmitter } = require('events')
const uuid = require('uuid/v4')
const async = require('async')
const WebSocket = require('ws')
const BN = require('bignumber.js')

const MAX_FEE_PCNT = 5

class CLightning {
  constructor (config) {
    this.config = config
  }

  msatToSat (msat) {
    return new BN(msat).div(1000).dp(0, new BN().ROUND_FLOOR).toNumber()
  }

  satToMsat (sat) {
    return new BN(sat).times(1000).dp(0, new BN().ROUND_FLOOR).toNumber()
  }

  _api (method, key, arg, cb) {
    request[method](this.config.socket + '/v1/' + key, {
      headers: {
        macaroon: this.config.password.toString()
      },
      form: arg.form,
      rejectUnauthorized: false,
      requestCert: true,
      agent: false,
      qs: arg.qs
    }, (err, res, body) => {
      if (err) {
        console.log('API Error')
        console.log(err)
        return cb(err)
      }
      cb(null, JSON.parse(body))
    })
  }

  getWalletInfo (arg, cb) {
    async.auto({
      info: (next) => this._api('get', 'getinfo', [], next),
      channels: (next) => this._api('get', 'channel/listchannels', [], next),
      peers: (next) => this._api('get', 'peer/listPeers', [], next)
    }, (err, res) => {
      if (err) return cb(err)
      const { info, peers, channels } = res
      cb(null, {
        public_key: info.id,
        uris: info.address,
        alias: info.alias,
        peers_count: peers.length,
        active_channels_count: channels.length
      })
    })
  }

  getPayment (arg, cb) {
    this._api('get', 'pay/listPayments', {
      qs: { invoice: arg.id }
    }, (err, res) => {
      if (err) return cb(err)
      const data = res.payments
      if (data.length !== 1) {
        return cb(new Error('INVALID_PAYMENT_ID: ' + arg.id))
      }
      const pay = data.pop()
      pay._cln_id = pay.id
      pay.id = pay.bolt11
      cb(null, {
        payment: pay,
        is_failed: pay.status === 'failed',
        is_confirmed: pay.status === 'complete',
        is_pending: pay.status === 'pending'
      })
    })
  }

  getChannels (arg, cb) {
    this._api('get', 'channel/listChannels', [], (err, data) => {
      if (err) return cb(err)
      const filter = data.map((p) => {
        return {
          id: p.channel_id,
          is_private: p.private,
          partner_public_key: p.id,
          local_balance: this.msatToSat(p.msatoshi_to_them),
          remote_balance: this.msatToSat(p.msatoshi_to_us),
          public: !p.private,
          is_active: p.connected && p.state === 'CHANNELD_NORMAL'
        }
      })
      cb(null, { channels: filter })
    })
  }

  createInvoice ({ description, tokens, expiry_seconds }, cb) {
    const internalId = uuid()
    this._api('post', 'invoice/genInvoice', {
      form: {
        description,
        label: internalId,
        amount: this.satToMsat(tokens),
        expiry: expiry_seconds
      }
    }, (err, data) => {
      if (err) return cb(err)
      if (data.error) return cb(new Error(`C-Lightning: ${data.error.message}`))
      cb(null, {
        id: data.payment_hash,
        internal_id: internalId,
        request: data.bolt11
      })
    })
  }

  _formatInvoice (data) {
    return {
      id: data.payment_hash,
      request: data.bolt11,
      description: data.description,
      tokens: this.msatToSat(data.msatoshi),
      created_at: null,
      expiry: new Date(data.expires_at * 100).getTime(),
      is_confirmed: data.status === 'paid' && data.payment_preimage && data.pay_index > 0 && data.paid_at > 0,
      confirmed_at: data.status === 'paid' ? new Date(data.paid_at * 1000).getTime() : 0
    }
  }

  getInvoice (arg, cb) {
    this._api('get', 'invoice/listinvoices', {
      qs: { label: arg.id }
    }, (err, data) => {
      if (err) return cb(err)
      if (data.invoices.length !== 1) return cb(new Error('INVALID_INVOICE'))
      cb(null, this._formatInvoice(data.invoices[0]))
    })
  }

  getInvoices (args, cb) {
    this._api('get', 'invoice/listinvoices', {}, (err, data) => {
      if (err) return cb(err)
      const invoices = data.invoices.map((invoice) => {
        return this._formatInvoice(invoice)
      })
      cb(null, { invoices, next: null })
    })
  }

  decodePaymentRequest (arg, cb) {
    this._api('get', 'pay/decodePay/' + arg.request, {}, (err, data) => {
      if (err) return cb(err)
      cb(null, {
        destination: data.payee,
        description: data.description,
        is_expired: data.created_at + data.expiry < Math.floor(Date.now() / 1000),
        tokens: this.msatToSat(data.msatoshi),
        created_at: new Date(data.created_at * 1000),
        expires_at: (data.created_at + data.expiry) * 1000
      })
    })
  }

  payViaPaymentRequest (arg, cb) {
    this._api('post', 'pay', {
      form: {
        invoice: arg.request,
        maxfeepercent: MAX_FEE_PCNT
      }
    }, (err, data) => {
      if (err) return cb(err)

      if (data.error && data.error.message.includes('WIRE_INCORRECT_OR_UNKNOWN_PAYMENT_DETAILS')) {
        return cb(null, {
          secret: null,
          hops: []
        })
      }

      // We mark pending payments as succesful

      cb(null, {
        id: arg.request,
        secret: data.status === 'pending' ? 'PENDING' : data.payment_preimage,
        hops: ['UNSUPPORTED'],
        is_confirmed: data.status === 'complete' && data.status === 'pending',
        is_failed: data.status === 'failed'
      })
    })
  }

  subscribeToInvoices () {
    const event = new EventEmitter()
    const ws = new WebSocket(this.config.websocket)

    ws.on('open', () => {
      console.log('Connected to C-Lightning Wesocket feed')
    })

    ws.on('message', (data) => {
      const msg = JSON.parse(data)
      if (msg.invoice_payment) {
        this.getInvoice({ id: msg.invoice_payment.label }, (err, data) => {
          if (err) {
            console.error(data)
            throw new Error(err)
          }
          event.emit('invoice_updated', data)
        })
      }
    })

    ws.on('error', (data) => {
      console.error(data)
      event.emit('error', data)
    })

    ws.on('close', () => {
      console.error('Websocket closed')
      event.emit('error', 'Websocket closed to C-Lightning')
    })

    return event
  }

  subscribeToChannels () {
    return new EventEmitter()
  }
}

module.exports = CLightning
