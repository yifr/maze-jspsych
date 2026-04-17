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
      time_limit:             { type: ParameterType.INT, default: 120 },
      difficulty:             { type: ParameterType.INT, default: 0 },
      score_goal:             { type: ParameterType.INT, default: null },
      switch_after:           { type: ParameterType.BOOL, default: false },
      maze:                   { type: ParameterType.COMPLEX, default: null },
      on_success_message:     { type: ParameterType.STRING, default: "Congrats! You finished the game." },
      on_timeout_message:     { type: ParameterType.STRING, default: "Unfortunately, you have run out of time." },
      checkInInterval:        { type: ParameterType.INT, default: 15 },
      firstCheckIn:           { type: ParameterType.INT, default: 15 }
    },
    data: {
      rt:                     { type: ParameterType.FLOAT },
      time_remaining_or_spent:{ type: ParameterType.INT },
      reason:                 { type: ParameterType.STRING },
      timeout:                { type: ParameterType.BOOL },
      events:                 { type: ParameterType.COMPLEX },
    }
  };

  class funGamePlay {
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
              Best score: <span id = "best-score" style = "font-weight: bold;">0</span></br>
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

      let bestScore = 0;
      const bestScoreEl = display_element.querySelector("#best-score");
      const updateBestScore = (newScore) => {
        if (newScore > bestScore) {
          bestScore = newScore;
          bestScoreEl.textContent = bestScore;
        }
      };

      const timerEl = display_element.querySelector("#timer");

      if (trial.switch_after && trial.maze) {
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
      
      const game = display_element.querySelector("#game");
      const gameCtx = game.getContext("2d");
      game.className = "flappy-bird";
      game.width = gameSize;
      game.height = gameSize;

      const containerEl = display_element.querySelector("#game-and-pop-up-container");

      const updateNextCheckIn = (newVal) => {
        nextCheckIn = newVal;
      };
      const checkIn = trial.switch_after ? switchPopUpHelper(true, display_element, containerEl, trial.checkInInterval, updateNextCheckIn, () => log, () => end) : () => {};

      // Game status data and logging functions
      const t0 = performance.now();
      const events = [];
      let timeout_hit = false;
      const log = (type, payload = {}) => {console.log("log, " + type); events.push({ t: performance.now() - t0, type, payload });}
      // const pushPath = (dx, dy) => {
      //   path.push({ t: performance.now() - t0, x: pos.x, y: pos.y });
      //   moves.push([dx, dy]);
      // }

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
      } else {
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

      // Trial end
      const end = (reason) => {
        paused = true;

        clearInterval(tickInterval);
        const t1 = performance.now();
        const rt = t1 - t0;

        // Display end message
        const endMessage = document.createElement("div");
        if (reason === "switch") {
          this.jsPsych.finishTrial({
            rt, reason, time_remaining_or_spent: (trial.time_limit ? remaining : spent), timeout: timeout_hit, events
          });
          return;
        } else if (reason === "goal reached") {
          endMessage.innerHTML = trial.on_success_message + " Please press the spacebar to move on to the next screen.";
        }  else if (reason === "timeout") {
          endMessage.innerHTML = trial.on_timeout_message + " Please press the spacebar to move on to the next screen.";
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
              rt, reason, time_remaining_or_spent: (trial.time_limit ? remaining + 1 : spent - 1), timeout: timeout_hit, events
            });
          }
        }
        document.addEventListener("keydown", spaceHandler);
      };

      // Play fun game
      flappyBird(game, gameCtx, trial.difficulty, () => paused, () => t0, trial.score_goal, updateBestScore, end);
    }
  }

  return funGamePlay;
})(jsPsychModule);