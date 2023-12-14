import { Abi } from 'viem';
import { HexadecimalString, Transaction } from '../../types';
import { decodeTransactionInputViem } from '../../helpers/utils';
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

    // NOTE: For some reason there are many transactions on mainnet to the
    // address of the EAS contract on OP stack chains (maybe misconfigured dApps?),
    // so we filter out those
    if (
      transaction.to === '0x4200000000000000000000000000000000000021' &&
      transaction.chainId === 1
    ) {
      return false;
    }

    // decode input
    let decoded;
    try {
      decoded = decodeTransactionInputViem(
        transaction.input as HexadecimalString,
        ABIs.EAS as Abi,
      );
    } catch (err) {
      return false;
    }

    if (!decoded || !decoded.functionName) return false;
    return [
      'attest',
      'attestByDelegation',
      'multiAttest',
      'multiAttestByDelegation',
      'revoke',
      'revokeByDelegation',
      'multiRevoke',
      'multiRevokeByDelegation',
      'timestamp',
      'multiTimestamp',
      'revokeOffchain',
      'multiRevokeOffChain',
    ].includes(decoded.functionName);
  } catch (err) {
    console.error('Error in detect function:', err);
    return false;
  }
};

const pluralize = (word: string, n: number): string => {
  return `${word}${n !== 1 ? 's' : ''}`;
};

