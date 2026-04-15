import flask
import maze_generator
import os
import json

app = flask.Flask(__name__)

@app.route('/')
def home():
    return flask.render_template('index.html')

@app.route("/generate_mazes")
def generate_mazes_route():
    if os.path.exists("mazes.json"):
        print("it exists")
        with open("mazes.json", "r") as f:
            mazes = json.load(f)
        return flask.jsonify(mazes)

    print("why doesnt it exist")
    
    mazes = maze_generator.generate_mazes()
    result = []
    for i, maze in enumerate(mazes):
        result.append({
            "id": f"maze_{i}",
            "grid": maze.grid.tolist(),
            "start": list(maze.start),
            "end": list(maze.end),
            "difficulty": getattr(maze, "difficulty", None)
        })

    return flask.jsonify(result)