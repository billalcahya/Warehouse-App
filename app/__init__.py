from flask import Flask, render_template, session, redirect
from pymongo import MongoClient
from config import (
    SECRET_KEY, 
    MONGODB_CONNECTION_STRING, 
    MONGODB_DATABASE_NAME, 
    MONGO_AUTH_DATABASE
)

def create_app():
    app = Flask(
        __name__,
        template_folder="../templates",
        static_folder="../static"
    )
    app.secret_key = SECRET_KEY

    # Setup DB dulu
    client = MongoClient(MONGODB_CONNECTION_STRING)
    app.db = client[MONGODB_DATABASE_NAME]
    app.auth_db = client[MONGO_AUTH_DATABASE]

    from app.routes import (
        auth_routes,
        inventory_routes,
        inventory_out_routes,
        product_routes,
        sales_routes,
        karyawan_routes,
        dashboard_routes,
        landingpage
    )

    app.register_blueprint(auth_routes.auth_bp)
    app.register_blueprint(product_routes.product_bp)
    app.register_blueprint(dashboard_routes.dashboard_bp)
    app.register_blueprint(inventory_routes.inventory_bp)
    app.register_blueprint(inventory_out_routes.inventory_out_bp)
    app.register_blueprint(sales_routes.sales_bp)
    app.register_blueprint(karyawan_routes.karyawan_bp)
    app.register_blueprint(landingpage.landingpage_bp)

    @app.route("/")
    def home():
        return redirect("/landingpage")

    return app
