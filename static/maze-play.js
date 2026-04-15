/*
  jsPsych plugin: maze-play
  Renders a maze and allows participant to solve it via key controls
*/
var MazePlayPlugin = (function (jspsych) {
  const { ParameterType } = jspsych;

  const info = {
    name: "maze-play",
    version: "1.0",
    parameters: {
      time_limit:             { type: ParameterType.INT, default: null },
      maze:                   { type: ParameterType.COMPLEX, default: undefined },
      difficulty:             { type: ParameterType.INT, default: 0 },
      switch_after:           { type: ParameterType.BOOL, default: false },
      on_success_message:     { type: ParameterType.STRING, default: "Congrats! You finished the maze." },
      on_timeout_message:     { type: ParameterType.STRING, default: "Unfortunately, you have run out of time." },
      checkInInterval:        { type: ParameterType.INT, default: 15 },
      firstCheckIn:           { type: ParameterType.INT, default: 15 }
    },
    data: {
      rt:                     { type: ParameterType.FLOAT },
      reason:                 { type: ParameterType.STRING },
      solved:                 { type: ParameterType.BOOL },
      time_remaining_or_spent:{ type: ParameterType.INT },
      timeout:                { type: ParameterType.BOOL },
      start:                  { type: ParameterType.COMPLEX },
      end:                    { type: ParameterType.COMPLEX },
      path:                   { type: ParameterType.COMPLEX },
      events:                 { type: ParameterType.COMPLEX },
      reward:                 { type: ParameterType.BOOL }
    }
  };

  class MazePlay {
    constructor(jsPsych) { this.jsPsych = jsPsych; }
    static info = info;

    trial(display_element, trial) {
      console.log(trial.on_success_message);
      console.log(trial.on_timeout_message);
      // Display timer and maze
      display_element.innerHTML = `
        <div style = "font-size: 16px;">
          <div id = "header">
            <div>
              Difficulty: ${trial.difficulty == 0 ? "3" : "6"}</br>
              Time ${trial.time_limit ? "remaining" : "spent"}:
              <div id = "timer" class = "jspsych-timer" style = "margin-bottom: 6px;"></div>
            </div>
          </div>
          <div id = "maze-and-pop-up-container" style = "display: grid; place-content: center; place-items: center;">
            <canvas id = "maze" style = "grid-row: 1; grid-column: 1; border: 1px solid #dddddd;"></canvas>
          </div>
          <div id = "message"></div>
        </div>`;

      const gameSize = 90;
      
      const mazeEl = display_element.querySelector("#maze");
      const timerEl = display_element.querySelector("#timer");
      const endMessage = display_element.querySelector("#message");
      endMessage.style.minHeight = "1.8em";

      if (trial.switch_after) {
        const header = display_element.querySelector("#header");
        header.style = "display: flex; justify-content: space-between; align-items: center;";
        const upNext = document.createElement("div");
        upNext.innerHTML = `Up next:
          <div><canvas id = "game" style = "border: 1px solid #dddddd;"></canvas></div>`;
        header.appendChild(upNext);

        const gameEl = display_element.querySelector("#game");
        gameEl.width = gameSize;
        gameEl.height = gameSize;

        // Initialize game preview image
        gamePreviewHelper(gameEl, gameSize);
      }

      const containerEl = display_element.querySelector("#maze-and-pop-up-container");

      const updateNextCheckIn = (newVal) => {
        nextCheckIn = newVal;
      };
      const checkIn = trial.switch_after ? switchPopUpHelper(false, display_element, containerEl, trial.checkInInterval, updateNextCheckIn, () => log, () => end) : () => {};

      // Initialize game board and maze constants
      const canvasSizeCoeff = 0.8;
      const padCoeff = 1.4;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const [grid, rows, cols, sx, sy, ex, ey, W, H] = drawHelper(mazeEl, trial.maze, null, null, vw, vh, canvasSizeCoeff, padCoeff, false, true);

      // Style and update timer
      let paused = false;
      let nextCheckIn = trial.switch_after ? trial.firstCheckIn : null;
      let remaining = trial.time_limit;
      let spent = 0;
      if (trial.time_limit) {
        // Count down
        const updateTimer = () => {
          if (remaining <= 0) {
            paused = true;
            timeout_hit = true;
            log("timeout");
            end("timeout");
          }
          if (remaining <= 5) {
            timerEl.style.color = "#dc2626";
          } else {
            timerEl.style.color = "#000000";
          }
          timerEl.textContent = formatTime(remaining);
          
          if (trial.switch_after && nextCheckIn === 0 && !paused) {
            paused = true;
            checkIn();
          } else if (trial.switch_after && nextCheckIn !== 0) {
            paused = false;
            nextCheckIn--;
          }
          if (!paused) remaining--;
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
        const updateTimer = () => {
          timerEl.textContent = formatTime(spent);
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
        if (dx !== 0 && dy !== 0) {
          if (isOpen(pos.x, pos.y - dy)) {
            moves.push([dx, 0]);
            moves.push([0, dy]);
          } else {
            moves.push([0, dy]);
            moves.push([dx, 0]);
          }
        } else {
          moves.push([dx, dy]);
        }
      }

      const inBounds = (x,y) => x >= 0 && x < cols && y >= 0 && y < rows;
      const isOpen = (x,y) => inBounds(x,y) && grid[y][x] === 0;

      // Draw maze game board
      const draw = () => {
        drawHelper(mazeEl, trial.maze, moves, pos, vw, vh, canvasSizeCoeff, padCoeff, false, false);
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
        if (keys["ArrowLeft"] || keys["a"] || keys["A"]) dx -= 1;
        if (keys["ArrowRight"] || keys["d"] || keys["D"]) dx += 1;
        if (keys["ArrowUp"] || keys["w"] || keys["W"]) dy -= 1;
        if (keys["ArrowDown"] || keys["s"] || keys["S"]) dy += 1;

        const nx = pos.x + dx, ny = pos.y + dy;
        if ((dx !== 0 || dy !== 0) && isOpen(nx, ny)) {
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
        if (!paused) {
          updatePosition();
          draw();
        }
        animationFrameId = requestAnimationFrame(loop);
      };

      // Trial end
      const end = (reason) => {
        cancelAnimationFrame(animationFrameId);
        document.removeEventListener("keydown", keydownHandler);
        document.removeEventListener("keyup", keyupHandler);

        clearInterval(tickInterval);
        const t1 = performance.now();
        const rt = t1 - t0;
        const reward = reason === "solved" ? true : false;

        // Display end message
        if (reason === "switch") {
          this.jsPsych.finishTrial({
            rt, reason, solved, time_remaining_or_spent: (trial.time_limit ? remaining : spent), timeout: timeout_hit,
            start: [sx, sy], end: [ex, ey],
            path, events, reward
          });
          return;
        } else if (reason === "solved") {
          endMessage.innerHTML = trial.on_success_message + " Please press the spacebar to move on to the next screen.";
        } else if (reason === "timeout") {
          endMessage.innerHTML = trial.on_timeout_message + " Please press the spacebar to move on to the next screen.";
        }
        
        // Finish trial after spacebar pressed
        const spaceHandler = (e) => {
          e.preventDefault();
          if (e.key === " " && performance.now() - t1 > 500) {
            document.removeEventListener("keydown", spaceHandler);
            // Finish trial
            this.jsPsych.finishTrial({
              rt, reason, solved, time_remaining_or_spent: (trial.time_limit ? remaining + 1 : spent - 1), timeout: timeout_hit, 
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
