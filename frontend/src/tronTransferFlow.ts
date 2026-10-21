import { broadcastSignedTransaction, type BroadcastDestination } from './broadcast/browserBroadcast';
import { getTronTransactionStatus, prepareTronTransaction, type TronTransactionStatus } from './tronApi';
import { parseUsdtTrc20Amount } from './wallet/tron';
import { buildSignedTronTransfer, prepareUnsignedTronTransfer, type SignedTronTransfer, type UnsignedTronTransfer } from './wallet/tronTransaction';
import type { WalletMode } from './runtime/WalletNetworkAdapter';

export type TronFlowSnapshot = Readonly<{
  phase: 'idle' | 'preparing' | 'review' | 'signed' | 'broadcasting' | 'submitted';
  review: Readonly<UnsignedTronTransfer> | null; signed: Readonly<SignedTronTransfer> | null;
  status: TronTransactionStatus | null; checking: boolean; error: string | null;
}>;
type Dependencies = {prepare: typeof prepareTronTransaction; broadcast: typeof broadcastSignedTransaction; status: typeof getTronTransactionStatus; now: () => number};
const empty: TronFlowSnapshot = Object.freeze({phase: 'idle', review: null, signed: null, status: null, checking: false, error: null});

/** One ephemeral public transfer flow. Keys are passed only to the explicit synchronous sign action. */
export function createTronTransferFlow(dependencies: Partial<Dependencies> = {}) {
  const deps: Dependencies = {prepare: prepareTronTransaction, broadcast: broadcastSignedTransaction, status: getTronTransactionStatus, now: Date.now, ...dependencies};
  let snapshot = empty;
  let generation = 0;
  const listeners = new Set<() => void>();
  function update(patch: Partial<TronFlowSnapshot>) { snapshot = Object.freeze({...snapshot, ...patch}); listeners.forEach(listener => listener()); }
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    reset() { generation++; snapshot = empty; listeners.forEach(listener => listener()); },
    async prepare(sourceAddress: string, recipientAddress: string, amount: string) {
      const current = ++generation;
      update({...empty, phase: 'preparing'});
      try {
        const p = await deps.prepare({assetRouteId: 'usdt-tron-mainnet-trc20', from: sourceAddress, to: recipientAddress, amountBaseUnits: parseUsdtTrc20Amount(amount)});
        if (current !== generation) return;
        const review = Object.freeze(prepareUnsignedTronTransfer({sourceAddress, recipientAddress, amount, prepared: p, nowMs: deps.now()}));
        update({review, phase: 'review'});
      } catch (error) { if (current === generation) update({phase: 'idle', error: code(error)}); }
    },
    sign(privateKey: string, mode: WalletMode) {
      const review = snapshot.review;
      if (!review || snapshot.phase !== 'review') return;
      if (mode !== 'local-signing') { update({error: 'watch_only'}); return; }
      try {
        const signed = buildSignedTronTransfer({privateKey, sourceAddress: review.from, recipientAddress: review.to, amount: review.amount, prepared: review, nowMs: deps.now()});
        if (signed.txId !== review.txId || signed.rawDataHex !== review.rawDataHex) throw new Error('prepared_transaction_mismatch');
        update({signed: Object.freeze(signed), phase: 'signed', error: null});
      } catch (error) { update({error: code(error)}); }
    },
    async broadcast(destination: BroadcastDestination) {
      const current = generation;
      const signed = snapshot.signed;
      if (!signed || snapshot.phase !== 'signed') return;
      if (BigInt(signed.expirationMs) <= BigInt(deps.now())) { update({error: 'stale_preparation'}); return; }
      update({phase: 'broadcasting', error: null});
      try {
        if (destination.kind !== 'tron-http') throw new Error('invalid_destination');
        const result = await deps.broadcast(destination, {rawTransaction: signed.rawTransactionHex, txid: signed.txId});
        if (current !== generation) return;
        if (result.txid.toLowerCase() !== signed.txId) throw new Error('broadcast_identity_mismatch');
        update({phase: 'submitted'});
      } catch { if (current === generation) update({phase: 'signed', error: 'broadcast_failed'}); }
    },
    async checkStatus() {
      const current = generation;
      const txId = snapshot.signed?.txId;
      if (!txId || snapshot.checking) return;
      update({checking: true, error: null});
      try {
        const status = await deps.status(txId);
        if (current === generation) update({status, checking: false,
          error: status.state === 'unknown' && snapshot.signed
            && BigInt(snapshot.signed.expirationMs) <= BigInt(deps.now()) ? 'expired_unknown' : null});
      } catch { if (current === generation) update({checking: false, error: 'status_failed'}); }
    },
  };
}
function code(error: unknown): string { return error instanceof Error ? error.message : 'prepare_failed'; }
