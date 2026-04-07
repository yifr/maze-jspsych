/*
  jsPsych plugin: fun-game-play
  Renders a "fun game" (Flappy Bird) for the user to play; if given a maze,
    checks in with user about when to switch over to the maze
*/
var funGamePlayPlugin = (function (jspsych) {
  const { ParameterType } = jspsych;

  const info = {
    name: "fun-game-play",
    version: "1.0",
    parameters: {
      maze:           { type: ParameterType.COMPLEX, default: null },
      time_limit:     { type: ParameterType.INT, default: 120 },
      procrastination:{ type: ParameterType.BOOL, default: null },
      checkInInterval:{ type: ParameterType.INT, default: null },
      firstCheckIn:   { type: ParameterType.INT, default: null }
    },
    data: {
      rt:          { type: ParameterType.FLOAT },
      remaining:   { type: ParameterType.INT },
      reason:      { type: ParameterType.STRING },
      timeout:     { type: ParameterType.BOOL },
      events:      { type: ParameterType.COMPLEX },
    }
  };

  class funGamePlay {
    constructor(jsPsych) { this.jsPsych = jsPsych; }
    static info = info;

    trial(display_element, trial) {
      // Display timer and maze
      display_element.innerHTML = `
        <div style = "font-size: 16px;">
          <div id = "header">
              <div>
                Time ${trial.time_limit ? "remaining" : "spent"}:
                <div id = "timer" class = "jspsych-timer" style = "margin-bottom: 6px;"></div>
              </div>
          </div>
          <div id = "game-and-pop-up-container" style = "display: grid; place-content: center; place-items: center;">
            <canvas id = "game" style = "grid-row: 1; grid-column: 1; border: 1px solid #dddddd;"></canvas>
          </div>
        </div>`;

      const gameSize = 600;
      const mazeSize = 90;

      const timerEl = display_element.querySelector("#timer");

      if (trial.maze) {
        const header = display_element.querySelector("#header");
        header.style = "display: flex; justify-content: space-between; align-items: center;";
        const upNext = document.createElement("div");
        upNext.innerHTML = `Up next:
          <div><canvas id = "maze" style = "border: 1px solid #dddddd;"></canvas></div>`;
        header.appendChild(upNext);

        const mazeEl = display_element.querySelector("#maze");
        mazeEl.width = mazeSize;
        mazeEl.height = mazeSize;

        // Initialize game board and maze constants
        drawHelper(mazeEl, trial.maze, null, null, mazeSize, mazeSize, 1, 1, true, false);
      }
      
      const containerEl = display_element.querySelector("#game-and-pop-up-container");

      const game = display_element.querySelector("#game");
      const gameCtx = game.getContext("2d");
      game.className = "flappy-bird";
      game.width = gameSize;
      game.height = gameSize;

      const createEl = (tag, properties) => Object.assign(document.createElement(tag), properties);
      let checkIn = () => {};

      if (trial.maze) {
        const checkInEl = createEl("div", {id: "check-in", className: "jspsych-pop-up"});
        checkInEl.innerHTML = `Would you like to keep playing the game or switch to the maze?
              <div style = "margin: 5px; display: flex; flex-direction: row;">
                <button id = "continue-button" class = "jspsych-button">Continue</button>
                <button id = "switch-button" class = "jspsych-button">Switch</button>
              </div>`;
        containerEl.appendChild(checkInEl);
        
        const continuePageEl = createEl("form", {id: "continue-page", className: "jspsych-pop-up"});
        continuePageEl.innerHTML = `
              <div style = "margin: 10px;">
                You selected "Continue". When should we ask again? (Intervals of 15 sec.)<br>
                <div style = "display: flex; flex-direction: row; justify-content: center; align-items: center; gap: 15px;">
                  <div><input type = "radio" id = "opt-1" name = "ask-again" value = "15" required>
                  <label for = "opt-1">0:15</label></div>
                  <div><input type = "radio" id = "opt-2" name = "ask-again" value = "30" required>
                  <label for = "opt-2">0:30</label></div>
                  <div><input type = "radio" id = "opt-3" name = "ask-again" value = "45" required>
                  <label for = "opt-3">0:45</label></div>
                  <div><input type = "radio" id = "opt-4" name = "ask-again" value = "60" required>
                  <label for = "opt-1">1:00</label></div>
                </div>
              </div>
              <div style = "margin: 10px;">
                <label for = "continue-completion-prob">How likely do think you are to complete the maze if you start the next time we ask?<br></label>
                <output>50</output>%
                <input type = "range" id = "continue-completion-prob" name = "continue-completion-prob" required min = "0" max = "100"
                  value = "50" oninput = "this.previousElementSibling.value = this.value">
              </div>
              <div>
                <button type = "submit" class = "jspsych-button">Submit</button>
              </div>
        `;
        containerEl.appendChild(continuePageEl);

        const switchPageEl = createEl("form", {id: "switch-page", className: "jspsych-pop-up"});
        switchPageEl.innerHTML = `<div style = "margin: 10px;">
                You selected "Switch". You will now begin your attempt to solve the maze in the time remaining.
              </div>
              <div style = "margin: 10px;">
                <label for = "switch-completion-prob">How likely do think you are to complete the maze?<br></label>
                <output>50</output>%
                <input type = "range" id = "switch-completion-prob" name = "switch-completion-prob" required min = "0" max = "100"
                  value = "50" oninput = "this.previousElementSibling.value = this.value">
              </div>
              <div>
                <button type = "submit" class = "jspsych-button">Submit</button>
              </div>`;
        containerEl.appendChild(switchPageEl);

        // Control which pop-ups are visible
        checkIn = () => {
          checkInEl.style.display = "flex";
          log("check-in-appear");
        }
        const continueAction = () => {
          checkInEl.style.display = "none";
          continuePageEl.style.display = "flex";
          log("check-in-choose-continue");
        }
        const switchAction = () => {
          checkInEl.style.display = "none";
          switchPageEl.style.display = "flex";
          log("check-in-choose-switch");
        }
        // Handle form submissions
        continuePageEl.addEventListener("submit", (e) => {
          e.preventDefault();
          const data = new FormData(continuePageEl);
          log("continue-submit", {
            askAgain: data.get("ask-again"),
            completionProb: data.get("continue-completion-prob")
          });
          continuePageEl.style.display = "none";
          nextCheckIn = data.get("ask-again");
        });
        switchPageEl.addEventListener("submit", (e) => {
          e.preventDefault();
          const data = new FormData(switchPageEl);
          log("switch-submit", {
            completionProb: data.get("switch-completion-prob")
          });
          switchPageEl.style.display = "none";
          end("switch");
        });

        display_element.querySelector("#continue-button").addEventListener("click", continueAction);
        display_element.querySelector("#switch-button").addEventListener("click", switchAction);
      }

      // Game status data and logging functions
      // const pos  = { x: sx, y: sy };
      // const goal = { x: ex, y: ey };
      const t0 = performance.now();
      const events = [];
      // let solved = false;
      let timeout_hit = false;
      // let animationFrameId = null;
      const log = (type, payload = {}) => events.push({ t: performance.now() - t0, type, payload });
      // const pushPath = (dx, dy) => {
      //   path.push({ t: performance.now() - t0, x: pos.x, y: pos.y });
      //   moves.push([dx, dy]);
      // }

      

      

      // Style and update timer
      let remaining = trial.time_limit;
      let nextCheckIn = trial.firstCheckIn;
      let paused = false;
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
        timerEl.textContent = `${Math.floor(remaining / 60)}:${(remaining % 60).toString().padStart(2, "0")}`;

        if (trial.maze && nextCheckIn === 0 && !paused) {
          paused = true;
          checkIn();
        } else if (trial.maze && nextCheckIn !== 0) {
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

      // Play fun game
      flappyBird(game, gameCtx, () => paused, () => t0);

      // const inBounds = (x,y) => x >= 0 && x < cols && y >= 0 && y < rows;
      // const isOpen = (x,y) => inBounds(x,y) && grid[y][x] === 0;

      // // Draw maze game board
      // const draw = () => {
      //   drawHelper(mazeEl, trial.maze, moves, pos, vw, vh, canvasSizeCoeff, padCoeff, false);
      // }

      // // Slow down movement speed
      // let lastMoveTime = 0;
      // const moveDelay = 100;

      // // Check if player made (valid) move and update position if necessary
      // const updatePosition = () => {
      //   const now = performance.now();
      //   if (now - lastMoveTime < moveDelay) return;

      //   let dx = 0;
      //   let dy = 0;
      //   // need to fix multiple keys thing :/
      //   if (keys["ArrowLeft"] || keys["a"] || keys["A"]) dx = -1;
      //   if (keys["ArrowRight"] || keys["d"] || keys["D"]) dx = 1;
      //   if (keys["ArrowUp"] || keys["w"] || keys["W"]) dy = -1;
      //   if (keys["ArrowDown"] || keys["s"] || keys["S"]) dy = 1;

      //   const nx = pos.x + dx, ny = pos.y + dy;
      //   if (isOpen(nx, ny)) {
      //     pos.x = nx; pos.y = ny;
      //     pushPath(dx, dy); log("move_ok", {to: [nx, ny]});
      //     if (nx === goal.x && ny === goal.y) {
      //       solved = true;
      //       log("solve", {path_len: path.length});
      //       end("solved");
      //     }
      //   } else {
      //     log("move_blocked", {try: [nx,ny]});
      //   }
      //   lastMoveTime = now;
      // };

      // // Key event listeners
      // const keys = {};
      // const keydownHandler = (e) => {
      //   e.preventDefault();
      //   keys[e.key] = true;
      // };
      // const keyupHandler = (e) => {
      //   e.preventDefault();
      //   keys[e.key] = false;
      // };
      // document.addEventListener("keydown", keydownHandler);
      // document.addEventListener("keyup", keyupHandler);

      // // Game loop
      // const loop = () => {
      //   updatePosition();
      //   draw();
      //   animationFrameId = requestAnimationFrame(loop);
      // };

      // Trial end
      const end = (reason) => {
        // cancelAnimationFrame(animationFrameId);
        // document.removeEventListener("keydown", keydownHandler);
        // document.removeEventListener("keyup", keyupHandler);

        clearInterval(tickInterval);
        const t1 = performance.now();
        const rt = t1 - t0;

        // Display end message
        if (reason === "switch") {
          this.jsPsych.finishTrial({
            rt, reason, remaining, timeout: timeout_hit, events
          });
        } else {
          const endMessage = document.createElement("div");
          if (trial.maze) {
            endMessage.innerHTML = "Unfortunately, you have run out of time. Please press the spacebar to move on to the next screen."
          } else {
            endMessage.innerHTML = "Thank you for completing the practice! Please press the spacebar to move on to the next screen."
          }
          endMessage.className = "jspsych-pop-up";
          endMessage.style.display = "flex";
          containerEl.appendChild(endMessage);

          // Finish trial after spacebar pressed
          const spaceHandler = (e) => {
            e.preventDefault();
            if (e.key === " " && performance.now() - t1 > 1000) {
              document.removeEventListener("keydown", spaceHandler);
              // Finish trial
              this.jsPsych.finishTrial({
                rt, reason, remaining, timeout: timeout_hit, events
              });
            }
          }
          document.addEventListener("keydown", spaceHandler);
        }
      };

      // log("maze_show");
      // loop();
    }
  }

  return funGamePlay;
})(jsPsychModule);