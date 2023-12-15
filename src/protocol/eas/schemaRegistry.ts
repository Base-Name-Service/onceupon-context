import { Abi, Hex } from 'viem';
import { EventLogTopics, Transaction } from '../../types';
import { decodeTransactionInput, decodeLog } from '../../helpers/utils';
import { ABIs, EAS_LINKS } from './constants';

export const contextualize = (transaction: Transaction): Transaction => {
  const isBundler = detect(transaction);
  if (!isBundler) return transaction;

  return generate(transaction);
};

export const detect = (transaction: Transaction): boolean => {
  try {
    if (!transaction.to) {
      return false;
    }

    // NOTE: There is one other contract deployed on mainnet that has the same function
    // signature for 'register' so we filter out transactions to that contract
    if (
      transaction.to === '0xD85Fac03804a3e44D29c494f3761D11A2262cBBe' &&
      transaction.chainId === 1
    ) {
      return false;
    }

    // decode input
    let decoded: ReturnType<
      typeof decodeTransactionInput<typeof ABIs.SchemaRegistry>
    >;
    try {
      decoded = decodeTransactionInput(
        transaction.input as Hex,
        ABIs.SchemaRegistry,
      );
    } catch (_) {
      return false;
    }

    if (!decoded || !decoded.functionName) return false;
    return ['register'].includes(decoded.functionName);
  } catch (err) {
    console.error('Error in detect function:', err);
    return false;
  }
};

// Contextualize for mined txs
export const generate = (transaction: Transaction): Transaction => {
  const decoded = decodeTransactionInput(
    transaction.input as Hex,
    ABIs.SchemaRegistry as Abi,
  );

  switch (decoded.functionName) {
    case 'register': {
      let id = '';
      if (transaction.receipt?.status) {
        const registerLog = transaction.logs?.find((log) => {
          try {
            const decoded = decodeLog(
              ABIs.SchemaRegistry,
              log.data as Hex,
              log.topics as EventLogTopics,
            );
            return decoded.eventName === 'Registered';
          } catch (_) {
            return false;
          }
        });

        if (registerLog) {
          try {
            const decoded = decodeLog(
              ABIs.SchemaRegistry,
              registerLog.data as Hex,
              registerLog.topics as EventLogTopics,
            );
            id = decoded.args['uid'];
          } catch (err) {
            console.error(err);
          }
        }
      }

      const code = decoded.args[0] as string;
      transaction.context = {
        variables: {
          from: {
            type: 'address',
            value: transaction.from,
          },
          id: {
            type: 'schemaID',
            value: id,
            link: EAS_LINKS[transaction.chainId]
              ? `${EAS_LINKS[transaction.chainId]}/${id}`
              : '',
          },
          schema: {
            type: 'code',
            value: code,
          },
          registered: {
            type: 'contextAction',
            value: 'REGISTERED',
          },
        },
        summaries: {
          category: 'PROTOCOL_1',
          en: {
            title: 'EAS',
            default: '[[from]] [[registered]] new schema with id [[id]]',
            long: '[[from]] [[registered]] new schema with id [[id]] and schema [[schema]]',
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
