#!/bin/sh
set -eu

cd "$(dirname "$0")/.."
TEST_PROJECT="techstore-tests-$$"

test_compose() {
    docker compose -p "$TEST_PROJECT" -f docker-compose.test.yml "$@"
}

cleanup() {
    status=$?
    trap - EXIT
    if [ "$status" -ne 0 ]; then
        test_compose logs --no-color --tail 100 >&2 || true
    fi
    # Удаляем только контейнеры и временные данные этого тестового запуска.
    if ! test_compose down --volumes --remove-orphans; then
        status=1
    fi
    exit "$status"
}

trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

echo "1/3: Сборка тестового образа"
test_compose build unit-tests

echo "2/3: Unit- и компонентные тесты без сети"
test_compose run --rm --no-deps -T unit-tests

echo "3/3: Готовность тестового приложения и интеграционные тесты"
test_compose up -d --no-build --wait --wait-timeout 120 web-test
test_compose run --rm --no-deps -T integration-tests

echo "Все проверки прошли. Отчёты: test-results/$TEST_PROJECT/"