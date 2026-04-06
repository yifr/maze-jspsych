// jsPsych v8 UMD plugin: MazeRankPlugin
// Renders multiple same-sized maze previews, user clicks one to choose.

var MazeAssignPlugin = (function (jspsych) {
  "use strict";
  const { ParameterType } = jspsych;

  const info = {
    name: "maze-assign",
    version: "1.0",
    parameters: {
      mazes:          { type: ParameterType.COMPLEX, default: [] },
      ordering:       { type: ParameterType.COMPLEX, default: undefined },
      previewSize:    { type: ParameterType.INT, default: null },
      reward:         { type: ParameterType.INT, default: 0 }
    },
    data: {
      rt:             { type: ParameterType.FLOAT },
      procrastination:{ type: ParameterType.BOOL },
      assignedMaze:   { type: ParameterType.COMPLEX }
    }
  };

  class MazeAssignPluginClass {
    constructor(jsPsych) { this.jsPsych = jsPsych; }
    static info = info;

    trial(display_element, trial) {
      const procrastination = (Math.random() >= 0.5);
      const assignedMaze = trial.mazes[procrastination ? trial.ordering.slice(-1)[0] : trial.ordering[0]];
      const t0 = performance.now();
      
      // Base layout for instructions and maze preview
      display_element.innerHTML = `
        <div style = "font-size: 16px;">
          <p>You have been assigned the maze below, which has difficulty ${assignedMaze.difficulty}.</p>
          <p>You will have <strong>2 minutes</strong> to complete the maze, after which point the experiment will end. If you finish the maze in the time, you will receive a reward of [reward].</p>
          <p>There are two tasks you can do during that time: one is a <strong>fun game</strong>, and one is your <strong>assigned maze</strong>.<br>
          You will start by playing the game, and can choose when to switch to the maze (but you can't switch back).<br>
          It's up to how much time you spend on each activity, but remember the total time across <strong>both</strong> tasks is 2 minutes.</p>
          <p>When you have read through all the instructions, please press the <strong>spacebar</strong> to start the timed experiment.</p>
          <canvas id="maze" style="border: 1px solid #dddddd;"></canvas>
        </div>`;
      const ctx = display_element.querySelector("#maze").getContext("2d");

      const mazeSize = 300;
      display_element.querySelector("#maze").width = mazeSize;
      display_element.querySelector("#maze").height = mazeSize;

      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const canvasSizeCoeff = 0.8;
      const padCoeff = 1.2;
      // Initialize game board and maze constants
      drawHelper(ctx, assignedMaze, null, null, mazeSize, mazeSize, 1, padCoeff, true);
      // drawHelper(ctx, assignedMaze, null, null, vw, vh, canvasSizeCoeff, padCoeff, false);
      // display_element.querySelector("#maze").width = `${W}`;
      // display_element.querySelector("#maze").height = `${H}`;
      
      // Finish trial after spacebar pressed
      const spaceHandler = (e) => {
        e.preventDefault();
        if (e.key === " " && performance.now() - t0 > 1000) {
          document.removeEventListener("keydown", spaceHandler);
          const rt = performance.now() - t0;
          // Finish trial
          this.jsPsych.finishTrial({ rt, procrastination, assignedMaze });
        }
      }
      document.addEventListener("keydown", spaceHandler);
    };
  }

  return MazeAssignPluginClass;
})(jsPsychModule);
