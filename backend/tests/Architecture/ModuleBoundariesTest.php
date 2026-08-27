<?php

declare(strict_types=1);

namespace App\Tests\Architecture;

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class ModuleBoundariesTest extends TestCase
{
    private const MODULES = [
        'Wallet',
        'Asset',
        'Transaction',
        'Blockchain',
        'Signer',
        'Indexer',
    ];

    private const FORBIDDEN_DOMAIN_REFERENCES = [
        'Symfony\\',
        'Doctrine\\',
        'Predis\\',
        'PhpAmqpLib\\',
        'GuzzleHttp\\',
    ];

    private const FORBIDDEN_DIRECTORY_NAMES = [
        'Service',
        'Services',
        'Helper',
        'Helpers',
        'Util',
        'Utils',
    ];

    #[DataProvider('moduleProvider')]
    public function testModuleRootExists(string $module): void
    {
        self::assertDirectoryExists(self::sourceRoot().'/'.$module);
    }

    /** @return iterable<string, array{string}> */
    public static function moduleProvider(): iterable
    {
        foreach (self::MODULES as $module) {
            yield $module => [$module];
        }
    }

    public function testDomainCodeIsFrameworkAgnostic(): void
    {
        self::addToAssertionCount(1);

        foreach (self::phpFilesBelowLayer('Domain') as $file) {
            $contents = self::read($file);

            foreach (self::FORBIDDEN_DOMAIN_REFERENCES as $forbiddenReference) {
                self::assertStringNotContainsString(
                    $forbiddenReference,
                    $contents,
                    \sprintf('%s must not reference %s from Domain.', $file->getPathname(), $forbiddenReference),
                );
            }
        }
    }

    public function testModulesDoNotImportOtherModulesInfrastructureOrPresentation(): void
    {
        self::addToAssertionCount(1);

        foreach (self::modulePhpFiles() as $file) {
            $contents = self::read($file);
            $currentModule = self::moduleFor($file);

            foreach (self::MODULES as $otherModule) {
                if ($otherModule === $currentModule) {
                    continue;
                }

                foreach (['Infrastructure', 'Presentation'] as $privateLayer) {
                    $forbiddenReference = \sprintf('App\\%s\\%s\\', $otherModule, $privateLayer);
                    self::assertStringNotContainsString(
                        $forbiddenReference,
                        $contents,
                        \sprintf('%s must not import another module private layer %s.', $file->getPathname(), $forbiddenReference),
                    );
                }
            }
        }
    }

    public function testPresentationDoesNotImportInfrastructureDirectly(): void
    {
        self::addToAssertionCount(1);

        foreach (self::phpFilesBelowLayer('Presentation') as $file) {
            $module = self::moduleFor($file);
            $forbiddenReference = \sprintf('App\\%s\\Infrastructure\\', $module);

            self::assertStringNotContainsString(
                $forbiddenReference,
                self::read($file),
                \sprintf('%s must call Application rather than Infrastructure.', $file->getPathname()),
            );
        }
    }

    public function testGenericDumpingGroundDirectoriesAreNotIntroduced(): void
    {
        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator(self::sourceRoot(), \FilesystemIterator::SKIP_DOTS),
            \RecursiveIteratorIterator::SELF_FIRST,
        );

        foreach ($iterator as $entry) {
            if (!$entry->isDir()) {
                continue;
            }

            self::assertNotContains(
                $entry->getBasename(),
                self::FORBIDDEN_DIRECTORY_NAMES,
                \sprintf('Use a capability-specific directory name instead of %s.', $entry->getPathname()),
            );
        }
    }

    private static function sourceRoot(): string
    {
        return \dirname(__DIR__, 2).'/src';
    }

    /** @return iterable<\SplFileInfo> */
    private static function modulePhpFiles(): iterable
    {
        foreach (self::MODULES as $module) {
            $moduleRoot = self::sourceRoot().'/'.$module;
            if (!is_dir($moduleRoot)) {
                continue;
            }

            yield from self::phpFiles($moduleRoot);
        }
    }

    /** @return iterable<\SplFileInfo> */
    private static function phpFilesBelowLayer(string $layer): iterable
    {
        foreach (self::MODULES as $module) {
            $layerRoot = self::sourceRoot().'/'.$module.'/'.$layer;
            if (!is_dir($layerRoot)) {
                continue;
            }

            yield from self::phpFiles($layerRoot);
        }
    }

    /** @return iterable<\SplFileInfo> */
    private static function phpFiles(string $root): iterable
    {
        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($root, \FilesystemIterator::SKIP_DOTS),
        );

        foreach ($iterator as $file) {
            if ($file instanceof \SplFileInfo && $file->isFile() && 'php' === $file->getExtension()) {
                yield $file;
            }
        }
    }

    private static function moduleFor(\SplFileInfo $file): string
    {
        $relative = substr($file->getPathname(), \strlen(self::sourceRoot()) + 1);
        $module = strtok($relative, \DIRECTORY_SEPARATOR);

        self::assertIsString($module);

        return $module;
    }

    private static function read(\SplFileInfo $file): string
    {
        $contents = file_get_contents($file->getPathname());
        self::assertIsString($contents);

        return $contents;
    }
}
