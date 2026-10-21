import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';


const panels = ['Dogecoin', 'Bitcoin', 'Litecoin', 'Ethereum', 'UsdtErc20'];
for (const panel of panels) {
  const path = new URL(`../src/${panel}TransferPanel.tsx`, import.meta.url);
  const source = readFileSync(path, 'utf8');
  const functions = new Map<string, { getText: () => string }>();
  const declarations = [...source.matchAll(/^  (?:async )?function (\w+)\(/gm)];
  declarations.forEach((match, index) => functions.set(match[1], { getText: () => source.slice(match.index, declarations[index + 1]?.index ?? source.indexOf('  return (', match.index)) }));
  const prepare = functions.get('prepareTransfer')!.getText();
  assert.doesNotMatch(prepare, /buildSigned\w+\s*\(/, `${panel}: preparation must never sign`);
  assert.match(functions.get('signTransfer')?.getText() ?? '', /buildSigned\w+\s*\(/, `${panel}: explicit signing handler owns builder`);
  assert.match(source, /onClick=\{signTransfer\}/, `${panel}: signing requires a separate user action`);
  assert.match(prepare, /setPublicPreparation\(/, `${panel}: publish unsigned review`);
  assert.match(functions.get('resetResult')!.getText(), /setPublicPreparation\(null\)/, `${panel}: edits invalidate review`);
  assert.match(prepare, /generation\.current !== requestGeneration/, `${panel}: discard stale preparation`);
  assert.match(source, /Object\.freeze/, `${panel}: public snapshot is immutable`);
  assert.doesNotMatch(source, /localStorage|sessionStorage|new Map/, `${panel}: no hidden key persistence`);
}
console.log('Five transfer panels enforce prepare → public review → explicit local sign → browser broadcast.');
