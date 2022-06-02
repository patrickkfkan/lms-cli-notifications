const { EventEmitter } = require('eventemitter3');
const { Telnet } = require('telnet-client');
const { CommandQueue } = require('./CommandQueue');
const { ERR_AUTH_FAILURE, ERR_SEND_CMD_FAILURE, ERR_CMD_RESP_TIMEOUT } = require('./constants');

const DEFAULT_PARAMS = {
  server: {
    host: '127.0.0.1',
    port: '9090'
  },
  subscribe: []
};

class NotificationListener {
  constructor(params) {
    const _params = this._sanitizeParams(params);
    this.server = _params.server;
    this.client = null;
    this.commandQueue = null;
    this.connected = false;
    this.subscribed = [];
    this.subscribeOnConnect = _params.subscribe;
    this.eventEmitter = new EventEmitter();
  }

  _sanitizeParams(params = {}) {
    const result = {
      server: DEFAULT_PARAMS.server,
      subscribe: DEFAULT_PARAMS.subscribe
    };

    if (params.server) {
      result.server = { ...DEFAULT_PARAMS.server, ...params.server };
    }
    if (params.subscribe) {
      result.subscribe = !Array.isArray(params.subscribe) ? [params.subscribe] : [...params.subscribe];
    }
    return result;
  }

  _getServerInfoForEvent() {
    return {
      host: this.server.host,
      port: this.server.port
    };
  }

  async start() {
    const params = {
      host: this.server.host,
      port: this.server.port,
      negotiationMandatory: false,
      timeout: 1500,
      irs: '\n'
    }

    const serverInfo = this._getServerInfoForEvent();

    if (!this.client) {
      this.client = new Telnet();

      this.client.on('close', () => {
        this.connected = false;
        this.subscribed = [];
        this.eventEmitter.emit('disconnect', serverInfo);
      });

      this.client.on('data', this._handleIncomingData.bind(this));
    }

    if (!this.commandQueue) {
      this.commandQueue = new CommandQueue(this.client);
    }

    await this.client.connect(params);
    this.eventEmitter.emit('connect', serverInfo);
    this.connected = true;
    await this._doLogin();
    if (this.subscribeOnConnect.length > 0) {
      await this.subscribe(this.subscribeOnConnect);
    }

    return true;
  }

  async stop() {
    if (this.isConnected()) {
      await this.client.end();
    }
    return true;
  }

  isConnected() {
    return this.connected;
  }

  // Data can be in the following formats:
  // - <playerId> notification [params...]
  // - notification [params...]
  _deduceNotification(data, parts, partIndex = 1) {
    const _parts = !parts ? data.split(' ').filter(p => p.trim().length > 0) : parts;
    const _partIndex = _parts.length === 1 ? 0 : partIndex;
    const _part = decodeURIComponent(_parts[_partIndex]).trim();
    if (this.subscribed.includes(_part)) {
      const result = {
        notification: _part
      };
      if (_partIndex === 1) {
        result.playerId = decodeURIComponent(_parts[0]).trim();
      }
      const params = (_partIndex < _parts.length - 1) ? _parts.slice(_partIndex + 1) : [];
      result.params = params.map(p => decodeURIComponent(p).trim());
      return result;
    }
    else if (partIndex > 0) {
      return this._deduceNotification(data, _parts, partIndex - 1);
    }
    else {
      return null;
    }
  }

  _handleIncomingData(data) {
    const _data = data.toString();
    const deduced = this._deduceNotification(_data);
    if (deduced) {
      this.eventEmitter.emit('notification', {
        ...deduced,
        raw: _data,
        server: this._getServerInfoForEvent()
      });
    }
  }

  _doLogin() {
    return new Promise((resolve, reject) => {
      // We do not know if server is actually password-protected, so we 
      // still send login command with blank credentials if none were provided.
      // If server is not password-protected, then the login command will succeed.
      // Otherwise, it will fail and we can reject the promise accordingly.
      const username = this.server.username || '';
      const password = username ? this.server.password || '' : null;
      const clientCloseHandler = () => {
        const loginError = new Error();
        loginError.code = ERR_AUTH_FAILURE;
        if (username === '') {
          loginError.message = `Connection terminated possibly due to missing credentials on password-protected server.`;
        }
        else {
          loginError.message = `Login failed for ${username}@${this.server.host}`;
        }
        reject(loginError);
      };
      this.client.once('close', clientCloseHandler);
      const encodedUsername = encodeURIComponent(username);
      const command = username ? `login ${encodedUsername} ${encodeURIComponent(password)}` : 'login';
      const expectedResponse = username ? `login ${encodedUsername} ******` : 'login ******';
      const cmd = {
        command,
        expectedResponse,
        callback: (err) => {
          if (err) {
            reject(err);
          }
          else {
            // Server always returns expectedResponse even with wrong credentials, but
            // will then disconnect. So we wait a short while before resolving.
            // If server disconnects in the meantime, then the 'close'
            // event handler wlll reject the promise.
            setTimeout(() => {
              this.client.off('close', clientCloseHandler);
              resolve();
            }, 1000);
          }
        }
      }
      this.commandQueue.enqueue(cmd);
    });
  }

  _doSubscribe(notifications) {
    const joined = notifications.join(',');
    return new Promise((resolve, reject) => {
      const cmd = {
        command: `subscribe ${joined}`,
        expectedResponse: `subscribe ${encodeURIComponent(joined)}`,
        callback: (err) => {
          if (err) {
            reject(err);
          }
          else {
            resolve();
          }
        }
      }
      this.commandQueue.enqueue(cmd);
    });
  }

  _sanitizeNotificationArg(notification) {
    return !Array.isArray(notification) ? [notification.trim()] : notification.map(n => n.trim());
  }

  async subscribe(notification) {
    const _connected = this.isConnected();
    const _notifications = this._sanitizeNotificationArg(notification);
    const _checkIncludes = _connected ? this.subscribed : this.subscribeOnConnect;
    const _newNotifications = _notifications.filter(n => !_checkIncludes.includes(n));

    if (_newNotifications.length === 0) {
      return;
    }

    if (_connected) {
      await this._doSubscribe([...this.subscribed, ..._newNotifications]);
      this.subscribed.push(..._newNotifications);
      this.subscribeOnConnect = this.subscribed;
    }
    else {
      this.subscribeOnConnect.push(..._newNotifications);
    }

    return true;
  }

  async unsubscribe(notification) {
    const _connected = this.isConnected();
    const _notifications = this._sanitizeNotificationArg(notification);
    const _filterArray = _connected ? this.subscribed : this.subscribeOnConnect;
    const _preserve = _filterArray.filter(n => !_notifications.includes(n));

    if (_preserve.length === _filterArray.length) {
      return;
    }

    if (_connected) {
      await this._doSubscribe(_preserve);
      this.subscribed = _preserve;
      this.subscribeOnConnect = this.subscribed;
    }
    else {
      this.subscribeOnConnect = _preserve;
    }

    return true;
  }

  getSubscribed() {
    return this.subscribed;
  }

  on(event, handler) {
    this.eventEmitter.on(event, handler);
  }

  once(event, handler) {
    this.eventEmitter.once(event, handler);
  }

  off(event, handler) {
    this.eventEmitter.off(event, handler);
  }
}

NotificationListener.ERR_AUTH_FAILURE = ERR_AUTH_FAILURE;
NotificationListener.ERR_SEND_CMD_FAILURE = ERR_SEND_CMD_FAILURE;
NotificationListener.ERR_CMD_RESP_TIMEOUT = ERR_CMD_RESP_TIMEOUT;

module.exports = {
  NotificationListener
};
