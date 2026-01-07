from flask import Flask, jsonify, render_template, request, abort, session as session_login, redirect, session
from sqlalchemy import select, insert
from sqlalchemy.orm import Session
from sqlalchemy import update
from sqlalchemy.util import methods_equivalent
from sqlalchemy import func

from app.DB.models import Product, Users, Code
from app.DB.session import engine, config
from app.utils.security import hash_password, verify_password
from app.utils.sendmail import send_code

app = Flask(__name__)
app.config['JSON_AS_ASCII'] = False
app.json.ensure_ascii = False
app.config['SECRET_KEY'] =config['SESSION_A']

@app.route("/")
def root():
    with Session(engine) as session:
        stmt = select(Product).limit(4)
        products = session.scalars(stmt).all()
        s={}
        for i in range(len(products)):
            if products[i].category not in s:
                s[products[i].category] = 1
            else:
                s[products[i].category] += 1
    return render_template("index.html",products=products,s=s.items()) # [(apple, 1), ()]

@app.route("/hello/<name>")
def hello(name):
    return jsonify(message=f"Привет, {name}!")

# @app.route("/new/<id>")
# def new(id):
#     stmt = select(Users).where(Users.id==int(id))
#     user1 = session.scalar(stmt)
#     return render_template("API.html", name=user1.name,login=user1.login)
# @app.route("/user/<int:id>", methods=["GET", "POST"])
# def user_edit(id):
#     stmt = select(Users).where(Users.id == id)
#     user = session.scalar(stmt)
#
#     if request.method == "POST":
#         user.name = request.form.get("name", user.name)
#         user.login = request.form.get("login", user.login)
#         session.add(user)
#         session.commit()
#
#     return render_template("API.html", user=user)
@app.route("/store")
def store():
    with Session(engine) as session:
        stmt = select(Product).limit(4)
        products = session.scalars(stmt).all()
        s={}
        for i in range(len(products)):
            if products[i].category not in s:
                s[products[i].category] = 1
            else:
                s[products[i].category] += 1
    return render_template("index.html",products=products,s=s.items()) # [(apple, 1), ()]
@app.route("/account")
def account():
    user_id=session_login.get("user_id")
    if user_id is None:
        return redirect("/login")
    else:
        with Session(engine) as session:
            name=select(Users).where(Users.id==user_id)
            user=session.scalar(name)

    return render_template("account.html",name=user.name,email=user.email)

@app.route("/product/<product_id>")
def product(product_id):
    with Session(engine) as session:
        stmt = select(Product).where(Product.id==product_id)
        product = session.scalar(stmt)
    return render_template("product.html", product = product)


@app.route('/registration', methods=['GET','POST'])
def registration():
    if request.method== "GET":
        return render_template("registration.html")
    elif request.method == "POST":

        data = request.json  # получаем JSON
        name = data.get("name")
        password = data.get("password")
        email = data.get("email")
        with Session(engine) as session:
            password_sec = hash_password(password)
            password = password_sec
            proverka = select(Users).where(Users.email == email)
            proverka_proverka = session.scalar(proverka)
            if proverka_proverka is not None:
                raise abort(
                    code=401,
                    description="такой email уже существует!"
                )
            stmt = insert(Users).values(name=name, password=password, email=email).returning(Users.id)

            user = session.execute(stmt).one()
            session.commit()
            session_login["user_id"] = user.id
        return jsonify({"message": "True"})

@app.route("/login", methods=['GET','POST'])
def login():
    if request.method== "GET":
        return render_template("login.html")
    elif request.method == "POST":
        data = request.json  # получаем JSON
        password = data.get("password")
        email = data.get("email")
        with Session(engine) as session:
            proverka=select(Users).where(Users.email==email)
            proverka_proverka = session.scalar(proverka)
            if proverka_proverka is None:
                raise abort(
                    code=401,
                    description="такого email не существует!"
                )
            if not verify_password(password,proverka_proverka.password):
                raise abort(
                    code=401,
                    description="неверный логин или пароль!"
                )
            session_login["user_id"]=proverka_proverka.id
