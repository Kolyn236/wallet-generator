import { LITECOIN_MAINNET_P2PKH_PROFILE } from './litecoin';
import {
  buildSignedUtxoP2pkhTransfer,
  type SignedUtxoP2pkhTransfer,
  type UtxoP2pkhUtxo,
} from './utxoP2pkhTransaction';

export type LitecoinUtxo = UtxoP2pkhUtxo;
export type SignedLitecoinTransfer = SignedUtxoP2pkhTransfer;

export function buildSignedLitecoinTransfer(params: {
  wif: string;
  sourceAddress: string;
  recipientAddress: string;
  amount: string;
  feeRateLtcPerKb: string;
  utxos: LitecoinUtxo[];
}): SignedLitecoinTransfer {
  return buildSignedUtxoP2pkhTransfer(LITECOIN_MAINNET_P2PKH_PROFILE, {
    wif: params.wif,
    sourceAddress: params.sourceAddress,
    recipientAddress: params.recipientAddress,
    amount: params.amount,
    feeRatePerKb: params.feeRateLtcPerKb,
    utxos: params.utxos,
  });
}
