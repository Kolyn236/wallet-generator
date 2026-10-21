export const transferReviewMessages = {
  en: {
    prepare: 'Prepare for review', review: 'Unsigned public review', sign: 'Sign locally',
    unsigned: 'No transaction has been signed or broadcast. Review these public details before signing locally.',
    provisional: 'Provisional UTXO review: confirmed inputs below are available for selection. Exact selected inputs, fee and change depend on signature size and appear after signing; review them again before broadcast.',
    inputs: 'Confirmed available inputs (outpoint · smallest units · confirmations · script)', total: 'Confirmed UTXO total (smallest units)',
    balance: 'Native ETH capacity (wei)', maxFee: 'Maximum network fee (wei)', totalCost: 'Maximum native debit (wei)',
    contract: 'Transaction target / contract', data: 'Calldata', value: 'Native value (wei)', tokenBalance: 'Token balance (smallest units)',
    tokenAmount: 'Token amount (smallest units)', chainId: 'Chain ID',
  },
  ru: {
    prepare: 'Подготовить к проверке', review: 'Проверка неподписанных публичных данных', sign: 'Подписать локально',
    unsigned: 'Транзакция ещё не подписана и не отправлена. Проверьте публичные данные перед локальной подписью.',
    provisional: 'Предварительная проверка UTXO: ниже подтверждённые входы, доступные для выбора. Точные выбранные входы, комиссия и сдача зависят от размера подписи и появятся после подписания; проверьте их снова перед отправкой.',
    inputs: 'Доступные подтверждённые входы (выход · минимальные единицы · подтверждения · скрипт)', total: 'Сумма подтверждённых UTXO (минимальные единицы)',
    balance: 'Доступный баланс ETH (wei)', maxFee: 'Максимальная комиссия сети (wei)', totalCost: 'Максимальное списание ETH (wei)',
    contract: 'Адрес транзакции / контракт', data: 'Данные вызова', value: 'Сумма ETH (wei)', tokenBalance: 'Баланс токена (минимальные единицы)',
    tokenAmount: 'Сумма токена (минимальные единицы)', chainId: 'ID сети',
  },
} as const;
