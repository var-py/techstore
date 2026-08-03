from flask import Flask

app = Flask(__name__)
def main():
    run_consumer()
if __name__ == "__main__":
    main()