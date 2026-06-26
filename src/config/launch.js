import { IS_CA_LIVE } from './deployed.js';

/** When false, UI uses placeholders instead of on-chain reads. Defaults on when CA is live. */
export const liveDataEnabled =
  import.meta.env.VITE_LIVE_DATA === 'false'
    ? false
    : import.meta.env.VITE_LIVE_DATA === 'true' || IS_CA_LIVE;

export const LAUNCH_TERMINAL_MESSAGE = 'live on mainnet';
