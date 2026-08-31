<?php

declare(strict_types=1);

namespace App\Blockchain\Application;

interface UtxoLookupCapability
{
    /**
     * @return list<object>
     */
    public function getConfirmedUtxos(string $address): array;
}
