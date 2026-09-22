<?php

declare(strict_types=1);
namespace App\Blockchain\Infrastructure;
use App\Blockchain\Application\ChainAdapter;
use App\Blockchain\Application\TronReadProvider;
final readonly class TronMainnetAdapter implements ChainAdapter
{
 public function __construct(public TronReadProvider $provider) {}
 public function chain(): string { return 'tron'; }
 public function network(): string { return 'mainnet'; }
}
