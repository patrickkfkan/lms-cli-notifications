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
// ESM
import { NotificationListener } from 'lms-cli-notifications';
// CJS
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

<details>
<summary><code>new NotificationListener([params])</code></summary>
<br />

Creates a `NotificationListener` instance and associates it with `server`, or `127.0.0.1:9090` if not specified.

**Params**

- `params`: ([`NotificationListenerParams`](docs/api/interfaces/NotificationListenerParams.md)) (*optional* and *all properties optional*)
    - `server`:
        - `host`: (string) address of server to connect to (default: '127.0.0.1`).
        - `port`: (string) server's CLI port (default: '9090').
        - `username`: (string) username for login - omit if not applicable.
        - `password`: (string) password for login - omit if not applicable.
    - `subscribe`: (string | Array\<string>)
      - If string, the notification to subscribe to.
      - If array, the list of notifications to subscribe to.


The `subscribe` param is included merely for convenience. You can subscribe to notifications at any stage by calling `subscribe()`. So the following:
```
const server = { ... };
const notifications = ['client', 'mixer'];

const notificationListener = new NotificationListener({ 
  server,
  subscribe: notifications
});
notificationListener.start();
```

has the same effect as:

```
...
const notificationListener = new NotificationListener({ server });
notificationListener.subscribe(notifications);

notificationListener.start();
```

---
</details>

<details>
<summary><code>notificationListener.start()</code></summary>
<br />

Establishes connection with the server and subscribes to the notification(s) specified at construction time.

**Returns**

Promise that resolves to `true` on success.

---
</details>

<details>
<summary><code>notificationListener.stop()</code></summary>
<br />

Terminates connection with the server.

**Returns**

Promise that resolves to `true` on success.

---
</details>

<details>
<summary><code>notificationListener.isConnected()</code></summary>
<br />

Whether the `NotificationListener` instance is connected to the server.

**Returns**

Boolean

---
</details>

<details>
<summary><code>notificationListener.subscribe(notification)</code></summary>
<br/>

Subscribes to `notification`.

>If server is not yet connected, subscription will be deferred until connection is established.

**Params**

- `notification` (string | Array\<string>):
  - If string, a single notification to subscribe to.
  - If array, the list of notifications to subscribe to.

**Returns**

- If server is not yet connected, a Promise that resolves after adding `notification` to the list of pending subscriptions.
- If server is already connected, a Promise that resolves on successful subscription.

</details>

<details>
<summary><code>notificationListener.unsubscribe(notification)</code></summary>

Unsubscribes from `notification`.

**Params**

- `notification` (string | Array\<string>):
  - If string, a single notification to unsubscribe from.
  - If array, the list of notifications to unsubscribe from.

**Returns**

- If server is not yet connected, a Promise that resolves when `notification` is removed from the list of pending subscriptions.
- If server is already connected, a Promise that resolves on successful unsubscription.

---
</details>

<details>
<summary><code>notificationListener.getSubscribed()</code></summary>
<br />

Returns the list of currently-subscribed notifications. The list will be empty if there is no connection with the server.

**Returns**

Array\<string>

---
</details>


### Events

<details>
<summary><code>notificationListener.on('connect', (server) => ...)</code></summary>
<br />

Emitted when connection to `server` is established.

**Listener Params**
- `server`:
  - `host`: (string)
  - `port`: (string)

---
</details>

<details>
<summary><code>notificationListener.on('disconnect', (server) => ...)</code></summary>
<br />

Emitted when server is disconnected.

**Listener Params**
- `server`:
  - `host`: (string)
  - `port`: (string)

---
</details>

<details>
<summary><code>notificationListener.on('notification', (data) => ...)</code></summary>
<br />


Emitted when a subscribed notification is received.

`NotificationListener` parses the raw message received from the server and converts it from something like this:
```
08%3A00%3A27%3Aa0%3Ad1%3A2c mixer volume 70
```
into this:

|Property                      |Value                                           |
|------------------------------|------------------------------------------------|
|`playerId` \<string\>*        |'08:00:27:a0:d1:2c'                             |
|`notification` \<string\>     |'mixer'                                         |
|`params` \<Array\>            |['volume', '70']                                |
|`raw` \<string\>              |'08%3A00%3A27%3Aa0%3Ad1%3A2c mixer volume 70'   |
|`server` \<Object\>           |{ host: ..., port: ... }                        |


**Listener Params**
- `data`: ([Notification](docs/api/interfaces/Notification.md))
  - `playerId`: (string)
  - `notification`: (string)
  - `params`: (Array\<string>)
  - `raw`: (string) unprocessed notification message
  - `server`: (object)
    - `host`: (string)
    - `port`: (string)

> Notifications that are not associated with a specific player, such as 'rescan', will not have the `playerId` param.

---
</details>

### Errors

<details>
<summary><i>Breaking change from v0.x to v1.x</i></summary>
<br />

In v0.x, error codes are defined as standalone constants.

In v1.x, they are defined in the [`NotificationListenerErrorCode`](docs/api/enums/NotificationListenerErrorCode.md) enum.

</details>

```
notificationListener.start()
  .then(() => {
    ...
  })
  .catch((err) => {
    ...
  });
```
Where an error is an instance of [`NotificationListenerError`](docs/api/classes/NotificationListenerError.md), you can obtain more information about it:

```
if (err instanceof NotificationListenerError) {
  console.log(`
    Error: ${ err.message },
    Code: ${ err.code },   // Can be undefined
    Cause: ${ err.cause }  // Underlying error (can be undefined)
  `);
  ...
}
```

#### Error codes

| Enum: [`NotificationListenerErrorCode`](docs/api/enums/NotificationListenerErrorCode.md)      | Description                                   |
|-------------------------|---------------------------------------------------------------------------------------------------------------------|
|`AuthError`              | Login attempt failed for a password-protected server.                                                               |
|`SendCommandError`       | A command could not be sent to the server. The underlying error can be obtained from `err.cause`.                   |
|`CommandResponseTimeout` | After sending a command to the server, a response is expected but not received within a timeout period of 5 seconds.|

---

## Running the Example
```
// ESM
npm run example -- -h [server address] -p [server CLI port] -u [username] -pw [password]

// CJS
node index.cjs -h [server address] -p [server CLI port] -u [username] -pw [password]
```

Only include options that are applicable. Generally, you do not have to specify `-p` since most
LMS installations use the default 9090 port for CLI.

## Changelog

0.1.2:
- Fix blank credentials causing login timeout

0.1.1:
- Fix example

0.1.0:
- Initial release

## License
MIT
