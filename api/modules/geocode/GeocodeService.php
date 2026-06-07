<?php

declare(strict_types=1);

namespace Hg\Api\Modules\Geocode;

use Hg\Api\Core\Env;

final class GeocodeService
{
    private const USER_AGENT = 'HighwayGrill-HRMS/1.0 (local-dev)';

    /** @var array<string, array<string, mixed>> */
    private static array $memCache = [];

    public function reverse(float $latitude, float $longitude): array
    {
        if ($latitude < -90 || $latitude > 90 || $longitude < -180 || $longitude > 180) {
            throw new \InvalidArgumentException('Invalid coordinates');
        }

        $cacheKey = 'reverse:' . round($latitude, 5) . ',' . round($longitude, 5);
        if (isset(self::$memCache[$cacheKey])) {
            return self::$memCache[$cacheKey];
        }

        $url = sprintf(
            'https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=%F&lon=%F&zoom=19&addressdetails=1&accept-language=en',
            $latitude,
            $longitude
        );

        $data = $this->fetchJson($url);
        $formatted = (string) ($data['display_name'] ?? '');
        $addr = is_array($data['address'] ?? null) ? $data['address'] : [];

        $result = $this->buildResult($latitude, $longitude, $formatted, $addr);
        self::$memCache[$cacheKey] = $result;

        return $result;
    }

    /** @return list<array<string, mixed>> */
    public function search(string $query, int $limit = 6): array
    {
        $query = trim($query);
        if (strlen($query) < 3) {
            return [];
        }

        $cacheKey = 'search:' . strtolower($query) . ':' . $limit;
        if (isset(self::$memCache[$cacheKey])) {
            /** @var list<array<string, mixed>> */
            return self::$memCache[$cacheKey];
        }

        $queries = [$this->expandSearchQuery($query)];
        if ($queries[0] !== $query) {
            $queries[] = $query;
        }

        $seen = [];
        $out = [];
        foreach ($queries as $q) {
            $url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&'
                . http_build_query([
                    'q' => $q,
                    'limit' => min($limit, 10),
                    'countrycodes' => 'ph',
                    'addressdetails' => 1,
                    'accept-language' => 'en',
                ]);

            $rows = $this->fetchJson($url);
            if (!is_array($rows)) {
                continue;
            }

            foreach ($rows as $row) {
                if (!is_array($row) || !isset($row['lat'], $row['lon'])) {
                    continue;
                }
                $lat = (float) $row['lat'];
                $lng = (float) $row['lon'];
                $key = round($lat, 5) . ',' . round($lng, 5);
                if (isset($seen[$key])) {
                    continue;
                }
                $seen[$key] = true;
                $addr = is_array($row['address'] ?? null) ? $row['address'] : [];
                $formatted = (string) ($row['display_name'] ?? '');
                $out[] = $this->buildResult($lat, $lng, $formatted, $addr);
                if (count($out) >= $limit) {
                    self::$memCache[$cacheKey] = $out;
                    return $out;
                }
            }
        }

        self::$memCache[$cacheKey] = $out;

        return $out;
    }

    private function expandSearchQuery(string $query): string
    {
        $lower = strtolower($query);
        if (str_contains($lower, 'philippines') || str_contains($lower, 'camarines')) {
            return $query;
        }

        return $query . ', Camarines Sur, Philippines';
    }

    /** @param array<string, mixed> $addr */
    private function buildResult(float $lat, float $lng, string $formatted, array $addr): array
    {
        $parts = $this->parseParts($addr);
        $short = $this->shortAddress($addr, $formatted);

        return [
            'latitude' => $lat,
            'longitude' => $lng,
            'formatted' => $this->displayAddress($formatted, $parts, $short),
            'short' => $short,
            'parts' => $parts,
        ];
    }

    /** @param array{region_line: string, postal_code: string, street_line: string} $parts */
    private function displayAddress(string $formatted, array $parts, string $short): string
    {
        $formatted = trim($formatted);
        if (strlen($formatted) >= 20) {
            return $formatted;
        }

        $built = implode(', ', array_filter([
            $parts['street_line'] ?? '',
            $parts['region_line'] ?? '',
            $parts['postal_code'] ?? '',
        ]));

        if ($built !== '') {
            return $built;
        }

        return $formatted !== '' ? $formatted : $short;
    }

