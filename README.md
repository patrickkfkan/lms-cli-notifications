# lms-cli-notifications

Node module for subscribing to and receiving notifications through Logitech Media Server's CLI.

Where in CLI, you subscribe to notifications as follows:

```
// Telnet to LMS
$ telnet <server_address>:<cli_port>

// Subscribe to 'mixer' notifications
# subscribe mixer

// Also subscribe to 'play' and 'pause' notifications
# subscribe mixer,play,pause

// Unsubscribe from 'play' notifications
# subscribe mixer,pause

// Output when player volume changes:
40%3A61%3A86%3Af0%3A8f%3A19 mixer volume 80

```

In Node.JS, you would do this:

```
const { NotificationListener } = require('lms-cli-notifications');

const server = {
  host: '<server_address>',
  port: '<cli_port>'
};

const notificationListener = new NotificationListener({
  server,
  subscribe: 'mixer' // Subscribe to 'mixer' notifications
});

notificationListener.on('notification', (data) => {
  const {playerId, notification, params} = data;
  console.log({playerId, notification, params});
});

await notificationListener.start();

// Also subscribe to 'play' and 'pause' notifications
await notificationListener.subscribe(['play', 'pause']);

// Unsubscribe from 'play' notifications
await notificationListener.unsubscribe('play');

...

// Output when player volume changes:
{
  playerId: '40:61:86:f0:8f:19',
  notification: 'mixer',
  params: [ 'volume', '50' ]
}

```

Do not confuse subscription in this context with the `subscribe` *tag* in *queries* (which this library does not support).

## Install

```
npm install --save lms-cli-notifications
```

## API

### Class: `NotificationListener`

A `NotificationListener` encapsulates the process of connecting to a Logitech Media Server's CLI, subscribing to notifications and receiving them (communicating back by way of Events). You would begin by first creating a `NotificationListener` instance.

### `new NotificationListener([params])`
- `params` \<Object\> (all properties optional):
    - `server` \<Object\>:
        - `host`: address of server to connect to (default: '127.0.0.1`).
        - `port`: server's CLI port (default: '9090').
        - `username`: username for login - omit if not applicable.
        - `password`: password for login - omit if not applicable.
    - `subscribe` \<string | Array\>: notification (if string value) or list of notifications (if array value) to subscribe to.

Creates a `NotificationListener` instance and associates it with `server`, or `127.0.0.1:9090` if not specified..

The `subscribe` param is included merely for convenience. You can subscribe to notifications at any stage by calling `subscribe()`. So the following code:
```
const server = { ... };
const notifications = ['client', 'mixer'];

const notificationListener = new NotificationListener({ 
  server,
  subscribe: notifications
});
notificationListener.start();
```

has the same effect as this:

```
...
const notificationListener = new NotificationListener({ server });
notificationListener.subscribe(notifications);

notificationListener.start();
```

### `notificationListener.start()`

- Returns: \<Promise\>

Connect to the server and subscribe to the notification or list of notifications specified at construction time, if any. Returns a promise that resolves to `true` on success.

### `notificationListener.stop()`

- Returns: \<Promise\>

Disconnect from the server. Returns a promise that resolves to `true` on success.

### `notificationListener.isConnected()`

Returns `true` if the `NotificationListener` is connected to the server, `false` otherwise.

### `notificationListener.subscribe(notification)`

- `notification` \<string | Array\>
- Returns: \<Promise\>

Subscribe to `notification` (if string value) or list of notifications (if array value):
- If server is not yet connected, the function returns a promise that resolves after placing `notification` in a list of pending subscriptions. Actual subscription will take place when the server is connected.
- If server is already connected, the function returns a promise that resolves on successful subscription.

### `notificationListener.unsubscribe(notification)`

- `notification` \<string | Array\>
- Returns: \<Promise\>

Unsubscribe from `notification` (if string value) or list of notifications (if array value):
- If server is not yet connected, the function returns a promise that resolves after removing `notification` from the list of pending subscriptions.
- If server is already connected, the function returns a promise that resolves on successful unsubscription.

### `notificationListener.getSubscribed()`

- Returns: \<Array\>

Returns the list of notifications currently subscribed on the server. If the server is not connected, the list will be empty.

### `notificationListener.on(event, handler)`

- `event` \<string\>
- `handler` \<Function\>

Adds `handler` function for `event`.

### `notificationListener.once(event, handler)`

- `event` \<string\>
- `handler` \<Function\>

Adds one-time `handler` function for `event`.

### `notificationListener.off(event[, handler])`

- `event` \<string\>
- `handler` \<Function\>

Removes `handler` function for `event`. If `handler` is not specified, removes all handlers for the event.

### Event: `'connect'`

Emitted when connection to server is established.

```
notificationListener.on('connect', (server) => {
  console.log('Connected to:', server);
});

...

// Output:
Connected to: { host: ..., port: ... }
```

### Event: `'disconnect'`

Emitted when server is disconnected.

```
notificationListener.on('disconnect', (server) => {
  console.log('Disconnected from:', server);
});

...

// Output:
Disconnected from: { host: ..., port: ... }
```

### Event: `'notification'`

Emitted when a subscribed notification is received.

Raw notifications received from the server have the following format:

```
[playerId] notification params
```

The `NotificationListener` processes the raw notification and emits the `'notification'` event with the processed payload.

By way of example, given the following raw notification:
```
08%3A00%3A27%3Aa0%3Ad1%3A2c mixer volume 70
```

and the following code that captures the `'notification'` event:

```
notificationListener.on('notification', (data) => {
    ...
});
```

`data` will be an object with the following property-values:

|Property                      |Value                                           |
|------------------------------|------------------------------------------------|
|`playerId` \<string\>*        |'08:00:27:a0:d1:2c'                             |
|`notification` \<string\>     |'mixer'                                         |
|`params` \<Array\>            |['volume', '70']                                |
|`raw` \<string\>              |'08%3A00%3A27%3Aa0%3Ad1%3A2c mixer volume 70'   |
|`server` \<Object\>           |{ host: ..., port: ... }                        |

\* Notifications that are not associated with a specific player, such as 'rescan', will not have the `playerId` property.

### Errors

When a promise returned by a function rejects, you can (should) catch the error:

```
notificationListener.start()
  .then(() => {
    ...
  })
  .catch((err) => {
    ...
  });
```

`err` \<Error\>:
- `code` \<integer\>: Error code
- `message` \<string\>: Human-readable error message
- `cause` \<Error\>: If present, the underlying `Error` that gives rise to the current error

### Error codes

#### `NotificationListener.ERR_AUTH_FAILURE`

Login attempt failed for a password-protected server.

#### `NotificationListener.ERR_SEND_CMD_FAILURE`

A command could not be sent to the server. The underlying `Error` can be obtained from the `cause` property.

#### `NotificationListener.ERR_CMD_RESP_TIMEOUT`

After sending a command to the server, a response is expected but not received within a timeout period of 5 seconds.

## Changelog

0.1.0:
- Initial release

## License
MIT
