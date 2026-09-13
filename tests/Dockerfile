FROM python:3.14-rc-slim

WORKDIR /techstore

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY inventory_service ./inventory_service
COPY tests ./tests
COPY pytest.ini ./
COPY tests/.env.tests ./.env
COPY alembic.ini ./
COPY alembic ./alembic

CMD ["python", "-m", "pytest", "-v"]