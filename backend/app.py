# backend/app.py
from flask import Flask, request, jsonify
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

@app.route("/api/milestones", methods=["POST"])
def add_milestone():
    data = request.json
    # Basic validation
    if not data.get("title") or not data.get("start_date"):
        return jsonify({"error": "title and start_date required"}), 400
    milestones.insert_one(data)
    return jsonify({"message": "Milestone added!"}), 201

@app.route("/api/milestones/<id>", methods=["DELETE"])
def delete_milestone(id):
    milestones.delete_one({"_id": ObjectId(id)})
    return jsonify({"message": "Milestone deleted!"})

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
