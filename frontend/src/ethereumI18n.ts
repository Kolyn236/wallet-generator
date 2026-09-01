import type { Language } from './i18n';

export const ethereumMessages: Record<Language, {
  transferText: string;
  feeModel: string;
  privateKeyPlaceholder: string;
  privateKeyHint: string;
  privateKeyRequired: string;
  privateKeyInvalid: string;
  privateKeyMismatch: string;
  formError: string;
  preparingTransfer: string;
  transferWatchOnly: string;
  transferAnySender: string;
  prepareError: string;
  insufficientFunds: string;
  nonce: string;
  gasLimit: string;
  baseFee: string;
  priorityFee: string;
  maxFeePerGas: string;
  maxNetworkFee: string;
  maxTotal: string;
  txHash: string;
  broadcastedTxHash: string;
  recipientPlaceholder: string;
}> = {
  en: {
    transferText: 'The server provides only public Ethereum state such as pending nonce, gas estimate and EIP-1559 fee data. Your private key stays in this browser and signs the Type-2 transaction locally.',
    feeModel: 'EIP-1559 · chain ID 1 · empty access list for native ETH transfers.',
    privateKeyPlaceholder: '0x… private key for the sender address',
    privateKeyHint: 'The Ethereum private key stays in browser memory and is used only for local signing. It is never sent to the server.',
    privateKeyRequired: 'Enter the private key for the sender address.',
    privateKeyInvalid: 'Enter a valid 32-byte secp256k1 private key.',
    privateKeyMismatch: 'This private key does not belong to the sender address.',
    formError: 'Fill in valid sender, recipient and a positive ETH amount with up to 18 decimals.',
    preparingTransfer: 'Preparing EIP-1559 fees and signing…',
    transferWatchOnly: 'This Ethereum address is watch-only. To send from it, enter its matching private key in the transfer form.',
    transferAnySender: 'The transfer form can use another Ethereum sender address when you provide its matching private key.',
    prepareError: 'Could not prepare the Ethereum transaction. Check the RPC provider, sender balance and gas estimation.',
    insufficientFunds: 'The sender balance is below the ETH amount plus the maximum EIP-1559 network fee.',
    nonce: 'Pending nonce',
    gasLimit: 'Gas limit',
    baseFee: 'Base fee',
    priorityFee: 'Max priority fee',
    maxFeePerGas: 'Max fee per gas',
    maxNetworkFee: 'Maximum network fee',
    maxTotal: 'Maximum total debit',
    txHash: 'Local transaction hash',
    broadcastedTxHash: 'Broadcast transaction hash',
    recipientPlaceholder: '0x destination address',
  },
  ru: {
    transferText: 'Сервер получает только публичные параметры Ethereum: pending nonce, gas estimate и данные комиссии EIP-1559. Ваш private key остаётся в браузере и локально подписывает Type-2 транзакцию.',
    feeModel: 'EIP-1559 · chain ID 1 · пустой access list для обычного ETH-перевода.',
    privateKeyPlaceholder: '0x… private key адреса отправителя',
    privateKeyHint: 'Ethereum private key остаётся только в памяти браузера и используется для локальной подписи. На сервер он никогда не отправляется.',
    privateKeyRequired: 'Укажите private key адреса отправителя.',
    privateKeyInvalid: 'Укажите корректный 32-байтовый secp256k1 private key.',
    privateKeyMismatch: 'Этот private key не соответствует адресу отправителя.',
    formError: 'Укажите корректные адреса и положительную сумму ETH не более чем с 18 знаками после запятой.',
    preparingTransfer: 'Получаем EIP-1559 параметры и подписываем…',
    transferWatchOnly: 'Этот Ethereum-адрес подключён только для просмотра. Для отправки укажите соответствующий private key в форме перевода.',
    transferAnySender: 'В форме можно указать другой Ethereum-адрес отправителя и соответствующий ему private key.',
    prepareError: 'Не удалось подготовить Ethereum-транзакцию. Проверьте RPC-провайдер, баланс отправителя и gas estimation.',
    insufficientFunds: 'Баланса отправителя недостаточно для суммы ETH и максимальной EIP-1559 комиссии.',
    nonce: 'Pending nonce',
    gasLimit: 'Gas limit',
    baseFee: 'Base fee',
    priorityFee: 'Max priority fee',
    maxFeePerGas: 'Max fee per gas',
    maxNetworkFee: 'Максимальная комиссия',
    maxTotal: 'Максимальное списание',
    txHash: 'Локальный hash транзакции',
    broadcastedTxHash: 'Hash транзакции в сети',
    recipientPlaceholder: '0x адрес назначения',
  },
};
