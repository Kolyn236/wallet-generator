<?php

declare(strict_types=1);

namespace App\Presentation\Http;

use Symfony\Component\EventDispatcher\EventSubscriberInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpKernel\Event\RequestEvent;
use Symfony\Component\HttpKernel\KernelEvents;

final readonly class ApiRateLimitSubscriber implements EventSubscriberInterface
{
    /**
     * @param array<string, string> $routePolicies
     */
    public function __construct(
        private ApiRateLimiter $limiter,
        private ApiAbuseLogger $logger,
        private array $routePolicies,
    ) {
    }

    /** @return array<string, array{0: string, 1: int}> */
    public static function getSubscribedEvents(): array
    {
        return [
            KernelEvents::REQUEST => ['onKernelRequest', 0],
        ];
    }

    public function onKernelRequest(RequestEvent $event): void
    {
        if (!$event->isMainRequest()) {
            return;
        }

        $request = $event->getRequest();
        $route = $request->attributes->get('_route');
        if (!\is_string($route)) {
            return;
        }

        $policy = $this->routePolicies[$route] ?? null;
        if (null === $policy) {
            return;
        }

        $startedAt = hrtime(true);
        $decision = $this->limiter->consume($policy, $request->getClientIp() ?? 'unknown');
        if ($decision->accepted) {
            return;
        }

        $durationMs = round((hrtime(true) - $startedAt) / 1_000_000, 2);
        $this->logger->rateLimited($request, $route, $policy, $decision->retryAfterSeconds, $durationMs);

        $event->setResponse(new JsonResponse([
            'error' => 'rate_limited',
            'reason' => 'too_many_requests',
            'operation' => $policy,
        ], 429, [
            'Retry-After' => (string) $decision->retryAfterSeconds,
        ]));
    }
}
