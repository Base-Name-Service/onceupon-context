import { Abi } from 'viem';

export const OPTIMISM_ETHEREUM_GATEWAY =
  '0x99c9fc46f92e8a1c0dec1b1747d010903e884be1';

export const TRANSACTION_DEPOSITED_EVENT_HASH =
  '0xb3813568d9991fc951961fcb4c784893574240a28925604d09fc577c55bb7c32';

export const TRANSACTION_DEPOSITED_EVENT_ABI: Abi = [
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'from',
        type: 'address',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'to',
        type: 'address',
      },
      {
        indexed: true,
        internalType: 'uint256',
        name: 'version',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'bytes',
        name: 'opaqueData',
        type: 'bytes',
      },
    ],
    name: 'TransactionDeposited',
    type: 'event',
  },
];

export const OPTIMISM_BRIDGE_PROXY =
  '0xbeb5fc579115071764c7423a4f12edde41f106ed';
