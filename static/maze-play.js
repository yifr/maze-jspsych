/* jsPsych v8 plugin (UMD/IIFE): maze-play
   Maze format: 0 = open, 1 = wall; start/end: [x, y]
*/
var MazePlayPlugin = (function (jspsych) {
  const { ParameterType } = jspsych;

  const info = {
    name: "maze-play",
    version: "1.0",
    parameters: {
      maze:        { type: ParameterType.COMPLEX, default: undefined },
      time_limit:  { type: ParameterType.INT, default: null }
    },
    data: {
      rt:          { type: ParameterType.FLOAT },
      reason:      { type: ParameterType.STRING },
      solved:      { type: ParameterType.BOOL },
      timeout:     { type: ParameterType.BOOL },
      start:       { type: ParameterType.COMPLEX },
      end:         { type: ParameterType.COMPLEX },
      path:        { type: ParameterType.COMPLEX },
      events:      { type: ParameterType.COMPLEX },
      reward:      { type: ParameterType.FLOAT }
    }
  };

  class MazePlay {
    constructor(jsPsych) { this.jsPsych = jsPsych; }
    static info = info;

    trial(display_element, trial) {
      // Maze display data
      // const src = trial.maze.grid;
      // const rows = src.length;
      // const cols = src[0].length;
      const canvasSizeCoeff = 0.8;
      const padCoeff = 1.4;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      // Copy grid and force start/end to open
      // const [sx, sy] = trial.maze.start;
      // const [ex, ey] = trial.maze.end;
      // const grid = src.map(r => r.slice());
      // grid[sy][sx] = 0;
      // grid[ey][ex] = 0;
      
      // Display timer and maze
      display_element.innerHTML = `
        <div style="font-size: 16px;">
          Time ${trial.time_limit ? "remaining" : "spent"}:
          <div id="timer" class = "jspsych-timer" style="margin-bottom: 6px;"></div>
          <canvas id="maze" style="border: 1px solid #dddddd;"></canvas>
          <div id="message"></div>
        </div>`;
      const ctx = display_element.querySelector("#maze").getContext("2d");
      const timerEl = display_element.querySelector("#timer");
      const endMessage = display_element.querySelector("#message");
      endMessage.style.minHeight = "1.8em";

      // Initialize game board and maze constants
      const [grid, rows, cols, sx, sy, ex, ey, W, H] = drawHelper(ctx, trial.maze, null, null, vw, vh, canvasSizeCoeff, padCoeff, false);
      display_element.querySelector("#maze").width = `${W}`;
      display_element.querySelector("#maze").height = `${H}`;

      // Style and update timer
      if (trial.time_limit) {
        // Count down
        let remaining = trial.time_limit;
        const updateTimer = () => {
          if (remaining <= 0) {
            timeout_hit = true;
            log("timeout");
            end("timeout");
          }
          if (remaining <= 5) {
            timerEl.style.color = "#dc2626";
          } else {
            timerEl.style.color = "#000000";
          }
          timerEl.textContent = `${Math.floor(remaining / 60)}:${(remaining % 60).toString().padStart(2, "0")}`;
          remaining--;
        };
        // Set tick interval
        updateTimer();
        var tickInterval = setInterval(() => {
          updateTimer();
          if (remaining < 0) clearInterval(tickInterval);
        }, 1000);
      }
      else {
        // Count up
        let spent = 0;
        const updateTimer = () => {
          timerEl.textContent = `${Math.floor(spent / 60)}:${(spent % 60).toString().padStart(2, "0")}`;
          spent++;
        };
        // Set tick interval
        updateTimer();
        var tickInterval = setInterval(() => {
          updateTimer();
        }, 1000);
      }

      // Game status data and logging functions
      const pos  = { x: sx, y: sy };
      const goal = { x: ex, y: ey };
      const t0 = performance.now();
      const path = [];
      const moves = [];
      const events = [];
      let solved = false;
      let timeout_hit = false;
      let animationFrameId = null;
      const log = (type, payload = {}) => events.push({ t: performance.now() - t0, type, payload });
      const pushPath = (dx, dy) => {
        path.push({ t: performance.now() - t0, x: pos.x, y: pos.y });
        moves.push([dx, dy]);
      }

      const inBounds = (x,y) => x >= 0 && x < cols && y >= 0 && y < rows;
      const isOpen = (x,y) => inBounds(x,y) && grid[y][x] === 0;

      // Draw maze game board
      const draw = () => {
        drawHelper(ctx, trial.maze, moves, pos, vw, vh, canvasSizeCoeff, padCoeff, false);
      }

      // Slow down movement speed
      let lastMoveTime = 0;
      const moveDelay = 100;

      // Check if player made (valid) move and update position if necessary
      const updatePosition = () => {
        const now = performance.now();
        if (now - lastMoveTime < moveDelay) return;

        let dx = 0;
        let dy = 0;
        // need to fix multiple keys thing :/
        if (keys["ArrowLeft"] || keys["a"] || keys["A"]) dx = -1;
        if (keys["ArrowRight"] || keys["d"] || keys["D"]) dx = 1;
        if (keys["ArrowUp"] || keys["w"] || keys["W"]) dy = -1;
        if (keys["ArrowDown"] || keys["s"] || keys["S"]) dy = 1;

        const nx = pos.x + dx, ny = pos.y + dy;
        if (isOpen(nx, ny)) {
          pos.x = nx; pos.y = ny;
          pushPath(dx, dy); log("move_ok", {to: [nx, ny]});
          if (nx === goal.x && ny === goal.y) {
            solved = true;
            log("solve", {path_len: path.length});
            end("solved");
          }
        } else {
          log("move_blocked", {try: [nx,ny]});
        }
        lastMoveTime = now;
      };

      // Key event listeners
      const keys = {};
      const keydownHandler = (e) => {
        e.preventDefault();
        keys[e.key] = true;
      };
      const keyupHandler = (e) => {
        e.preventDefault();
        keys[e.key] = false;
      };
      document.addEventListener("keydown", keydownHandler);
      document.addEventListener("keyup", keyupHandler);

      // Game loop
      const loop = () => {
        updatePosition();
        draw();
        animationFrameId = requestAnimationFrame(loop);
      };

      // Trial end
      const end = (reason) => {
        cancelAnimationFrame(animationFrameId);
        document.removeEventListener("keydown", keydownHandler);
        document.removeEventListener("keyup", keyupHandler);

        clearInterval(tickInterval);
        const rt = performance.now() - t0;
        const reward = reason === "solved" ? trial.maze.difficulty : 0;

        // Display end message
        if (!trial.time_limit) {
          endMessage.innerHTML = "Congrats! You finished the practice maze. Please press the spacebar when you're ready to move on to the next screen.";
        } else if (reason === "solved") {
          endMessage.innerHTML = "Congrats! You finished the maze. Please press the spacebar to move on to the next screen.";
        } else {
          endMessage.innerHTML = "Unfortunately, you have run out of time. Please press the spacebar to move on to the next screen.";
        }
        
        // Finish trial after spacebar pressed
        const spaceHandler = (e) => {
          e.preventDefault();
          if (e.key === " " && performance.now() - t0 > 1000) {
            document.removeEventListener("keydown", spaceHandler);
            // Finish trial
            this.jsPsych.finishTrial({
              rt, reason, solved, timeout: timeout_hit, 
              start: [sx, sy], end: [ex, ey],
              path, events, reward
            });
          }
        }
        document.addEventListener("keydown", spaceHandler);
      };

      log("maze_show");
      loop();
    }
  }

  return MazePlay;
})(jsPsychModule);
