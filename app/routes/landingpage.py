from flask import Blueprint,render_template,session
from app.routes.auth_routes import check_login

landingpage_bp = Blueprint("landingpage_bp", __name__)

@landingpage_bp.route("/landingpage")
def landingpage():
    return render_template("landingpage.html")