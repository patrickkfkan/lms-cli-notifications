import EventEmitter from 'events';
import { Telnet } from 'telnet-client';
import CommandQueue, { Command } from './utils/CommandQueue.js';
import NotificationListenerError, { NotificationListenerErrorCode } from './utils/NotificationListenerError.js';

const DEFAULT_PARAMS = {
  server: {
    host: '127.0.0.1',
    port: '9090'
  } as Server,
  subscribe: [] as string[]
};

export interface Server {
  host: string;
  port: string;
  username?: string;
  password?: string;
}

export interface NotificationListenerParams {
  server?: Partial<Server>;
  subscribe?: string | string[];
}

export interface NotificationBase {
  playerId?: string;
  notification: string;
  params: string[];
}

export interface Notification extends NotificationBase {
  raw: string;
  server: { host: string; port: string; };
}

export class NotificationListener extends EventEmitter {

  #server: Server;
  #client: Telnet | null;
  #commandQueue: CommandQueue | null;
  #connected: boolean;
  #subscribed: string[];
  #subscribeOnConnect: string[];

  constructor(params: NotificationListenerParams) {
    super();
    const _params = this.#sanitizeParams(params);
    this.#server = _params.server;
    this.#client = null;
    this.#commandQueue = null;
    this.#connected = false;
    this.#subscribed = [];
    this.#subscribeOnConnect = _params.subscribe;
  }

  #sanitizeParams(params: NotificationListenerParams = {}): { server: Server; subscribe: string[] } {
    const result = {
      server: DEFAULT_PARAMS.server,
      subscribe: DEFAULT_PARAMS.subscribe
    };

