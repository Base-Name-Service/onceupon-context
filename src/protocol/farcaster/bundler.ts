import { Hex } from 'viem';
import { Interface } from 'ethers/lib/utils';
import { ContextSummaryVariableType, Transaction } from '../../types';
import { FarcasterContracts } from './constants';
import { decodeTransactionInputViem } from '../../helpers/utils';

// Contextualizer for the Bundler contract:
// https://github.com/farcasterxyz/contracts/blob/main/src/interfaces/IBundler.sol
export const contextualize = (transaction: Transaction): Transaction => {
  const isBundler = detect(transaction);
  if (!isBundler) return transaction;

  return generate(transaction);
};

export const detect = (transaction: Transaction): boolean => {
  if (
    transaction.to !== FarcasterContracts.Bundler.address &&
    transaction.to !== FarcasterContracts.BundlerOld.address
  ) {
    return false;
  }

  try {
    const decoded: ReturnType<
      typeof decodeTransactionInputViem<typeof FarcasterContracts.Bundler.abi>
    > = decodeTransactionInputViem(
      transaction.input as Hex,
      FarcasterContracts.Bundler.abi,
    );

    return ['register'].includes(decoded.functionName);
  } catch (_) {
    return false;
  }
};

// Contextualize for mined txs
export const generate = (transaction: Transaction): Transaction => {
  const decoded: ReturnType<
    typeof decodeTransactionInputViem<typeof FarcasterContracts.Bundler.abi>
  > = decodeTransactionInputViem(
    transaction.input as Hex,
    FarcasterContracts.Bundler.abi,
  );

  const caller = transaction.from;

  switch (decoded.functionName) {
    case 'register': {
      const owner = decoded.args[0].to;
      const callerIsOwner = owner.toLowerCase() === caller.toLowerCase();

      // Capture cost to register
      const cost: ContextSummaryVariableType = {
        type: 'eth',
        value: transaction.value,
      };
      // Capture FID
      let fid = '';
      if (transaction.receipt?.status) {
        const registerLog = transaction.logs?.find((log) => {
          return log.address === FarcasterContracts.IdRegistry.address;
        });
        if (registerLog) {
          try {
            const iface = new Interface(FarcasterContracts.IdRegistry.abi);
            const decoded = iface.parseLog({
              topics: registerLog.topics,
              data: registerLog.data,
            });
            fid = decoded.args.id.toString();
          } catch (e) {
            console.error(e);
          }
        }
      }

      transaction.context = {
        variables: {
          caller: {
            type: 'address',
            value: caller,
          },
          owner: {
            type: 'address',
            value: owner,
          },
          fid: {
            type: 'farcasterID',
            value: fid,
          },
          cost,
          registered: {
            type: 'contextAction',
            value: 'REGISTERED_FARCASTER_ID',
          },
        },
        summaries: {
          category: 'PROTOCOL_1',
          en: {
            title: 'Farcaster',
            default: callerIsOwner
              ? '[[caller]] [[registered]] [[fid]] for [[cost]]'
              : '[[caller]] [[registered]] [[fid]] for [[owner]] for [[cost]]',
          },
        },
      };
      return transaction;
    }

    default: {
      return transaction;
    }
  }
};
