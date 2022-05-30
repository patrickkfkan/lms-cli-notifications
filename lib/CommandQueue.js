const { ERR_SEND_CMD_FAILURE, ERR_CMD_RESP_TIMEOUT } = require("./constants");

const RESPONSE_TIMEOUT = 5000;

class CommandQueue {
  constructor(client) {
    this.client = client;
    this.queue = [];
    this.currentExec = null; // Current command being executed
    this.client.on('data', this._handleResponse.bind(this));
    this.client.on('close', this._cleanup.bind(this));
  }

  enqueue(cmd) {
    this.queue.push(cmd);
    this._shiftAndExec();
  }

  _cleanup() {
    this.queue = [];
    this._resetCurrentExec();
  }

  _handleResponse(data) {
    if (!this.currentExec || !this.currentExec.expectedResponse) {
      return;
    }

    if (data.toString().trim() === this.currentExec.expectedResponse.trim()) {
      this._afterCurrentExec();
    }
  }

  async _shiftAndExec() {
    if (this.currentExec || this.queue.length === 0) {
      return;
    }
    const cmd = this.queue.shift();
    this.currentExec = cmd;
    if (cmd.expectedResponse) {
      cmd.timeout = setTimeout(() => {
        const callback = cmd.callback;
        if (typeof callback === 'function') {
          const _err = new Error(`Timeout occurred while waiting for response from server command '${cmd.command}'.`);
          _err.code = ERR_CMD_RESP_TIMEOUT;
          callback(_err);
        }    
      }, RESPONSE_TIMEOUT);
    }
    try {
      await this.client.send(cmd.command);
    } catch (err) {
      const callback = cmd.callback;
      this._resetCurrentExec();
      if (typeof callback === 'function') {
        const _err = new Error(`Failed to send server command '${cmd.command}'.`);
        _err.code = ERR_SEND_CMD_FAILURE;
        _err.cause = err;
        callback(_err);
      }
    }
    if (!cmd.expectedResponse) {
      this._afterCurrentExec();
    }
  }

  _afterCurrentExec() {
    if (!this.currentExec) {
      return;
    }
    const callback = this.currentExec.callback;
    this._resetCurrentExec();
    if (typeof callback === 'function') {
      callback();
    }
    this._shiftAndExec();
  }

  _resetCurrentExec() {
    if (!this.currentExec) {
      return;
    }
    if (this.currentExec.timeout) {
      clearTimeout(this.currentExec.timeout);
      delete this.currentExec.timeout;
    }
    this.currentExec = null;
  }
}

module.exports = {
  CommandQueue
};
