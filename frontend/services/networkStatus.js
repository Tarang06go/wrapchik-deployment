import { DeviceEventEmitter } from 'react-native';

export const NETWORK_STATUS_EVENT = 'wrapchik:network-status';

export const emitNetworkState = (online) => {
  DeviceEventEmitter.emit(NETWORK_STATUS_EVENT, Boolean(online));
};
