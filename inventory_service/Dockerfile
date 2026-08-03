FROM python:3.14-rc-slim

WORKDIR /techstore

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY .env .

EXPOSE 80

CMD ["python3","-m","app.main"]