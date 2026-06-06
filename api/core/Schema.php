<?php

declare(strict_types=1);

namespace Hg\Api\Core;

final class Schema
{
    /** @var array<string, bool> */
    private static array $columnCache = [];

    public static function hasColumn(string $table, string $column): bool
    {
        $key = $table . '.' . $column;
        if (isset(self::$columnCache[$key])) {
            return self::$columnCache[$key];
        }

        $stmt = Database::connection()->prepare(
            'SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :t AND COLUMN_NAME = :c'
        );
        $stmt->execute(['t' => $table, 'c' => $column]);
        $exists = (int) $stmt->fetchColumn() > 0;
        self::$columnCache[$key] = $exists;

        return $exists;
    }
}