// Contextualize for mined txs
export const generate = (transaction: Transaction): Transaction => {
  const decoded = decodeTransactionInputViem(
    transaction.input as HexadecimalString,
    ABIs.EAS as Abi,
  );

  switch (decoded.functionName) {
    case 'attest': {
      const args = decoded.args as [
        {
          schema: string;
          data: {
            recipient: string;
          };
        },
      ];
      const schema = args[0]?.schema;
      const recipient = args[0]?.data?.recipient;

      transaction.context = {
        variables: {
          from: {
            type: 'address',
            value: transaction.from,
          },
          schema: {
            type: 'schemaID',
            value: schema,
            link: EAS_LINKS[transaction.chainId]
              ? `${EAS_LINKS[transaction.chainId]}/${schema}`
              : '',
          },
          recipient: {
            type: 'address',
            value: recipient,
          },
          attested: {
            type: 'contextAction',
            value: 'ATTESTED',
          },
        },
        summaries: {
          category: 'PROTOCOL_1',
          en: {
            title: 'EAS',
            default: recipient
              ? '[[from]] [[attested]] to [[recipient]] with schema [[schema]]'
              : '[[from]] [[attested]] with schema [[schema]]',
          },
        },
      };
      return transaction;
    }

    case 'attestByDelegation': {
      const args = decoded.args as [
        {
          schema: string;
          attester: string;
          data: {
            recipient: string;
          };
        },
      ];
      const schema = args[0]?.schema;
      const attester = args[0]?.attester;
      const recipient = args[0]?.data?.recipient;

      transaction.context = {
        variables: {
          from: {
            type: 'address',
            value: transaction.from,
          },
          attester: {
            type: 'address',
            value: attester,
          },
          schema: {
            type: 'schemaID',
            value: schema,
            link: EAS_LINKS[transaction.chainId]
              ? `${EAS_LINKS[transaction.chainId]}/${schema}`
              : '',
          },
          recipient: {
            type: 'address',
            value: recipient,
          },
          attested: {
            type: 'contextAction',
            value: 'ATTESTED',
          },
        },
        summaries: {
          category: 'PROTOCOL_1',
          en: {
            title: 'EAS',
            default: recipient
              ? '[[attester]] [[attested]] to [[recipient]] with schema [[schema]] by delegation via [[from]]'
              : '[[attester]] [[attested]] with schema [[schema]] by delegation via [[from]]',
          },
        },
      };
      return transaction;
    }

    case 'multiAttest': {
      const args = decoded.args as [
        [
          {
            schema: string;
            data: [
              {
                recipient: string;
              },
            ];
          },
        ],
      ];
      const schemas = args[0].length;
      const count = args[0].map((v) => v.data).flat().length;

      transaction.context = {
        variables: {
          from: {
            type: 'address',
            value: transaction.from,
          },
          schemas: {
            type: 'string',
            value: schemas.toString(),
            emphasis: true,
          },
          count: {
            type: 'string',
            value: count.toString(),
            emphasis: true,
          },
          attested: {
            type: 'contextAction',
            value: 'ATTESTED',
          },
        },
        summaries: {
          category: 'PROTOCOL_1',
          en: {
            title: 'EAS',
            default: `[[from]] [[attested]] [[count]] ${pluralize(
              'time',
              count,
            )} with [[schemas]] ${pluralize('schema', schemas)}`,
          },
        },
      };
      return transaction;
    }

    case 'multiAttestByDelegation': {
      const args = decoded.args as [
        [
          {
            schema: string;
            attester: string;
            data: [
              {
                recipient: string;
              },
            ];
          },
        ],
      ];
      const schemas = args[0].length;
      const attesters = Array.from(
        new Set(args[0].map((v) => v.attester)),
      ).length;
      const count = args[0].map((v) => v.data).flat().length;

      transaction.context = {
        variables: {
          from: {
            type: 'address',
            value: transaction.from,
          },
          attesters: {
            type: 'string',
            value: attesters.toString(),
            emphasis: true,
          },
          schemas: {
            type: 'string',
            emphasis: true,
            value: schemas.toString(),
          },
          count: {
            type: 'string',
            emphasis: true,
            value: count.toString(),
          },
          attested: {
            type: 'contextAction',
            value: 'ATTESTED',
          },
        },
        summaries: {
          category: 'PROTOCOL_1',
          en: {
            title: 'EAS',
            default: `[[attesters]] ${pluralize(
              'account',
              attesters,
            )} [[attested]] [[count]] ${pluralize(
              'time',
              count,
            )} with [[schemas]] ${pluralize(
              'schema',
              schemas,
            )} by delegation via [[from]]`,
          },
        },
      };
      return transaction;
    }

    case 'revoke': {
      const args = decoded.args as [
        {
          schema: string;
        },
      ];
      const schema = args[0].schema;

      transaction.context = {
        variables: {
          from: {
            type: 'address',
            value: transaction.from,
          },
          schema: {
            type: 'schemaID',
            value: schema,
            link: EAS_LINKS[transaction.chainId]
              ? `${EAS_LINKS[transaction.chainId]}/${schema}`
              : '',
          },
          revoked: {
            type: 'contextAction',
            value: 'REVOKED',
          },
        },
        summaries: {
          category: 'PROTOCOL_1',
          en: {
            title: 'EAS',
            default:
              '[[from]] [[revoked]] an attestation with schema [[schema]]',
          },
        },
      };
      return transaction;
    }

    case 'revokeByDelegation': {
      const args = decoded.args as [
        {
          schema: string;
          revoker: string;
        },
      ];
      const { schema, revoker } = args[0];

      transaction.context = {
        variables: {
          from: {
            type: 'address',
            value: transaction.from,
          },
          schema: {
            type: 'schemaID',
            value: schema,
            link: EAS_LINKS[transaction.chainId]
              ? `${EAS_LINKS[transaction.chainId]}/${schema}`
              : '',
          },
          revoker: {
            type: 'address',
            value: revoker,
          },
          revoked: {
            type: 'contextAction',
            value: 'REVOKED',
          },
        },
        summaries: {
          category: 'PROTOCOL_1',
          en: {
            title: 'EAS',
            default:
              '[[revoker]] [[revoked]] an attestation with schema [[schema]] by delegation via [[from]]',
          },
        },
      };
      return transaction;
    }

    case 'multiRevoke': {
      const args = decoded.args as [
        [
          {
            schema: string;
            data: [
              {
                recipient: string;
              },
            ];
          },
        ],
      ];
      const schemas = args[0].length;
      const count = args[0].map((v) => v.data).flat().length;

      transaction.context = {
        variables: {
          from: {
            type: 'address',
            value: transaction.from,
          },
          schema: {
            type: 'schemaID',
            value: schemas.toString(),
            link: EAS_LINKS[transaction.chainId]
              ? `${EAS_LINKS[transaction.chainId]}/${schemas.toString()}`
              : '',
          },
          count: {
            type: 'string',
            emphasis: true,
            value: count.toString(),
          },
          revoked: {
            type: 'contextAction',
            value: 'REVOKED',
          },
        },
        summaries: {
          category: 'PROTOCOL_1',
          en: {
            title: 'EAS',
            default: `[[from]] [[revoked]] [[count]] ${pluralize(
              'attestation',
              count,
            )} with [[schemas]] ${pluralize('schema', schemas)}`,
          },
        },
      };
      return transaction;
    }

    case 'multiRevokeByDelegation': {
      const args = decoded.args as [
        [
          {
            schema: string;
            revoker: string;
            data: {
              recipient: string;
            };
          },
        ],
      ];
      const schemas = args[0].length;
      const revokers = Array.from(
        new Set(args[0].map((v) => v.revoker)),
      ).length;
      const count = args[0].map((v) => v.data).flat().length;

      transaction.context = {
        variables: {
          from: {
            type: 'address',
            value: transaction.from,
          },
          schemas: {
            type: 'string',
            emphasis: true,
            value: schemas.toString(),
          },
          count: {
            type: 'string',
            emphasis: true,
            value: count.toString(),
          },
          revokers: {
            type: 'address',
            value: revokers.toString(),
          },
          revoked: {
            type: 'contextAction',
            value: 'REVOKED',
          },
        },
        summaries: {
          category: 'PROTOCOL_1',
          en: {
            title: 'EAS',
            default: `[[revokers]] ${pluralize(
              'account',
              revokers,
            )} [[revoked]] [[count]] ${pluralize(
              'attestation',
              count,
            )} with [[schemas]] ${pluralize(
              'schema',
              schemas,
            )} by delegation via [[from]]`,
          },
        },
      };
      return transaction;
    }

    case 'timestamp': {
      transaction.context = {
        variables: {
          from: {
            type: 'address',
            value: transaction.from,
          },
          timestamped: {
            type: 'contextAction',
            value: 'TIMESTAMPED',
          },
        },
        summaries: {
          category: 'PROTOCOL_1',
          en: {
            title: 'EAS',
            default: '[[from]] [[timestamped]] data',
          },
        },
      };
      return transaction;
    }

    case 'multiTimestamp': {
      const args = decoded.args as [
        {
          data: [
            {
              recipient: string;
            },
          ];
        },
      ];
      const data = args[0]?.data;
      transaction.context = {
        variables: {
          from: {
            type: 'address',
            value: transaction.from,
          },
          count: {
            type: 'string',
            emphasis: true,
            value: data.length.toString(),
          },
          timestamped: {
            type: 'contextAction',
            value: 'TIMESTAMPED',
          },
        },
        summaries: {
          category: 'PROTOCOL_1',
          en: {
            title: 'EAS',
            default: '[[from]] [[timestamped]] [[count]] data',
          },
        },
      };
      return transaction;
    }

    case 'revokeOffchain': {
      transaction.context = {
        variables: {
          from: {
            type: 'address',
            value: transaction.from,
          },
          revoked: {
            type: 'contextAction',
            value: 'REVOKED',
          },
        },
        summaries: {
          category: 'PROTOCOL_1',
          en: {
            title: 'EAS',
            default: '[[from]] [[revoked]] offchain data',
          },
        },
      };
      return transaction;
    }

    case 'multiRevokeOffChain': {
      const args = decoded.args as [
        {
          data: [
            {
              recipient: string;
            },
          ];
        },
      ];
      const data = args[0]?.data;
      transaction.context = {
        variables: {
          from: {
            type: 'address',
            value: transaction.from,
          },
          count: {
            type: 'string',
            emphasis: true,
            value: data.length.toString(),
          },
          revoked: {
            type: 'contextAction',
            value: 'REVOKED',
          },
        },
        summaries: {
          category: 'PROTOCOL_1',
          en: {
            title: 'EAS',
            default: '[[from]] [[revoked]] [[count]] offchain data',
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
