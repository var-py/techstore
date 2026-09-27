test:
	sh scripts/test.sh

# Эта команда не выполняется, если зависимость test завершилась с ошибкой.
up: test
	docker compose up -d --build --wait --wait-timeout 120