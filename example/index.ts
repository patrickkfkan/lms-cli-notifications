import { NotificationListener, NotificationListenerError } from '../dist/mjs/index.js';

console.log(`Usage: npm run example [-- options]

  -h    --host        Server address. Default: 127.0.0.1
  -p    --port        Server's CLI port. Default: 9090
  -u    --username    Username for login
  -pw   --password    Password for login

For example, to connect to server at 192.168.1.5 with username 'abc' and password 'xyz':

npm run example -- -h 192.168.1.5 -u abc -pw xyz

-----------------
Here we go...
  `);

const server: any = {
  /*
  Host: ... ,        // Address of the server to connect to. Default: 127.0.0.1
  port: ... ,        // Server's CLI port. Default: 9090
  username: ... ,    // Username for login, if applicable
  password: ...      // Password for login, if applicable
  */
};

function setServerProp(prop: any, value?: string) {
  if (value && server) {
    server[prop] = value;
  }
}

process.argv.forEach((arg, index) => {
  if (arg === '--host' || arg === '-h') {
    setServerProp('host', process.argv[index + 1]);
  }
  else if (arg === '--port' || arg === '-p') {
    setServerProp('port', process.argv[index + 1]);
  }
  else if (arg === '--username' || arg === '-u') {
    setServerProp('username', process.argv[index + 1]);
  }
  else if (arg === '--password' || arg === '-pw') {
    setServerProp('password', process.argv[index + 1]);
  }
});

// Create NotificationListener instance
const notificationListener = new NotificationListener({
  server,
  subscribe: [ 'client', 'mixer' ] // Subscribe to the 'client' and 'mixer' notifications upon connecting
});

// Event: server connected...
notificationListener.on('connect', (server) => {
  console.log(`NotificationListener connected to ${server.host}:${server.port}`);
});

// Event: server disconnected...
notificationListener.on('disconnect', (server) => {
  console.log(`NotificationListener disconnected from ${server.host}`);
});

// Event: notification received...
// The 'data' object passed to the handler has the following key properties
// That define the full content of the notification:
// [playerId<string>] notification<string> params<Array>
notificationListener.on('notification', (data) => {
  const { playerId, notification, params } = data;
  console.log('----------');
  if (notification === 'client' && playerId && params.length > 0) {
    // Report player connected / disconnected
    const type = (params[0] === 'new' || params[0] === 'reconnect') ? 'connected to' :
      params[0] === 'disconnect' ? 'disconnected from' : null;
    if (type) {
      console.log(`Player ${playerId} ${type} ${data.server.host}`);
    }
  }
  else if (notification === 'mixer' && playerId && params.length > 0) {
    // Report player volume change
    if (params[0] === 'volume' && params[1] !== undefined) {
      console.log(`Player ${playerId} volume changed to ${params[1]}`);
    }
  }
  else {
    console.log(`'${notification}' notification received:`);
    console.log({playerId, params});
  }
});

// Start listening...
notificationListener.start()
  .then(async () => {
    console.log('NotificationListener started.');
    console.log('Currently subscribed notifications:', notificationListener.getSubscribed());
    // Subscribe to more notifications
    console.log('Let\'s subscribe to more...');
    await notificationListener.subscribe([ 'play', 'stop', 'pause', 'playlist' ]);
    console.log('Currently subscribed notifications:', notificationListener.getSubscribed());
  })
  .catch((err) => {
    if (err instanceof Error) {
      console.log(`Error: ${err.message}`);
    }
    else {
      console.log('Error:', err);
    }
    if (err instanceof NotificationListenerError && err.cause) {
      console.log('Caused by:', err.cause);
    }
  });

process.on('SIGINT', () => {
  notificationListener.stop().then(() => {
    console.log('NotificationListener stopped.');
  });
});
