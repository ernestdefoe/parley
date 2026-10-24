<?php

namespace Ernestdefoe\Parley\Tests\integration\extension;

use Flarum\Extension\ExtensionManager;
use Flarum\Testing\integration\TestCase;
use Illuminate\Contracts\Filesystem\Factory;
use Illuminate\Database\Capsule\Manager as Capsule;
use Illuminate\Filesystem\Filesystem;
use PHPUnit\Framework\Attributes\Test;

class PurgeTest extends TestCase
{
    private const PICTURE = '2026/10/0123456789abcdef0123456789abcdef.png';

    private const LOGOS = ['parley/rooms/10-0123456789ab.png', 'parley/rooms/10-dark-0123456789ab.png', 'parley/rooms/11-dark-auto-0123456789ab.png'];

    private string $storage;

    private string $assets;

    protected function setUp(): void
    {
        parent::setUp();

        $this->extension('ernestdefoe-parley');

        $this->storage = $this->tmpDir().'/storage/parley';
        $this->assets = $this->tmpDir().'/public/assets';

        $files = new Filesystem();
        $files->deleteDirectory($this->storage);
        $files->deleteDirectory($this->assets.'/parley');
        $files->ensureDirectoryExists(dirname($this->storage.'/'.self::PICTURE));
        $files->put($this->storage.'/'.self::PICTURE, 'x');
        $files->put($this->storage.'/not-ours.txt', 'x');

        $disk = $this->app()->getContainer()->make(Factory::class)->disk('flarum-assets');
        foreach (self::LOGOS as $logo) {
            $disk->put($logo, 'x');
        }
        $disk->put('parley/rooms/not-ours.png', 'x');
        $disk->put('logo-abc123.png', 'x');
    }

    protected function tearDown(): void
    {
        $files = new Filesystem();
        $files->deleteDirectory($this->storage);
        $files->deleteDirectory($this->assets.'/parley');
        $files->delete($this->assets.'/logo-abc123.png');

        parent::tearDown();
    }

    /** A migration's real down(), run on a throwaway schema: dropping the test database's table would end its transaction on MariaDB. */
    private function rollBack(string $migration, string $table): void
    {
        $migration = require __DIR__."/../../../migrations/$migration.php";
        $capsule = new Capsule();
        $capsule->addConnection(['driver' => 'sqlite', 'database' => ':memory:']);
        $schema = $capsule->getConnection()->getSchemaBuilder();
        $schema->create($table, fn ($table) => $table->increments('id'));
        $migration['down']($schema);
    }

    #[Test]
    public function purging_deletes_the_pictures_and_room_logos_it_stored_and_nothing_else()
    {
        $this->rollBack('2026_10_02_000004_create_parley_messages_table', 'parley_messages');
        $this->rollBack('2026_10_02_000002_create_parley_conversations_table', 'parley_conversations');

        $this->assertDirectoryDoesNotExist($this->storage.'/2026', 'The pictures and their folders are gone');
        $this->assertFileExists($this->storage.'/not-ours.txt', 'A file Parley did not write stays');

        foreach (self::LOGOS as $logo) {
            $this->assertFileDoesNotExist($this->assets.'/'.$logo);
        }
        $this->assertFileExists($this->assets.'/parley/rooms/not-ours.png', 'A file Parley did not write stays');
        $this->assertFileExists($this->assets.'/logo-abc123.png', "So does the forum's own logo");
    }

    #[Test]
    public function purging_removes_the_folders_it_empties()
    {
        $files = new Filesystem();
        $files->delete([$this->storage.'/not-ours.txt', $this->assets.'/parley/rooms/not-ours.png']);

        $this->rollBack('2026_10_02_000004_create_parley_messages_table', 'parley_messages');
        $this->rollBack('2026_10_02_000002_create_parley_conversations_table', 'parley_conversations');

        $this->assertDirectoryDoesNotExist($this->storage);
        $this->assertDirectoryDoesNotExist($this->assets.'/parley');
    }

    #[Test]
    public function disabling_keeps_the_files()
    {
        $this->app()->getContainer()->make(ExtensionManager::class)->disable('ernestdefoe-parley');

        $this->assertFileExists($this->storage.'/'.self::PICTURE);
        foreach (self::LOGOS as $logo) {
            $this->assertFileExists($this->assets.'/'.$logo);
        }
    }
}
