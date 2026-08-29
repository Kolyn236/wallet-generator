<?php

declare(strict_types=1);

namespace App\Blockchain\Application;

interface ChainAdapter
{
    public function chain(): string;

    public function network(): string;
}
