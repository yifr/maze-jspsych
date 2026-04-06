// jsPsych v8 UMD plugin: MazeRankPlugin
// Renders multiple same-sized maze previews, user clicks one to choose.

var MazeRankPlugin = (function (jspsych) {
  "use strict";
  const { ParameterType } = jspsych;

  const info = {
    name: "maze-rank",
    version: "1.0",
    parameters: {
      mazes:              { type: ParameterType.COMPLEX, default: [] },
      cols:               { type: ParameterType.INT, default: 3 },
      previewSize:        { type: ParameterType.INT, default: null },
      practiceDifficulty: { type: ParameterType.INT, default: null },
      practiceTime:       { type: ParameterType.INT, default: null },
      bg_color:           { type: ParameterType.STRING, default: "#ffffff" },
      wall_color:         { type: ParameterType.STRING, default: "#606060" },
      start_color:        { type: ParameterType.STRING, default: "#0ea5e9" },
      end_color:          { type: ParameterType.STRING, default: "#22c55e" },
      player_color:       { type: ParameterType.STRING, default: "#000000" },
      procrastination:    { type: ParameterType.BOOL, default: null }
    },
    data: {
      rt:                 { type: ParameterType.FLOAT },
      ordering:           { type: ParameterType.COMPLEX }
    }
  };

  class MazeRankPluginClass {
    constructor(jsPsych) { this.jsPsych = jsPsych; }
    static info = info;

    trial(display_element, trial) {
      const mazes = trial.mazes;
      const t0 = performance.now();
      const practiceDifficulty = trial.practiceDifficulty;
      const practiceTime = trial.practiceTime;
      const gridCols = trial.cols;
      const canvasSizeCoeff = 0.5;
      const gapCoeff = 0.3;
      const side = trial.previewSize ? trial.previewSize : Math.round((canvasSizeCoeff * window.innerWidth) / ((1 + gapCoeff) * gridCols));

      // Use made up rewards based on grid size for now:
      mazes.forEach((m, i) => {
        m.difficulty = (m.grid.length + m.grid[0].length + i); 
      });

      // Normalize difficulties so easiest is 10, hardest is 100
      const difficulties = mazes.map(m => m.difficulty);
      const minDiff = Math.min(...difficulties);
      const maxDiff = Math.max(...difficulties);
      mazes.forEach(m => {
        if (maxDiff > minDiff) {
          m.difficulty = Math.round(10 + 90 * (m.difficulty - minDiff) / (maxDiff - minDiff));
        }
        else {
          m.difficulty = 50; // all same difficulty
        }
      });


      console.log("Normalized difficulties:", mazes.map(m => m.difficulty));
      
      // Sort mazes based on 
      mazes.sort((a, b) => a.difficulty - b.difficulty);

      // Base layout for instructions and mazes
      display_element.innerHTML = `
        <div style = "font-size: 16px;">
          <p>You finished the practice maze (difficulty ${practiceDifficulty}) in ${Math.floor(practiceTime / 60)} min ${practiceTime % 60} sec.</p>
          <p>Please <strong>rank the following mazes</strong> in order of preference (click and drag to reorder).<br>
          You will be assigned <strong>one</strong> of these mazes in the main round. If you successfully complete it, you will earn a reward proportional to the difficulty level.<br>
          Note that you will not necessarily be assigned the maze you rank first.</p>
          <p>Please press the <strong>spacebar</strong> when you are done.</p>
          <div id = "maze-grid" style = "
              display: grid;
              grid-template-columns: repeat(${gridCols}, ${side}px);
              column-gap: ${Math.round(side * gapCoeff)}px;
              row-gap: ${Math.round(side * (gapCoeff - 0.1))}px;
              justify-content: center;"> 
          </div>
          <div id = "rank-overlay" style = "
              pointer-events: none;
              position: absolute;
              top: 0;
              left: 0;">
          </div>
        </div>`;

      const gridDisplay = display_element.querySelector("#maze-grid");
      const rankOverlay = display_element.querySelector("#rank-overlay");
        
      // Draw maze previews
      mazes.forEach((maze, id) => {
        maze.id = maze.id || `maze-${id}`;

        // Make a container for each option
        const canvasContainer = document.createElement("div");
        canvasContainer.id = `maze-${id}-container`;
        canvasContainer.draggable = "true";
        canvasContainer.className = "jspsych-canvas-container";
        canvasContainer.style.backgroundColor = trial.bg_color;
        canvasContainer.style.width = `${Math.round(side * 1.1)}px`;

        // Draw the maze
        const canvas = document.createElement("canvas");
        canvas.id = `maze-${id}-canvas`;
        canvas.width = side;
        canvas.height = side;
        const ctx = canvas.getContext("2d");
        const padCoeff = 1.2;
        drawHelper(ctx, maze, null, null, side, side, 1, padCoeff, true);
        canvasContainer.appendChild(canvas);

        // Add a label
        const label = document.createElement("div");
        label.id = `maze-${id}-label`;
        label.style.textAlign = "center";
        label.textContent = `Difficulty: ${maze.difficulty}`;
        canvasContainer.appendChild(label);

        gridDisplay.appendChild(canvasContainer);

        // Rank badge is overlayed to show order of preference
        const rankBadge = document.createElement("div");
        rankBadge.textContent = `#${id + 1}`;
        rankBadge.className = "jspsych-rank-badge";
        rankBadge.style.width = `${Math.max(side / 6, 25)}px`;
        rankBadge.style.height = `${Math.max(side / 6, 25)}px`;
        rankOverlay.appendChild(rankBadge);
      });

      // Fix location of rank badges
      const updateBadges = () => {
        const allCanvasContainers = Array.from(gridDisplay.children);
        const allRankBadges = Array.from(rankOverlay.children);

        allCanvasContainers.forEach((canvasContainer, index) => {
          const rect = canvasContainer.getBoundingClientRect();
          const rankBadge = allRankBadges[index];
          rankBadge.style.left = `${rect.left}px`;
          rankBadge.style.top = `${rect.top}px`;
        });
      }
      updateBadges();
      window.addEventListener("resize", updateBadges);

      // Handle dragging and reordering
      let draggedElement = null;
      gridDisplay.addEventListener("dragstart", (e) => {
        draggedElement = e.target;
        e.dataTransfer.effectAllowed = "move";
        e.target.style.opacity = "0.5";
      });
      gridDisplay.addEventListener("dragend", (e) => {
        e.target.style.opacity = "1";
      });
      gridDisplay.addEventListener("dragover", (e) => {
        e.preventDefault();
        const currentElement = document.elementsFromPoint(e.clientX, e.clientY).filter(el => el.draggable)[0];
        if (currentElement && currentElement !== draggedElement) {
          const allCanvasContainers = Array.from(gridDisplay.children);
          const draggedIndex = allCanvasContainers.indexOf(draggedElement);
          const currentIndex = allCanvasContainers.indexOf(currentElement);

          // Insert before or after the current element depending on direction
          if (draggedIndex < currentIndex) {
            gridDisplay.insertBefore(draggedElement, currentElement.nextSibling);
          } else if (draggedIndex > currentIndex) {
            gridDisplay.insertBefore(draggedElement, currentElement);
          }
        }
      });
      gridDisplay.addEventListener("drop", (e) => { e.preventDefault(); });

      // Finish trial after spacebar pressed
      const spaceHandler = (e) => {
        e.preventDefault();
        if (e.key === " " && performance.now() - t0 > 1000) {
          document.removeEventListener("keydown", spaceHandler);
          const rt = performance.now() - t0;
          const ordering = Array.from(gridDisplay.children).map(el => parseInt(el.id.match(/-\d+-/)[0].slice(1, -1)));
          // Finish trial
          this.jsPsych.finishTrial({ rt, ordering });
        }
      }
      document.addEventListener("keydown", spaceHandler);
    };
  }

  return MazeRankPluginClass;
})(jsPsychModule);