#xeexeex
        return jsonify({"message": "True"})
    session_login.clear()
    return render_template("login.html")
@app.route("/logout")
def logout():
    session_login.clear()
    return redirect("/login")
@app.route("/forgot/password")
def forgotpass():
    return render_template("forgotpass.html")
@app.route("/forgot/password/email") # /forgot/password/email?email=
def send_mail():
    email = request.args.get("email")
    with Session(engine) as session:
        snt = select(Users).where(Users.email == email)
        user = session.scalar(snt)
    if user is not None:
        code=send_code(email)
        stmt=insert(Code).values(email=email,code=code)
        commit = session.execute(stmt)
        session.commit()
        return jsonify({"message": "True"})
    else:
        raise abort(
            code=401,
            description="такого email не существует!"
        )
@app.route("/forgot/password/check/code")
def check_code():
    email = request.args.get("email")
    code = request.args.get("code")
    with Session(engine) as session:
        stmt = select(Code).where(Code.email == email)
        code_record = session.scalars(stmt).all()
        last_code=code_record[-1].code
        if code_record is None or last_code != code:
            raise abort(
                code=401,
                description="неверный код"
            )
    return jsonify({"message": "True"})
@app.route("/forgot/password/set", methods=["POST"])
def new_password():
    data = request.json
    email = data.get("email")
    newPassword=data.get("newPassword")
    with Session(engine) as session:
        hashed_password = hash_password(newPassword)

        update_stmt = update(Users).values(password=hashed_password).where(Users.email == email)

        session.execute(update_stmt)
        session.commit()
    return jsonify({"message": "True"})
@app.route("/search")
def search():
    q=request.args.get("q").lower().strip()
    page = request.args.get("page")
    category= request.args.get("category")
    price=request.args.get("price")
    price_order = request.args.get("price_order")
    if page is not None:
        page = int(request.args.get("page"))
    else:
        page=1
    items_per_page = 3
    total_results=0
    total_categories=[]
    with Session(engine) as session:
        stmt=select(Product).where(func.lower(Product.title).like("%"+q+"%"))
        if category is not None and len(category)>0:
            stmt=stmt.where(Product.category == category)
        if price is not None and len(price)>0:
            if "-" in price:
                from_price, to_price=price.split("-")

                stmt=stmt.where(Product.price.between(int(from_price),int(to_price)))
            else:
                stmt=stmt.where(Product.price>int(price))
        stmt=stmt.offset((page - 1) * items_per_page).limit(items_per_page)
        if price_order is not None and len(price_order)>0:
            if price_order == "price_desc":
                stmt =stmt.order_by(Product.price.desc())
            if price_order == "price_asc":
                stmt = stmt.order_by(Product.price.asc())
        search_stmt = session.scalars(stmt).all()
        results_count=len(search_stmt)

        total_results1 = select(Product).where(func.lower(Product.title).like("%" + q + "%"))
        if category is not None and len(category)!=0:
            total_results1 = total_results1.where(Product.category == category)
        if price is not None and len(price) != 0:
            if "-" in price:
                from_price, to_price=price.split("-")
                total_results1 = total_results1.where(Product.price.between(from_price, to_price))
            else:
                total_results1 = total_results1.where(Product.price > int(price))

        search_stmt_results = session.scalars(total_results1).all()
        total_results=len(search_stmt_results)//3

        if len(search_stmt_results)%3!=0:
            total_results+=1
        results_all=len(search_stmt_results)

        total_categori=select(Product.category)
        total_categories=set(session.scalars(total_categori).all())
        print(search_stmt)


    return render_template("search.html",q=q,products=search_stmt,results_count=results_count,page=page,total_results=total_results,results_all=results_all, total_categories=total_categories,cur_category=category,price=price,price_order=price_order)

# main
if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8081, debug=True)
