import type { Language } from './i18n';

export const usdtMessages: Record<Language, {
  transferText: string;
  feeModel: string;
  formError: string;
  preparingTransfer: string;
  insufficientTokenFunds: string;
  insufficientEthForGas: string;
  tokenBalanceError: string;
  prepareError: string;
  amountLabel: string;
  contractLabel: string;
  networkFeeLabel: string;
  ethGasNotice: string;
}> = {
  en: {
    transferText: 'USDT uses the same Ethereum wallet identity as ETH. The browser builds ERC-20 transfer calldata, Symfony prepares public gas/nonce/fee data, and the private key signs locally.',
    feeModel: 'USDT ERC-20 · Ethereum Mainnet · network fees are paid in ETH.',
    formError: 'Fill in valid sender, recipient and a positive USDT amount with up to 6 decimals.',
    preparingTransfer: 'Checking USDT balance, estimating gas and signing…',
    insufficientTokenFunds: 'The sender does not have enough USDT for this transfer.',
    insufficientEthForGas: 'The sender does not have enough ETH for the maximum EIP-1559 network fee.',
    tokenBalanceError: 'Could not load the USDT ERC-20 balance.',
    prepareError: 'Could not prepare the USDT ERC-20 transaction. Check the Ethereum RPC provider and gas estimation.',
    amountLabel: 'USDT amount',
    contractLabel: 'Token contract',
    networkFeeLabel: 'Maximum network fee',
    ethGasNotice: 'The token amount is paid in USDT; Ethereum gas is paid separately in ETH.',
  },
  ru: {
    transferText: 'USDT использует тот же Ethereum-кошелёк, что и ETH. Браузер собирает calldata ERC-20 transfer, Symfony получает публичные gas/nonce/fee параметры, а private key подписывает транзакцию локально.',
    feeModel: 'USDT ERC-20 · Ethereum Mainnet · комиссия сети оплачивается в ETH.',
    formError: 'Укажите корректные адреса и положительную сумму USDT не более чем с 6 знаками после запятой.',
    preparingTransfer: 'Проверяем USDT, оцениваем gas и подписываем…',
    insufficientTokenFunds: 'На адресе недостаточно USDT для этого перевода.',
    insufficientEthForGas: 'На адресе недостаточно ETH для максимальной EIP-1559 комиссии.',
    tokenBalanceError: 'Не удалось получить баланс USDT ERC-20.',
    prepareError: 'Не удалось подготовить USDT ERC-20 транзакцию. Проверьте Ethereum RPC-провайдер и gas estimation.',
    amountLabel: 'Сумма USDT',
    contractLabel: 'Контракт токена',
    networkFeeLabel: 'Максимальная комиссия сети',
    ethGasNotice: 'Сумма перевода списывается в USDT, а gas Ethereum оплачивается отдельно в ETH.',
  },
};
