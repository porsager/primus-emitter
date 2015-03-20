module.exports = function emitter() {
  'use strict';

  /**
   * Event packets.
   */

  var packets = {
    EVENT:  0,
    ACK:    1
  };

  /**
   * Initialize a new `Emitter`.
   *
   * @param {Primus|Spark} conn
   * @return {Emitter} `Emitter` instance
   * @api public
   */

  function Emitter(conn) {
    if (!(this instanceof Emitter)) return new Emitter(conn);
    this.ids = 1;
    this.acks = {};
    this.conn = conn;
    if (this.conn) this.bind();
  }

  /**
   * Bind `Emitter` events.
   *
   * @return {Emitter} self
   * @api private
   */

  Emitter.prototype.bind = function bind() {
    var em = this;
    this.conn.on('data', function ondata(data) {
      em.ondata.call(em, data);
    });
    return this;
  };

  /**
   * Called with incoming transport data.
   *
   * @param {Object} packet
   * @return {Emitter} self
   * @api private
   */

  Emitter.prototype.ondata = function ondata(packet) {
    switch (packet.type) {
    case packets.EVENT:
      this.onevent(packet);
      break;
    case packets.ACK:
      this.onack(packet);
      break;
    }
  };

  /**
   * Send a message to client.
   *
   * @return {Emitter} self
   * @api public
   */

  Emitter.prototype.send = function send(name, data, fn) {
    if(!arguments.length)
      return;

    var packet = { type: packets.EVENT, name: name };

    fn = arguments[arguments.length - 1];

    if (typeof fn === 'function') {
      var id = this.ids++;
      if (this.acks) {
        this.acks[id] = fn
        packet.id = id;
      }
    }

    if((!packet.id && arguments.length === 2) || arguments.length === 3) {
      packet.data = data;
    }

    this.conn.write(packet);
    return this;
  };

  /**
   * Called upon event packet.
   *
   * @param {Object} packet object
   * @return {Emitter} self
   * @api private
   */

  Emitter.prototype.onevent = function onevent(packet) {
    var args = [packet.name, packet.data || null];
    if(packet.id) {
      args.push(this.ack(packet.id));
    }
    if (this.conn.reserved(packet.name)) return this;
    this.conn.emit.apply(this.conn, args);
    return this;
  };

  /**
   * Produces an ack callback to emit with an event.
   *
   * @param {Number} packet id
   * @return {Function}
   * @api private
   */

  Emitter.prototype.ack = function ack(id, name, data) {
    var conn = this.conn;
    var sent = false;
    return function () {
      if (sent) return; // prevent double callbacks
      sent = true;
      conn.write({
        id: id,
        type: packets.ACK,
        name: name,
        data: data
      });
    };
  };

  /**
   * Called upon ack packet.
   *
   * @param {Object} packet object
   * @return {Emitter} self
   * @api private
   */

  Emitter.prototype.onack = function onack(packet) {
    var ack = this.acks[packet.id];
    if ('function' === typeof ack) {
      ack.call(this, packet.name, packet.data);
      delete this.acks[packet.id];
    } else {
      console.log('bad ack %s', packet.id);
    }
    return this;
  };

  // Expose packets
  Emitter.packets = packets;

  return Emitter;
};
