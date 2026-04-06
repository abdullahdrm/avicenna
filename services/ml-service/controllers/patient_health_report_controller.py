from flask import Blueprint, app, request, jsonify, render_template, Response

report_bp = Blueprint("patient_health_report", __name__, url_prefix="/api/ml/patient_health_report")
# avicenna.ceng.metu.edu.tr/api/ml/patient_health_report/Get
@report_bp.route("/Get", methods=["POST"])
def get_avicenna_patient_health_report():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400

        # to do 
        return jsonify({"message": "Success"}), 200

    except ValueError as e:
        return jsonify({"error": f"Invalid input: {str(e)}"}), 400
    except Exception as e:
        app.logger.error(f"Error in avicenna report: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

# avicenna.ceng.metu.edu.tr/api/ml/patient_health_report/Maymun
@report_bp.route("/Maymun", methods=["POST"])
def get_avicenna_patient_health_report():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400

        return jsonify({"message": "Success"}), 200


    except ValueError as e:
        return jsonify({"error": f"Invalid input: {str(e)}"}), 400
    except Exception as e:
        app.logger.error(f"Error in filter_phished_user_report: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

