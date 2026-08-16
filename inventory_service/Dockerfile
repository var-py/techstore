FROM python:3.14-rc-slim

WORKDIR /techstore

COPY inventory_service/requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY inventory_service/app ./app
COPY .env .

EXPOSE 80

CMD ["python3","-m","app.main"]
