import datetime
from email.message import Message

from flask_socketio import SocketIO
from flask_socketio import emit
from flask import Flask, jsonify, render_template, request, abort, session as session_login, redirect
from sqlalchemy import select, insert, or_, and_, distinct
from sqlalchemy.orm import Session
from sqlalchemy import update
from sqlalchemy.util import methods_equivalent
from sqlalchemy import func

from app.DB.models import Product, Users, Code, Admin, CountProduct, Massages
from app.DB.session import engine, config
from app.utils.security import hash_password, verify_password
from app.utils.sendmail import send_code

app = Flask(__name__)

app.config['JSON_AS_ASCII'] = False
app.json.ensure_ascii = False
app.config['SECRET_KEY'] =config['SESSION_A']
socketio = SocketIO(app, cors_allowed_origins="*")
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
    real_ip = request.headers.get('X-Forwarded-For', request.remote_addr)
    print(real_ip)
    proverkaIP = select(Admin).where(Admin.IP == real_ip,Admin.user_id==user_id)
    proverka_proverkaIP = session.scalar(proverkaIP)
    if proverka_proverkaIP is not None:
        query = (
            select(func.count(distinct(Users.id)))
            .join(Massages, Users.id == Massages.from_user)
            .where(Users.status == True, Users.id != user_id)
        )
        countusersa = session.scalars(query).all()
        countusersS = len(countusersa)
        # TODO
        with Session(engine) as session:
            all_massages = select(Massages).where(and_(Massages.to_user == user_id,Massages.is_read == False))
        all_massages = session.execute(all_massages).scalars().all()
        stats = []
        return render_template("admin.html",name=user.name,email=user.email,countusers=countusersS,all_massages=len(all_massages))
    else:
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
            qqq=update(Users).values(status=True).where(Users.email==email)
            status_user = session.execute(qqq)
            session.commit()
        return jsonify({"message": "True"})
    session_login.clear()
    return render_template("login.html")
@socketio.on("connect")
def handle_connect():
    user_id = session_login.get("user_id")
    print("CONNECTED", user_id)
    if user_id is None:
        return
    with Session(engine) as session:
        qqq = update(Users).values(status=True).where(Users.id == user_id)
        session.execute(qqq)
        session.commit()
        emit("user_status", {"user_id": user_id, "status": True}, broadcast=True)
@socketio.on("disconnect")
def handle_disconnect():
    user_id = session_login.get("user_id")
    print("DISCONNECTED", user_id)
    if user_id is None:
        return
    with Session(engine) as session:
        qqq = update(Users).values(status=False).where(Users.id == user_id)
        session.execute(qqq)
        session.commit()
        emit("user_status", {"user_id": user_id, "status": False}, broadcast=True)
@app.route("/logout")
def logout():
    user_id = session_login.get("user_id")
    with Session(engine) as session:
        qqq = update(Users).values(status=False).where(Users.id==user_id)
        session.execute(qqq)
        session.commit()
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

@app.route("/api/categories/stats")
def categories_stats():
    """API endpoint для получения статистики по категориям товаров"""
    with Session(engine) as session:
        stmt = select(Product.category, func.count(Product.id)).group_by(Product.category)
        result = session.execute(stmt).all()
        stats = {category: count for category, count in result}
    return jsonify(stats)
@app.route("/api/users")
def users():
    user_id = session_login.get("user_id")
    with Session(engine) as session:
        all_users=select(Users)
    all_users = session.execute(all_users).scalars().all()
    stats = []
    for user in all_users:
        all_massages = select(Massages).where(
            or_(
                and_(Massages.to_user == user_id, Massages.from_user == user.id, Massages.from_user != user_id),
                and_(Massages.from_user == user_id, Massages.to_user == user.id, Massages.to_user != user_id)
            )
        )

        massages_send=session.execute(all_massages).scalars().all()
        if not massages_send:
            continue
        text = None
        if len(massages_send)>0:
            text=massages_send[-1].text
        unread_masseges=select(Massages).where(Massages.to_user==user.id, Massages.from_user==user_id,Massages.is_read!=True)
        unread_masseges = session.execute(unread_masseges).scalars().all()
        unread=len(unread_masseges)

        d = {"id": user.id, "name": user.name, "email": user.email,"status": user.status, "lastMessage": text , "unread": unread, "lastSeen":massages_send[-1].time_send}

        stats.append(d)
    return jsonify(stats)
