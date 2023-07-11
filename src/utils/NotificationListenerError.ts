export enum NotificationListenerErrorCode {
  AuthError = -10,
  SendCommandError = -20,
  CommandResponseTimeout = -21
}

export default class NotificationListenerError extends Error {
  code?: NotificationListenerErrorCode;
  cause?: any;
}
