[lms-cli-notifications](../README.md) / NotificationListener

# Class: NotificationListener

## Hierarchy

- `EventEmitter`

  ↳ **`NotificationListener`**

## Table of contents

### Constructors

- [constructor](NotificationListener.md#constructor)

### Methods

- [getSubscribed](NotificationListener.md#getsubscribed)
- [isConnected](NotificationListener.md#isconnected)
- [start](NotificationListener.md#start)
- [stop](NotificationListener.md#stop)
- [subscribe](NotificationListener.md#subscribe)
- [unsubscribe](NotificationListener.md#unsubscribe)

### Events

- [on](NotificationListener.md#on)

## Constructors

### constructor

• **new NotificationListener**(`params`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `params` | [`NotificationListenerParams`](../interfaces/NotificationListenerParams.md) |

#### Overrides

EventEmitter.constructor

#### Defined in

src/NotificationListener.ts:46

## Methods

### getSubscribed

▸ **getSubscribed**(): `string`[]

#### Returns

`string`[]

#### Defined in

src/NotificationListener.ts:302

___

### isConnected

▸ **isConnected**(): `boolean`

#### Returns

`boolean`

#### Defined in

src/NotificationListener.ts:133

___

### start

▸ **start**(): `Promise`<`boolean`\>

#### Returns

`Promise`<`boolean`\>

#### Defined in

src/NotificationListener.ts:88

___

### stop

▸ **stop**(): `Promise`<`boolean`\>

#### Returns

`Promise`<`boolean`\>

#### Defined in

src/NotificationListener.ts:126

___

### subscribe

▸ **subscribe**(`notification`): `Promise`<`undefined` \| ``true``\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `notification` | `string` \| `string`[] |

#### Returns

`Promise`<`undefined` \| ``true``\>

#### Defined in

src/NotificationListener.ts:258

___

### unsubscribe

▸ **unsubscribe**(`notification`): `Promise`<`undefined` \| ``true``\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `notification` | `string` \| `string`[] |

#### Returns

`Promise`<`undefined` \| ``true``\>

#### Defined in

src/NotificationListener.ts:280

## Events

### on

▸ **on**(`event`, `listener`): [`NotificationListener`](NotificationListener.md)

Server connected.

#### Parameters

| Name | Type |
| :------ | :------ |
| `event` | ``"connect"`` |
| `listener` | (`server`: { `host`: `string` ; `port`: `string`  }) => `void` |

#### Returns

[`NotificationListener`](NotificationListener.md)

#### Overrides

EventEmitter.on

#### Defined in

src/NotificationListener.ts:312

▸ **on**(`event`, `listener`): [`NotificationListener`](NotificationListener.md)

Server disconnected.

#### Parameters

| Name | Type |
| :------ | :------ |
| `event` | ``"disconnect"`` |
| `listener` | (`server`: { `host`: `string` ; `port`: `string`  }) => `void` |

#### Returns

[`NotificationListener`](NotificationListener.md)

#### Overrides

EventEmitter.on

#### Defined in

src/NotificationListener.ts:319

▸ **on**(`event`, `listener`): [`NotificationListener`](NotificationListener.md)

Subscribed notification received.

#### Parameters

| Name | Type |
| :------ | :------ |
| `event` | ``"notification"`` |
| `listener` | (`data`: [`Notification`](../interfaces/Notification.md)) => `void` |

#### Returns

[`NotificationListener`](NotificationListener.md)

#### Overrides

EventEmitter.on

#### Defined in

src/NotificationListener.ts:326