@app.route("/api/chat/<user_id>", methods=["GET"])
def chats(user_id):
    admin_id = session_login.get("user_id")
    user_id = int(user_id)
    with Session(engine) as session:
        all_massages=select(Massages).where(
            or_(
                and_(Massages.to_user==admin_id, Massages.from_user==user_id, Massages.from_user!=admin_id),
                and_(Massages.from_user==admin_id, Massages.to_user==user_id, Massages.to_user!=admin_id)
            )
        )
    all_massages = session.execute(all_massages).scalars().all()
    stats = []
    for massage in all_massages:
        if massage.from_user==user_id:
            sender="user"
        elif massage.from_user==admin_id:
            sender="admin"
        d = {"id": massage.id, "text": massage.text, "sender": sender,"time": massage.time_send}

        stats.append(d)
    return jsonify(stats)
@app.route("/api/admin/chat", methods=["GET"])
def chatsForAdmin():
    user_id = session_login.get("user_id")

    with Session(engine) as session:
        admin_query = select(Admin.user_id)
        admin_ids = session.execute(admin_query).scalars().all()
        all_massages=select(Massages).where(
            or_(
                and_(Massages.to_user.in_(admin_ids), Massages.from_user==user_id, Massages.from_user.notin_(admin_ids)),
                and_(Massages.from_user.in_(admin_ids), Massages.to_user==user_id, Massages.to_user.notin_(admin_ids))
            )
        )
        all_massages = session.execute(all_massages).scalars().all()
    stats = []
    for massage in all_massages:
        if massage.from_user==user_id:
            sender="user"
        elif massage.from_user in admin_ids:
            sender="bot"
        d = {"id": massage.id, "text": massage.text, "sender": sender,"time": massage.time_send}

        stats.append(d)
    return jsonify(stats)
@app.route("/api/massages", methods=["POST"])
def massages():
    data = request.json
    user_id = session_login.get("user_id")
    text=data.get("text")
    time_send = datetime.datetime.utcnow()
    to_user = data.get("to_user")
    with Session(engine) as session:
        stmt = insert(Massages).values(from_user=user_id, text=text, time_send=str(time_send),to_user=to_user)
        session.execute(stmt)
        session.commit()
    return jsonify({"id": user_id})
@app.route("/api/add/product", methods= ["POST"])
def add_product():
    name=request.form.get("Name")
    price=request.form.get("price")
    category=request.form.get("category")
    brand=request.form.get("brand")
    description=request.form.get("description")
    count=request.form.get("count")
    sale=request.form.get("sale")
    art=request.form.get("art")

    user_id = session_login.get("user_id")
    if user_id is None:
        return redirect("/login")
    else:
        with Session(engine) as session:
            name = select(Users).where(Users.id == user_id)
            user = session.scalar(name)

    with Session(engine) as session:
        stmt = insert(Product).values(id=int(art),title=name, price=int(price), category=category, brand=brand, description=description)
        commit = session.execute(stmt)
        stmt2=insert(CountProduct).values(count=count,sale=sale,product_id=art)
        commit = session.execute(stmt2)
        session.commit()
        countusers=select(Users).where(Users.status==True)
        countusersa=session.scalars(countusers).all()
        countusersS=len(countusersa)
        return render_template("admin.html", name=user.name, email=user.email,countusers=countusersS )

if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=80, debug=True, allow_unsafe_werkzeug=True)
