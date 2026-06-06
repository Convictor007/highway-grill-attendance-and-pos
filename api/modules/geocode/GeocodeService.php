<?php

declare(strict_types=1);

namespace Hg\Api\Modules\Geocode;

final class GeocodeService
{
    private const USER_AGENT = "User-Agent: HighwayGrill-HRMS/1.0 (local-dev)\r\nAccept: application/json\r\n";

    public function reverse(float $latitude, float $longitude): array
    {
        if ($latitude < -90 || $latitude > 90 || $longitude < -180 || $longitude > 180) {
            throw new \InvalidArgumentException('Invalid coordinates');
        }

        $url = sprintf(
            'https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=%F&lon=%F&zoom=18&addressdetails=1',
            $latitude,
            $longitude
        );

        $data = $this->fetchJson($url);
        $formatted = (string) ($data['display_name'] ?? '');
        $addr = is_array($data['address'] ?? null) ? $data['address'] : [];

        return [
            'latitude' => $latitude,
            'longitude' => $longitude,
            'formatted' => $formatted,
            'short' => $this->shortAddress($addr, $formatted),
            'parts' => $this->parseParts($addr),
        ];
    }

    /** @return list<array<string, mixed>> */
    public function search(string $query, int $limit = 6): array
    {
        $query = trim($query);
        if (strlen($query) < 3) {
            return [];
        }

        $url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&'
            . http_build_query([
                'q' => $query,
                'limit' => min($limit, 10),
                'countrycodes' => 'ph',
                'addressdetails' => 1,
            ]);

        $rows = $this->fetchJson($url);
        if (!is_array($rows)) {
            return [];
        }

        $out = [];
        foreach ($rows as $row) {
            if (!is_array($row) || !isset($row['lat'], $row['lon'])) {
                continue;
            }
            $addr = is_array($row['address'] ?? null) ? $row['address'] : [];
            $formatted = (string) ($row['display_name'] ?? '');
            $out[] = [
                'latitude' => (float) $row['lat'],
                'longitude' => (float) $row['lon'],
                'formatted' => $formatted,
                'short' => $this->shortAddress($addr, $formatted),
                'parts' => $this->parseParts($addr),
            ];
        }
        return $out;
    }

    private function fetchJson(string $url): array
    {
        $ctx = stream_context_create([
            'http' => [
                'method' => 'GET',
                'header' => self::USER_AGENT,
                'timeout' => 8,
            ],
        ]);

        $raw = @file_get_contents($url, false, $ctx);
        if ($raw === false) {
            throw new \RuntimeException('Geocoding service unavailable');
        }

        $data = json_decode($raw, true);
        if (!is_array($data)) {
            throw new \RuntimeException('Invalid geocoding response');
        }

        return $data;
    }

    /** @param array<string, mixed> $addr */
    private function shortAddress(array $addr, string $fallback): string
    {
        $parts = array_filter([
            $addr['house_number'] ?? null,
            $addr['road'] ?? $addr['pedestrian'] ?? $addr['footway'] ?? null,
            $addr['suburb'] ?? $addr['neighbourhood'] ?? $addr['quarter'] ?? null,
            $addr['city'] ?? $addr['town'] ?? $addr['municipality'] ?? $addr['village'] ?? null,
            $addr['state'] ?? null,
        ]);
        if ($parts !== []) {
            return implode(', ', $parts);
        }
        return $fallback !== '' ? $fallback : 'Unknown location';
    }

    /** @param array<string, mixed> $addr */
    private function parseParts(array $addr): array
    {
        $region = array_filter([
            $addr['state'] ?? $addr['region'] ?? null,
            $addr['province'] ?? null,
            $addr['city'] ?? $addr['town'] ?? $addr['municipality'] ?? $addr['city_district'] ?? null,
            $addr['suburb'] ?? $addr['neighbourhood'] ?? $addr['quarter'] ?? $addr['village'] ?? null,
        ]);

        $street = array_filter([
            $addr['house_number'] ?? null,
            $addr['road'] ?? $addr['pedestrian'] ?? $addr['footway'] ?? $addr['amenity'] ?? null,
        ]);

        return [
            'region_line' => $region !== [] ? implode(', ', $region) : '',
            'postal_code' => (string) ($addr['postcode'] ?? ''),
            'street_line' => $street !== [] ? implode(' ', $street) : '',
        ];
    }
}
