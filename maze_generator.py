import os
import json
import jax.numpy as np
import matplotlib.pyplot as plt
from itertools import product
from random import choice
import heapq

from mazelib import Maze
from mazelib.generate.Prims import Prims
from mazelib.generate.BacktrackingGenerator import BacktrackingGenerator
from mazelib.generate.Ellers import Ellers
from mazelib.solve.BacktrackingSolver import BacktrackingSolver
from mazelib.solve.MazeSolveAlgo import MazeSolveAlgo


lst = []

def plot_maze(maze, ax, show_solution=True):
    grid = np.array(maze.grid, dtype=np.int32)
    grid = grid.at[maze.start].set(0)
    grid = grid.at[maze.end].set(0)
    ax.imshow(grid, cmap='binary')
    ax.scatter(maze.start[1], maze.start[0], color='green', marker='s', s=300, label='Start')
    ax.scatter(maze.end[1], maze.end[0], color='red', marker='s', s=300, label='Finish')
    solution = maze.solutions[0] if maze.solutions else None

    if solution and show_solution:
        y, x = zip(*solution)
        ax.plot(x, y, color='red', linewidth=5)
    ax.axis('off')
    return ax    

def plot_mazes(mazes, show_solutions=True):
    n = len(mazes)
    if show_solutions:
        # two rows: bottom row with solutions
        fig, axs = plt.subplots(2, n, figsize=(6*n, 10))
    else:
        fig, axs = plt.subplots(1, n, figsize=(6*n, 5))

    if n == 1:
        axs = [axs]
    for i, maze in enumerate(mazes):
        ax = plot_maze(maze, axs[0, i] if show_solutions else axs[i], show_solution=False)
        ax.set_title(f'Maze {i+1}', fontsize=16)
        if show_solutions:
            ax = plot_maze(maze, axs[1, i], show_solution=True)
            ax.set_title(f'Maze {i+1} Solution', fontsize=16)

    plt.tight_layout()
    plt.show()
    return fig




class AStarSolver(MazeSolveAlgo):
    """A* for mazelib grids that counts backtracks (revisits with shorter cost)."""

    def _solve(self):
        start = self.start
        if self._on_edge(start):
            start = self._push_edge(start)
        goal = self.end

        open_set = [(self._h(start, goal), 0, start)]
        came_from = {}
        g = {start: 0}
        in_open = {start}
        backtracks = 0

        while open_set:
            _, g_cur, cur = heapq.heappop(open_set)
            in_open.discard(cur)

            if self._within_one(cur, goal):
                path_nodes = self._reconstruct_nodes(came_from, cur)
                solution = self._nodes_to_solution_with_midpoints(path_nodes, goal)
                self.backtracks = backtracks
                return [solution]

            for nb in self._find_unblocked_neighbors(cur):
                tentative_g = g_cur + 1
                if nb in g:
                    if tentative_g < g[nb]:
                        backtracks += 1  # found a cheaper route to an explored node
                if tentative_g < g.get(nb, float("inf")):
                    came_from[nb] = cur
                    g[nb] = tentative_g
                    f = tentative_g + self._h(nb, goal)
                    if nb not in in_open:
                        heapq.heappush(open_set, (f, tentative_g, nb))
                        in_open.add(nb)

        self.backtracks = backtracks
        return [[]]

    def _h(self, a, b):
        return (abs(a[0] - b[0]) + abs(a[1] - b[1])) // 2

    def _reconstruct_nodes(self, came_from, cur):
        path = [cur]
        while cur in came_from:
            cur = came_from[cur]
            path.append(cur)
        path.reverse()
        return path

    def _nodes_to_solution_with_midpoints(self, nodes, goal):
        sol = [nodes[0]]
        for u, v in zip(nodes, nodes[1:]):
            sol.append(self._midpoint(u, v))
            sol.append(v)
        last = sol[-1]
        if self._within_one(last, goal):
            sol.append(self._midpoint(last, goal))
            sol.append(goal)
        return sol
    

class NewBacktrackingSolver(MazeSolveAlgo):
    """
    The Backtracking Solver maze solving algorithm.

    1. Pick a random direction and follow it
    2. Backtrack if and only if you hit a dead end.
    """

    def _solve(self):
        solution = []
        backtracks = 0

        # a first move has to be made
        current = self.start
        if self._on_edge(self.start):
            current = self._push_edge(self.start)
        solution.append(current)

        # pick a random neighbor and travel to it, until you're at the end
        while not self._within_one(solution[-1], self.end):
            ns = self._find_unblocked_neighbors(solution[-1])
            if not ns:
                backtracks += 1

            # do no go where you've just been
            if len(ns) > 1 and len(solution) > 2:
                if solution[-3] in ns:
                    ns.remove(solution[-3])

            nxt = choice(ns)
            solution.append(self._midpoint(solution[-1], nxt))
            solution.append(nxt)

        self.backtracks = backtracks
        return [solution]
    
def generate_monte_carlo_weighted(self, repeat, entrances=3, difficulty=1.0, alpha=0.5):
    """Monte Carlo generator combining raw path length and backtracks (no normalization).
        alpha weights path length vs backtracks as a difficulty measure
    """
    assert 0.0 <= difficulty <= 1.0
    assert 0.0 <= alpha <= 1.0

    trials = []
    for _ in range(repeat):
        self.generate()
        for _ in range(entrances):
            self.generate_entrances()
            self.solve()
            length = len(self.solutions[0]) if self.solutions and self.solutions[0] else float("inf")
            backtracks = self.solver.backtracks
            trials.append({
                "grid": self.grid.copy(),
                "start": self.start,
                "end": self.end,
                "solutions": self.solutions,
                "length": length,
                "backtracks": backtracks,
                "score": alpha * length + (1 - alpha) * backtracks,
            })

    # rank by combined raw score
    trials.sort(key=lambda t: t["score"])
    idx = int((len(trials) - 1) * difficulty)
    chosen = trials[idx]
    print("----")
    # print([t["length"] for t in trials])
    lst.append(chosen["length"])
    print(chosen["solutions"])
    print(chosen["start"])
    print(chosen["end"])

    self.grid = chosen["grid"]
    self.start = chosen["start"]
    self.end = chosen["end"]
    self.solutions = chosen["solutions"]
    self.difficulty = chosen["score"]


def generate_mazes():
    """Generate a set of mazes with varying sizes and difficulties."""
    # maze_generators = [Prims, BacktrackingGenerator, Ellers]
    maze_generators = [Prims, BacktrackingGenerator]
    # maze_generators = [Prims]
    maze_generators = [BacktrackingGenerator]
    mazes = []
    difficulty = 0.5
    sizes = [15, 15, 15, 20]
    Maze.generate_monte_carlo_weighted = generate_monte_carlo_weighted

    for size in sizes:
        m = Maze()
        generator = choice(maze_generators)
        m.generator = generator(size, size)
        m.solver = AStarSolver()
        # m.solver = NewBacktrackingSolver()
        n_grids = 300
        n_paths = 1
        m.generate_monte_carlo_weighted(n_grids, n_paths, difficulty, alpha=0.9)
        mazes.append(m)

    return mazes

if __name__ == "__main__":
    mazes = generate_mazes()
    # Save the mazes
    with open(os.path.dirname(__file__) + "/mazes.json", "w") as f:
        json.dump([{
            "grid": m.grid.tolist(),
            "start": m.start,
            "end": m.end,
            "difficulty": m.difficulty
        } for m in mazes], f)
    

    plot_mazes(mazes)

print(lst)