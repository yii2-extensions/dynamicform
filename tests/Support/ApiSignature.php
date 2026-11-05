<?php

declare(strict_types=1);

namespace Yii2\Extensions\DynamicForm\Tests\Support;

use ReflectionClass;
use ReflectionParameter;

use function array_map;
use function implode;
use function ksort;
use function var_export;

/**
 * Describes the public and protected members a class declares itself, as comparable one-line signatures.
 */
final class ApiSignature
{
    /**
     * Returns `name => signature` for declared constants, properties and methods, sorted by name.
     *
     * @param class-string $class
     *
     * @return array<string, string>
     */
    public static function describe(string $class): array
    {
        $reflection = new ReflectionClass($class);
        $members = [];

        foreach ($reflection->getReflectionConstants() as $constant) {
            if ($constant->getDeclaringClass()->getName() === $class) {
                $members["const {$constant->getName()}"] = ($constant->isPublic() ? 'public' : 'protected')
                    . " const {$constant->getName()} = " . var_export($constant->getValue(), true);
            }
        }

        foreach ($reflection->getProperties() as $property) {
            if ($property->getDeclaringClass()->getName() === $class && !$property->isPrivate()) {
                $members["\${$property->getName()}"] = ($property->isPublic() ? 'public' : 'protected')
                    . ($property->isStatic() ? ' static' : '')
                    . ($property->hasType() ? " {$property->getType()}" : '')
                    . " \${$property->getName()} = " . var_export($property->getDefaultValue(), true);
            }
        }

        foreach ($reflection->getMethods() as $method) {
            if ($method->getDeclaringClass()->getName() === $class && !$method->isPrivate()) {
                $parameters = array_map(
                    static fn(ReflectionParameter $parameter): string => ($parameter->hasType()
                        ? "{$parameter->getType()} "
                        : '')
                        . ($parameter->isPassedByReference() ? '&' : '')
                        . "\${$parameter->getName()}"
                        . ($parameter->isDefaultValueAvailable()
                            ? ' = ' . var_export($parameter->getDefaultValue(), true)
                            : ''),
                    $method->getParameters(),
                );

                $members["{$method->getName()}()"] = ($method->isPublic() ? 'public' : 'protected')
                    . ($method->isStatic() ? ' static' : '')
                    . ($method->isFinal() ? ' final' : '')
                    . " function {$method->getName()}(" . implode(', ', $parameters) . ')'
                    . ($method->hasReturnType() ? ": {$method->getReturnType()}" : '');
            }
        }

        ksort($members);

        return $members;
    }
}
