import {
  formatEther,
  Abi,
  decodeFunctionData,
  decodeEventLog,
  Hex,
  parseAbi,
} from 'viem';
import {
  TransactionContextType,
  Transaction,
  ContextSummaryVariableType,
  EventLogTopics,
} from '../types';

const VALID_CHARS =
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890.? ';

export const hexToString = (str: string) => {
  const buf = Buffer.from(str, 'hex');
  return buf.toString('utf8');
};

export const countValidChars = (stringToCount: string) => {
  let count = 0;
  for (let i = 0; i < stringToCount.length; i++) {
    if (VALID_CHARS.indexOf(stringToCount[i]) >= 0) {
      count++;
    }
  }
  return count;
};

export function shortenTxHash(hash: string): string {
  if (hash.length <= 10) return hash;
  return hash.substr(0, 6) + hash.substr(-4);
}

export function decodeTransactionInput<TAbi extends Abi>(
  input: Hex,
  abi: TAbi,
) {
  return decodeFunctionData({
    abi,
    data: input,
  });
}

export function decodeFunction(input: Hex, functionSig: string[]) {
  const abi = parseAbi(functionSig);
  return decodeFunctionData({
    abi,
    data: input,
  });
}

export function decodeLog<TAbi extends Abi>(
  abi: TAbi,
  data: Hex,
  topics: EventLogTopics,
) {
  return decodeEventLog({
    abi,
    data,
    topics,
  });
}

export function contextSummary(context: TransactionContextType): string {
  const summaryTemplate = context.summaries.en.default;
  if (!summaryTemplate) return null;

  const regex = /(\[\[.*?\]\])/;
  const parts = summaryTemplate.split(regex).filter((x) => x);

  const formattedParts = parts.map((part) => {
    if (isVariable(part)) {
      const variableName = part.slice(2, -2);

      const varContext =
        context.variables[variableName] ||
        context.summaries.en.variables[variableName];
      return formatSection(varContext);
    } else {
      return part;
    }
  });

  return formattedParts.join('');
}

function isVariable(str: string) {
  return str.startsWith('[[') && str.endsWith(']]');
}

function formatSection(section: ContextSummaryVariableType) {
  const varContext = section;
  const unit = varContext['unit'];

  if (varContext?.type === 'eth')
    return `${formatEther(BigInt(varContext?.value))}${unit ? ` ETH` : ''}`;

  if (varContext?.type === 'erc721') {
    return `${varContext.token} #${varContext.tokenId}`;
  }

  if (varContext?.type === 'erc1155') {
    return `${varContext.value} ${varContext.token} #${varContext.tokenId}`;
  }

  if (varContext?.type === 'erc20')
    return `${varContext.value} ${varContext.token}`;

  return `${varContext.value}${unit ? ` ${unit}` : ''}`;
}

export const makeContextualize = (
  children: Record<string, (transaction: Transaction) => Transaction>,
) => {
  return (transaction: Transaction): Transaction => {
    for (const childContextualizer of Object.values(children)) {
      const result = childContextualizer(transaction);
      if (result.context?.summaries?.en.title) {
        return result;
      }
    }
    return transaction;
  };
};
