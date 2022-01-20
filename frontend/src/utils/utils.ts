import { supportedChains } from 'src/components/models';
import { BigNumber, BigNumberish, hexValue, parseUnits, formatUnits } from './ethers';

/**
 * @notice Generates the Etherscan URL based on the given `txHash` or `address and `chainId`
 */
export const getEtherscanUrl = (txHashOrAddress: string, chainId: number) => {
  const group = txHashOrAddress.length === 42 ? 'address' : 'tx';
  const chain = getChainById(chainId);
  const networkPrefix = chain?.blockExplorerUrls?.length ? chain?.blockExplorerUrls[0] : 'https://etherscan.io';
  return `${networkPrefix}/${group}/${txHashOrAddress}`;
};

/**
 * @notice Gets `Chain` based on the given `chainId`
 */
export const getChainById = (chainId: BigNumberish) => {
  return supportedChains.find((chain) => chain.chainId === hexValue(chainId));
};

/**
 * @notice Rounds `value` to the specified number of `decimals` and returns a string
 */
export const round = (value: number | string, decimals = 2) => {
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
};

/**
 * @notice Rounds to appropriate human readable decimals for the token
 * @dev This is very fragile and should be replace with something robust, i.e. something that walks
 * value and rounds considering sig-figs or similar
 */
export const roundTokenAmount = (amount: BigNumberish, token: { decimals: number; address: string }): string => {
  const formatted = formatUnits(amount, token.decimals);
  // WETH on Polygon
  const isWeth = token.address === '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619';
  if (isWeth) {
    return round(formatted, 6);
  } else {
    return round(formatted, 2);
  }
};

/**
 * @notice GETs JSON from the provided `url`
 */
export const jsonFetch = (url: string) => fetch(url).then((res) => res.json());

// Shape of data returned from the TxPrice API
type TxPriceResponse = {
  system: string;
  network: string;
  unit: string;
  maxPrice: number;
  currentBlockNumber: number;
  msSinceLastBlock: number;
  blockPrices: BlockPrice[];
};

type BlockPrice = {
  blockNumber: number;
  baseFeePerGas: number;
  estimatedTransactionCount: number;
  estimatedPrices: EstimatedPrice[];
};

type EstimatedPrice = {
  confidence: number;
  price: number;
  maxPriorityFeePerGas: number;
  maxFeePerGas: number;
};

// Valid confidence values
type TxPriceConfidence = 99 | 95 | 90 | 80 | 70;

/**
 * @notice Gets the current gas price via TxPrice API
 * @param gasPriceConfidence probability of transaction being confirmed
 */
export const getGasPrice = async (gasPriceConfidence: TxPriceConfidence = 99): Promise<BigNumber> => {
  try {
    const response: TxPriceResponse = await jsonFetch('https://api.TxPrice.com/');
    const estimatedPrice = response.blockPrices[0]?.estimatedPrices?.find(
      (price) => price.confidence === gasPriceConfidence
    );
    const gasPriceInGwei = estimatedPrice?.price;
    if (!gasPriceInGwei) throw new Error('API did not return a valid gas price');

    const gasPriceInWei = parseUnits(String(gasPriceInGwei), 'gwei');
    return BigNumber.from(gasPriceInWei);
  } catch (e) {
    const message = (e as { message: string }).message;
    throw new Error(`Error fetching gas price from TxPrice API: ${message}`);
  }
};
