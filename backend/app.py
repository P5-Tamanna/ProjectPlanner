# backend/app.py
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from pymongo import MongoClient
from bson import ObjectId

app = Flask(__name__)
CORS(app)   # allow cross-origin requests from React dev server

# Use local MongoDB or Atlas URI if you have it
MONGO_URI = "mongodb://localhost:27017/"   # change if using Atlas
client = MongoClient(MONGO_URI)
db = client["project_planner"]
milestones = db["milestones"]

@app.route("/test", methods=["GET"])
def test():
    return jsonify({"message": "Backend Connected Successfully!"})

@app.route("/api/milestones", methods=["GET"])
def get_milestones():
    project_id = request.args.get("project_id")
    query = {}
    if project_id:
        query["project_id"] = project_id
    data = list(milestones.find(query))
    for d in data:
        d["_id"] = str(d["_id"])
    return jsonify(data)


@app.route("/api/seed-demo", methods=["POST"])
def seed_demo():
    # create a few demo milestones used to match the UI screenshots
    demo = [
        {
            "title": "Finalize Project Objectives & Scope",
            "description": "Define goals, scope and deliverables",
            "start_date": "2025-10-20",
            "end_date": "2025-10-24",
            "project_id": "1234",
            "is_milestone": True,
            "priority": "Low",
            "completed": True,
            "progress": 100,
            "notes": "Completed by Tamanna",
        },
        {
            "title": "Design Database Schema (MongoDB)",
            "description": "Create collections and indexes",
            "start_date": "2025-10-25",
            "end_date": "2025-10-30",
            "project_id": "1234",
            "is_milestone": False,
            "priority": "Medium",
            "completed": False,
            "progress": 70,
            "notes": "Assigned to Tamanna Gupta",
        },
        {
            "title": "Setup GitHub repository structure",
            "description": "Initial repo, branch strategy",
            "start_date": "2025-10-28",
            "end_date": "2025-10-30",
            "project_id": "1234",
            "is_milestone": True,
            "priority": "High",
            "completed": False,
            "progress": 10,
            "notes": "Assigned to Shlok",
        },
        {
            "title": "Create RAG pipeline for Code Search",
            "description": "RAG infra and tests",
            "start_date": "2025-10-18",
            "end_date": "2025-10-19",
            "project_id": "1234",
            "is_milestone": True,
            "priority": "High",
            "completed": True,
            "progress": 100,
        }
    ]
    inserted = []
    for m in demo:
        res = milestones.insert_one(m)
        inserted.append(str(res.inserted_id))
    return jsonify({"inserted": inserted})


@app.route("/api/reset-demo", methods=["POST"])
def reset_demo():
    # delete demo project milestones and reseed
    project_id = request.json.get("project_id") if request.json else "1234"
    try:
        milestones.delete_many({"project_id": project_id})
    except Exception:
        pass
    # call seed_demo behavior
    demo = [
        {
            "title": "Finalize Project Objectives & Scope",
            "description": "Define goals, scope and deliverables",
            "start_date": "2025-10-20",
            "end_date": "2025-10-24",
            "project_id": project_id,
            "is_milestone": True,
            "priority": "Low",
            "completed": True,
            "progress": 100,
            "notes": "Completed by Tamanna",
        },
        {
            "title": "Design Database Schema (MongoDB)",
            "description": "Create collections and indexes",
            "start_date": "2025-10-25",
            "end_date": "2025-10-30",
            "project_id": project_id,
            "is_milestone": False,
            "priority": "Medium",
            "completed": False,
            "progress": 70,
            "notes": "Assigned to Tamanna Gupta",
        },
        {
            "title": "Setup GitHub repository structure",
            "description": "Initial repo, branch strategy",
            "start_date": "2025-10-28",
            "end_date": "2025-10-30",
            "project_id": project_id,
            "is_milestone": True,
            "priority": "High",
            "completed": False,
            "progress": 10,
            "notes": "Assigned to Shlok",
        },
    ]
    inserted = []
    for m in demo:
        res = milestones.insert_one(m)
        inserted.append(str(res.inserted_id))
    return jsonify({"reset": True, "inserted": inserted})

@app.route("/api/milestones", methods=["POST"])
def add_milestone():
    data = request.json
    # Basic validation
    if not data.get("title") or not data.get("start_date"):
        return jsonify({"error": "title and start_date required"}), 400
    milestones.insert_one(data)
    return jsonify({"message": "Milestone added!"}), 201


@app.route("/api/milestones/<id>", methods=["PUT"])
def update_milestone(id):
    data = request.json or {}
    # Allow updating title, description, start_date, end_date, priority, completed, progress, notes
    update_fields = {}
    # allow subtasks as an array of {title, done}
    allowed = ["title", "description", "start_date", "end_date", "priority", "completed", "progress", "notes", "reminder_time", "subtasks"]
    for k in allowed:
        if k in data:
            update_fields[k] = data[k]
    if not update_fields:
        return jsonify({"error": "no valid fields to update"}), 400
    try:
        milestones.update_one({"_id": ObjectId(id)}, {"$set": update_fields})
    except Exception as e:
        return jsonify({"error": f"invalid id or update failed: {str(e)}"}), 400
    return jsonify({"message": "Milestone updated"})


import os
from werkzeug.utils import secure_filename

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


@app.route("/api/milestones/<id>/attachments", methods=["POST"])
def upload_attachment(id):
    if "file" not in request.files:
        return jsonify({"error": "no file provided"}), 400
    f = request.files["file"]
    if f.filename == "":
        return jsonify({"error": "empty filename"}), 400
    filename = secure_filename(f.filename)
    save_path = os.path.join(UPLOAD_DIR, filename)
    f.save(save_path)
    # store reference to milestone document
    file_url = f"/uploads/{filename}"
    milestones.update_one({"_id": ObjectId(id)}, {"$push": {"attachments": {"filename": filename, "url": file_url}}})
    return jsonify({"message": "uploaded", "url": file_url})


@app.route('/uploads/<filename>')
def serve_upload(filename):
    # Serve uploaded files from the uploads directory
    try:
        return send_from_directory(UPLOAD_DIR, filename, as_attachment=False)
    except Exception as e:
        return jsonify({"error": "file not found"}), 404


@app.route("/api/milestones/<id>/remind", methods=["POST"])
def remind_milestone(id):
    # simple placeholder: log reminder request and return success
    data = request.json or {}
    # In a real app you would enqueue a job or send an email here.
    print(f"Reminder requested for milestone {id}:", data)
    return jsonify({"message": "Reminder scheduled (placeholder)"})

@app.route("/api/milestones/<id>", methods=["DELETE"])
def delete_milestone(id):
    milestones.delete_one({"_id": ObjectId(id)})
    return jsonify({"message": "Milestone deleted!"})

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
