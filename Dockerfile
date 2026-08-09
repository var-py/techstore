FROM python:3.14-rc-slim

WORKDIR /techstore

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY .env .

EXPOSE 80

CMD ["gunicorn", "--worker-class", "gthread", "--workers", "1", "--threads", "20", "--bind", "0.0.0.0:80", "app.main:app"]
