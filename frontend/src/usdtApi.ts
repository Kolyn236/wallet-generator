import { WalletApiError } from './api';
import { USDT_ERC20_CONTRACT, USDT_ERC20_DECIMALS } from './wallet/usdtErc20';

export type UsdtErc20BalanceResponse = {
  chain: 'ethereum';
  network: 'mainnet';
  asset: 'usdt';
  standard: 'erc20';
  contractAddress: string;
  address: string;
  balance: string;
  balanceSmallestUnit: string;
  decimals: 6;
  unit: 'USDT';
};

type ApiErrorResponse = {
  error?: string;
  reason?: string;
};

export async function getUsdtErc20Balance(
  address: string,
  signal?: AbortSignal,
): Promise<UsdtErc20BalanceResponse> {
  const response = await fetch(
    `/api/chains/ethereum/mainnet/tokens/usdt/addresses/${encodeURIComponent(address)}/balance`,
    {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal,
    },
  );

  if (!response.ok) {
    let details: ApiErrorResponse = {};
    try {
      details = (await response.json()) as ApiErrorResponse;
    } catch {
      // HTTP status still classifies the failure.
    }

    throw new WalletApiError(
      `USDT ERC-20 balance lookup failed with HTTP ${response.status}.`,
      response.status,
      details.error,
      details.reason,
    );
  }

  const result = (await response.json()) as UsdtErc20BalanceResponse;
  if (result.chain !== 'ethereum'
    || result.network !== 'mainnet'
    || result.asset !== 'usdt'
    || result.standard !== 'erc20'
    || result.contractAddress.toLowerCase() !== USDT_ERC20_CONTRACT.toLowerCase()
    || result.decimals !== USDT_ERC20_DECIMALS
    || result.unit !== 'USDT'
    || result.address.toLowerCase() !== address.toLowerCase()
    || !/^(0|[1-9]\d*)$/.test(result.balanceSmallestUnit)
  ) {
    throw new Error('invalid_usdt_balance_response');
  }

  return result;
}