    private function fetchJson(string $url, int $attempt = 0): array
    {
        if (!function_exists('curl_init')) {
            return $this->fetchJsonStream($url);
        }

        $ch = curl_init($url);
        $opts = [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_TIMEOUT => 15,
            CURLOPT_HTTPHEADER => [
                'User-Agent: ' . self::USER_AGENT,
                'Accept: application/json',
            ],
        ];

        $caBundle = dirname(__DIR__, 3) . '/cacert.pem';
        if (is_readable($caBundle)) {
            $opts[CURLOPT_CAINFO] = $caBundle;
        } elseif (Env::get('APP_ENV', 'local') === 'local') {
            $opts[CURLOPT_SSL_VERIFYPEER] = false;
            $opts[CURLOPT_SSL_VERIFYHOST] = 0;
        }

        curl_setopt_array($ch, $opts);
        $raw = curl_exec($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);
        curl_close($ch);

        if ($code === 429 && $attempt < 2) {
            usleep(1_100_000);
            return $this->fetchJson($url, $attempt + 1);
        }

        if ($raw === false || $code >= 400) {
            throw new \RuntimeException(
                $err !== '' ? 'Geocoding failed: ' . $err : 'Geocoding service unavailable (HTTP ' . $code . ')'
            );
        }

        return $this->decodeJson($raw);
    }

    private function fetchJsonStream(string $url): array
    {
        $ctx = stream_context_create([
            'http' => [
                'method' => 'GET',
                'header' => 'User-Agent: ' . self::USER_AGENT . "\r\nAccept: application/json\r\n",
                'timeout' => 15,
            ],
            'ssl' => [
                'verify_peer' => Env::get('APP_ENV', 'local') !== 'local',
                'verify_peer_name' => Env::get('APP_ENV', 'local') !== 'local',
            ],
        ]);

        $raw = @file_get_contents($url, false, $ctx);
        if ($raw === false) {
            throw new \RuntimeException('Geocoding service unavailable');
        }

        return $this->decodeJson($raw);
    }

    private function decodeJson(string $raw): array
    {
        $data = json_decode($raw, true);
        if (!is_array($data)) {
            throw new \RuntimeException('Invalid geocoding response');
        }

        return $data;
    }

    /** @param array<string, mixed> $addr */
    private function shortAddress(array $addr, string $fallback): string
    {
        $street = $this->streetLine($addr);
        $barangay = $this->barangayLine($addr);
        $municipality = $this->municipalityLine($addr);
        $parts = array_values(array_unique(array_filter([$street, $barangay, $municipality])));
        if ($parts !== []) {
            return implode(', ', $parts);
        }
        return $fallback !== '' ? $fallback : 'Unknown location';
    }

    /** @param array<string, mixed> $addr */
    private function parseParts(array $addr): array
    {
        $region = array_values(array_unique(array_filter([
            $addr['state'] ?? $addr['region'] ?? null,
            $addr['province'] ?? $addr['state_district'] ?? $addr['county'] ?? null,
            $this->municipalityLine($addr) ?: null,
            $this->barangayLine($addr) ?: null,
        ])));

        return [
            'region_line' => $region !== [] ? implode(', ', $region) : '',
            'postal_code' => (string) ($addr['postcode'] ?? ''),
            'street_line' => $this->streetLine($addr),
        ];
    }

    /** @param array<string, mixed> $addr */
    private function streetLine(array $addr): string
    {
        $parts = array_filter([
            $addr['house_number'] ?? null,
            $addr['road'] ?? $addr['street'] ?? $addr['pedestrian'] ?? $addr['footway'] ?? $addr['residential'] ?? null,
        ]);

        return $parts !== [] ? implode(' ', $parts) : '';
    }

    /** @param array<string, mixed> $addr */
    private function barangayLine(array $addr): string
    {
        foreach (['suburb', 'neighbourhood', 'quarter', 'village', 'hamlet', 'city_district'] as $key) {
            if (!empty($addr[$key])) {
                return (string) $addr[$key];
            }
        }

        return '';
    }

    /** @param array<string, mixed> $addr */
    private function municipalityLine(array $addr): string
    {
        foreach (['city', 'town', 'municipality'] as $key) {
            if (!empty($addr[$key])) {
                return (string) $addr[$key];
            }
        }

        return '';
    }
}
