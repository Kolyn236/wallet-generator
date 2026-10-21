<?php

declare(strict_types=1);

namespace App\Blockchain\Application;

interface TronPreparationCapability
{
    /** @param array<string,mixed> $input
     * @return array<string,mixed>
     */
    public function prepareTransfer(array $input): array;
}
