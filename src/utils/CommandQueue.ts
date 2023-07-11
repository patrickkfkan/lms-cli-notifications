import { Telnet } from 'telnet-client';
import NotificationListenerError, { NotificationListenerErrorCode } from './NotificationListenerError.js';

const RESPONSE_TIMEOUT = 5000;

export interface Command {
  command: string;
  expectedResponse: string;
  callback?: (error?: NotificationListenerError) => void;
}

export default class CommandQueue {

  #client: Telnet;
  #queue: Command[];
  #currentExec: Command & { timeout?: NodeJS.Timeout } | null; // Current command being executed

  constructor(client: Telnet) {
    this.#client = client;
    this.#queue = [];
    this.#currentExec = null;
    this.#client.on('data', this.#handleResponse.bind(this));
    this.#client.on('close', this.#cleanup.bind(this));
  }

  enqueue(cmd: Command) {
    this.#queue.push(cmd);
    this.#shiftAndExec();
  }

  #cleanup() {
    this.#queue = [];
    this.#resetCurrentExec();
  }

  #handleResponse(data: any) {
    if (!this.#currentExec) {
      return;
    }

    if (data.toString().trim() === this.#currentExec.expectedResponse.trim()) {
      this.#afterCurrentExec();
    }
  }

  async #shiftAndExec() {
    if (this.#currentExec || this.#queue.length === 0) {
      return;
    }
    const cmd = this.#queue.shift();
    if (!cmd) {
      return;
    }
    this.#currentExec = {...cmd};
    const { callback, command } = this.#currentExec;
    this.#currentExec.timeout = setTimeout(() => {
      if (callback) {
        const _err = new NotificationListenerError(`Timeout occurred while waiting for response from server command '${command}'.`);
        _err.code = NotificationListenerErrorCode.CommandResponseTimeout;
        callback(_err);
      }
    }, RESPONSE_TIMEOUT);
    try {
      await this.#client.send(command);
    }
    catch (err) {
      this.#resetCurrentExec();
      if (callback) {
        const _err = new NotificationListenerError(`Failed to send server command '${command}'.`);
        _err.code = NotificationListenerErrorCode.SendCommandError;
        _err.cause = err;
        callback(_err);
      }
    }
    this.#afterCurrentExec();
  }

  #afterCurrentExec() {
    if (!this.#currentExec) {
      return;
    }
    const callback = this.#currentExec.callback;
    this.#resetCurrentExec();
    if (callback) {
      callback();
    }
    this.#shiftAndExec();
  }

  #resetCurrentExec() {
    if (!this.#currentExec) {
      return;
    }
    if (this.#currentExec.timeout) {
      clearTimeout(this.#currentExec.timeout);
      delete this.#currentExec.timeout;
    }
    this.#currentExec = null;
  }
}
