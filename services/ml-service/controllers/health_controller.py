from flask import Blueprint, request, jsonify


health_bp = Blueprint("health", __name__, url_prefix="/api/ml/health")


# Health check
@health_bp.route("/Get", methods=["GET"])
def get_health():
    return jsonify({"status": "Healthy"}), 200