    if (params.server?.host) {
      result.server.host = params.server.host;
    }
    if (params.server?.port) {
      result.server.port = params.server.port;
    }
    if (params.server?.username) {
      result.server.username = params.server.username;
    }
    if (params.server?.password) {
      result.server.password = params.server.password;
    }
    if (params.subscribe) {
      result.subscribe = !Array.isArray(params.subscribe) ? [ params.subscribe ] : [ ...params.subscribe ];
    }
    return result;
  }

  #getServerInfoForEvent(): Server {
    return {
      host: this.#server.host,
      port: this.#server.port
    };
  }

  async start() {
    const params = {
      host: this.#server.host,
      port: this.#server.port,
      negotiationMandatory: false,
      timeout: 1500,
      irs: '\n'
    };

    const serverInfo = this.#getServerInfoForEvent();

    if (!this.#client) {
      this.#client = new Telnet();

      this.#client.on('close', () => {
        this.#connected = false;
        this.#subscribed = [];
        this.emit('disconnect', serverInfo);
      });

      this.#client.on('data', this.#handleIncomingData.bind(this));
    }

    if (!this.#commandQueue) {
      this.#commandQueue = new CommandQueue(this.#client);
    }

    await this.#client.connect(params);
    this.emit('connect', serverInfo);
    this.#connected = true;
    await this.#doLogin();
    if (this.#subscribeOnConnect.length > 0) {
      await this.subscribe(this.#subscribeOnConnect);
    }

    return true;
  }

  async stop() {
    if (this.#connected && this.#client) {
      await this.#client.end();
    }
    return true;
  }

  isConnected() {
    return this.#connected;
  }

  // Data can be in the following formats:
  // - <playerId> notification [params...]
  // - notification [params...]
  #deduceNotification(data: string, parts?: string[], partIndex = 1): NotificationBase | null {
    const _parts = !parts ? data.split(' ').filter((p) => p.trim().length > 0) : parts;
    const _partIndex = _parts.length === 1 ? 0 : partIndex;
    const _part = decodeURIComponent(_parts[_partIndex]).trim();
    if (this.#subscribed.includes(_part)) {
      const params = (_partIndex < _parts.length - 1) ? _parts.slice(_partIndex + 1) : [];
      const result: NotificationBase = {
        notification: _part,
        params: params.map((p) => decodeURIComponent(p).trim())
      };
      if (_partIndex === 1) {
        result.playerId = decodeURIComponent(_parts[0]).trim();
      }
      result.params = params.map((p) => decodeURIComponent(p).trim());
      return result;
    }
    else if (partIndex > 0) {
      return this.#deduceNotification(data, _parts, partIndex - 1);
    }

    return null;

  }

  #handleIncomingData(data: any) {
    const _data = data.toString();
    const deduced = this.#deduceNotification(_data);
    if (deduced) {
      const notification: Notification = {
        ...deduced,
        raw: _data,
        server: this.#getServerInfoForEvent()
      };
      this.emit('notification', notification);
    }
  }

  #doLogin() {
    if (!this.#client) {
      throw Error('Telnet client unavailable!');
    }
    if (!this.#commandQueue) {
      throw Error('Command queue unavailable!');
    }
    const client = this.#client;
    const commandQueue = this.#commandQueue;
    return new Promise<void>((resolve, reject) => {
      // We do not know if server is actually password-protected, so we
      // Still send login command with blank credentials if none were provided.
      // If server is not password-protected, then the login command will succeed.
      // Otherwise, it will fail and we can reject the promise accordingly.
      const username = this.#server.username || '';
      const password = username ? this.#server.password || '' : null;
      const clientCloseHandler = () => {
        const loginError = new NotificationListenerError();
        loginError.code = NotificationListenerErrorCode.AuthError;
        if (username === '') {
          loginError.message = 'Connection terminated possibly due to missing credentials on password-protected server.';
        }
        else {
          loginError.message = `Login failed for ${username}@${this.#server.host}`;
        }
        reject(loginError);
      };
      client.once('close', clientCloseHandler);
      const encodedUsername = encodeURIComponent(username);
      const command = username ? `login ${encodedUsername} ${encodeURIComponent(password || '')}` : 'login';
      const expectedResponse = username ? `login ${encodedUsername} ******` : 'login ******';
      const cmd: Command = {
        command,
        expectedResponse,
        callback: (err) => {
          if (err) {
            reject(err);
          }
          else {
            // Server always returns expectedResponse even with wrong credentials, but
            // Will then disconnect. So we wait a short while before resolving.
            // If server disconnects in the meantime, then the 'close'
            // Event handler wlll reject the promise.
            setTimeout(() => {
              client.off('close', clientCloseHandler);
              resolve();
            }, 1000);
          }
        }
      };
      commandQueue.enqueue(cmd);
    });
  }

  #doSubscribe(notifications: string[]) {
    if (!this.#commandQueue) {
      throw Error('Command queue unavailable!');
    }
    const commandQueue = this.#commandQueue;
    const joined = notifications.join(',');
    return new Promise<void>((resolve, reject) => {
      const cmd: Command = {
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
      };
      commandQueue.enqueue(cmd);
    });
  }

  #sanitizeNotificationArg(notification: string | string[]) {
    return !Array.isArray(notification) ? [ notification.trim() ] : notification.map((n) => n.trim());
  }

  async subscribe(notification: string | string[]) {
    const _connected = this.isConnected();
    const _notifications = this.#sanitizeNotificationArg(notification);
    const _checkIncludes = _connected ? this.#subscribed : this.#subscribeOnConnect;
    const _newNotifications = _notifications.filter((n) => !_checkIncludes.includes(n));

    if (_newNotifications.length === 0) {
      return;
    }

    if (_connected) {
      await this.#doSubscribe([ ...this.#subscribed, ..._newNotifications ]);
      this.#subscribed.push(..._newNotifications);
      this.#subscribeOnConnect = this.#subscribed;
    }
    else {
      this.#subscribeOnConnect.push(..._newNotifications);
    }

    return true;
  }

  async unsubscribe(notification: string | string[]) {
    const _connected = this.isConnected();
    const _notifications = this.#sanitizeNotificationArg(notification);
    const _filterArray = _connected ? this.#subscribed : this.#subscribeOnConnect;
    const _preserve = _filterArray.filter((n) => !_notifications.includes(n));

    if (_preserve.length === _filterArray.length) {
      return;
    }

    if (_connected) {
      await this.#doSubscribe(_preserve);
      this.#subscribed = _preserve;
      this.#subscribeOnConnect = this.#subscribed;
    }
    else {
      this.#subscribeOnConnect = _preserve;
    }

    return true;
  }

  getSubscribed() {
    return this.#subscribed;
  }

  /**
   * @event
   * Server connected.
   * @param event
   * @param listener
   */
  on(event: 'connect', listener: (server: { host: string; port: string }) => void): this;
  /**
   * @event
   * Server disconnected.
   * @param event
   * @param listener
   */
  on(event: 'disconnect', listener: (server: { host: string; port: string }) => void): this;
  /**
   * @event
   * Subscribed notification received.
   * @param event
   * @param litener
   */
  on(event: 'notification', listener: (data: Notification) => void): this;
  on(event: string | symbol, listener: (...args: any[]) => void): this {
    return super.on(event, listener);
  }
}
