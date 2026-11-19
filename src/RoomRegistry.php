<?php

namespace Ernestdefoe\Parley;

/**
 * What other extensions add to rooms, registered once per container (a
 * singleton, see ParleyServiceProvider) rather than in static arrays that
 * outlive a request in queue workers and tests.
 *
 * Register from a service provider's boot():
 *
 *     $this->container->make(RoomRegistry::class)->addCardExtender(fn (array $cards, ?User $viewer) => ...);
 *     $this->container->make(RoomRegistry::class)->addOwner('my-extension', fn (object $room, User $actor) => ...);
 *
 * Rooms::$cardExtenders and Rooms::$owners are still read here, so an
 * extension written before this class (Parley Calls up to now) keeps
 * working; they are deprecated and will go in Parley 2.
 */
class RoomRegistry
{
    /** @var list<callable> */
    private array $cardExtenders = [];

    /** @var array<string, callable> */
    private array $owners = [];

    /**
     * Something that adds to room cards, given the whole list at once so it
     * can answer in one query: fn (array $cards, User|null $viewer): array.
     */
    public function addCardExtender(callable $extender): void
    {
        $this->cardExtenders[] = $extender;
    }

    /**
     * Rooms created with this `owner` belong to the caller: fn (object $room,
     * User $actor): bool decides who may see one (see Rooms::canView()).
     */
    public function addOwner(string $owner, callable $canView): void
    {
        $this->owners[$owner] = $canView;
    }

    /** @return list<callable> */
    public function cardExtenders(): array
    {
        return [...$this->cardExtenders, ...array_values(Rooms::$cardExtenders)];
    }

    public function owner(string $owner): ?callable
    {
        return $this->owners[$owner] ?? Rooms::$owners[$owner] ?? null;
    }
}
