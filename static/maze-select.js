// jsPsych v8 UMD plugin: MazeSelectPlugin
// Renders multiple same-sized maze previews, user clicks one to choose.

var MazeSelectPlugin = (function (jspsych) {
  "use strict";
  const { ParameterType } = jspsych;

  const info = {
    name: "maze-select",
    version: "1.1.0",
    parameters: {
      mazes: { type: ParameterType.COMPLEX, default: [] },
      cols:  { type: ParameterType.INT, default: 3 },
      solvedIDs: { type: ParameterType.COMPLEX, default: [] },
      totalReward: { type: ParameterType.FLOAT, default: 0 },
      preview_size: { type: ParameterType.INT, default: 230 } // pixel side for each square
    },
    data: {
      choice_id: { type: ParameterType.STRING },
      choice_idx: { type: ParameterType.INT },
      choice_difficulty: { type: ParameterType.FLOAT },
      choice_maze: { type: ParameterType.COMPLEX }
    }
  };

  class MazeSelectPluginClass {
    constructor(jsPsych) { this.jsPsych = jsPsych; }
    static info = info;

    trial(display_element, trial) {
      const mazes = trial.mazes.slice(0, 6);
      const cols = trial.cols;
      const side = trial.preview_size;
      const t0 = performance.now();

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

      // --- Base layout ---
      display_element.innerHTML = `
        <div style="font-family:system-ui,-apple-system,sans-serif;text-align:center;">
          <h2 style="margin-bottom:10px;color:#111827;">Select a Maze</h2>
          <h2 style="margin-top:0px;margin-bottom:20px;font-weight:400;color:#6b7280;">Total reward earned so far: <span id="total-reward">${trial.totalReward}</span> pts</h2>
          <div id="maze-grid" style="
              display:grid;
              grid-template-columns:repeat(${cols}, ${side}px);
              gap:24px;
              justify-content:center;"> 
          </div>
        </div>`;
      if (!document.getElementById("score-anim-style")) {
        const style = document.createElement("style");
        style.id = "score-anim-style";
        style.textContent = `
          @keyframes scorePop {
            0%   { transform: scale(1);   color: #f59e0b; }   /* amber-500 */
            40%  { transform: scale(1.6); color: #fbbf24; }   /* amber-400 */
            70%  { transform: scale(1.3); color: #facc15; }   /* amber-300 */
            100% { transform: scale(1.0); color: #111827; }   /* gray-900 */
          }
        `;
        document.head.appendChild(style);
      }

      const grid = display_element.querySelector("#maze-grid");
        
      // --- Create uniform square previews ---
      mazes.forEach((m, i) => {
        m.id = m.id || `maze_${i}`;
        const gridData = m.grid || m.data;
        const isSolved = trial.solvedIDs.includes(m.id);
        const rows = gridData.length, colsM = gridData[0].length;
        const canvas_container = document.createElement("div");
        const canvas = document.createElement("canvas");

        // Update total reward display
        const totalRewardEl = display_element.querySelector("#total-reward");

        // Animate score if it increased since last time
        if (trial.totalReward > 0) {
          totalRewardEl.textContent = trial.totalReward;
          totalRewardEl.style.animation = "scorePop 0.7s ease";
          totalRewardEl.addEventListener("animationend", () => {
            totalRewardEl.style.animation = "none";
          }, { once: true });
        } else {
          totalRewardEl.textContent = trial.totalReward;
        }


        // Add reward based on difficulty as a title above the canvas
        const reward = m.difficulty;
        const title = document.createElement("div");
        title.innerText = `Reward: ${reward} pts`;
        title.style.fontSize = "14px";
        title.style.marginBottom = "6px";
        title.style.color = "#374151";
        title.style.fontWeight = "500";
        canvas_container.appendChild(title);

        canvas.width = side;
        canvas.height = side;
        canvas.style.border = "2px solid #e5e7eb";
        canvas.style.borderRadius = "8px";
        canvas.style.cursor = "pointer";
        canvas.style.boxShadow = "0 1px 3px rgba(0,0,0,0.1)";
        canvas.style.transition = "transform 0.1s ease, box-shadow 0.1s ease";
        canvas.onmouseenter = () => {
          canvas.style.transform = "scale(1.05)";
          canvas.style.boxShadow = "0 4px 8px rgba(0,0,0,0.2)";
        };
        canvas.onmouseleave = () => {
          canvas.style.transform = "scale(1.0)";
          canvas.style.boxShadow = "0 1px 3px rgba(0,0,0,0.1)";
        };

        // draw to fit proportionally
        const ctx = canvas.getContext("2d");
        const cellSize = Math.min(side / colsM, side / rows);
        const padX = (side - colsM * cellSize) / 2;
        const padY = (side - rows * cellSize) / 2;

        // background
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, side, side);

        // walls
        ctx.fillStyle = "#111";
        for (let y = 0; y < rows; y++) {
          for (let x = 0; x < colsM; x++) {
            if (gridData[y][x])
              ctx.fillRect(padX + x * cellSize, padY + y * cellSize, cellSize, cellSize);
          }
        }

        // start and end markers
        ctx.fillStyle = "#0ea5e9";
        ctx.fillRect(padX + m.start[0] * cellSize + 1, padY + m.start[1] * cellSize + 1, cellSize - 2, cellSize - 2);
        ctx.fillStyle = "#22c55e";
        ctx.fillRect(padX + m.end[0] * cellSize + 1, padY + m.end[1] * cellSize + 1, cellSize - 2, cellSize - 2);

        if (!isSolved) {
            canvas.addEventListener("click", () => choose(i));
        } else {
            // Grey out solved mazes and disable click
            canvas.style.filter = "grayscale(100%)";
            canvas.style.opacity = "0.5";
            canvas.style.cursor = "not-allowed";
        }
        canvas_container.appendChild(canvas);
        grid.appendChild(canvas_container);
      });

      const choose = (idx) => {
        const rt = performance.now() - t0;
        const chosen = mazes[idx];
        this.jsPsych.finishTrial({
          rt,
          choice_id: chosen.id ?? `maze_${idx}`,
          choice_idx: idx,
          choice_difficulty: chosen.difficulty ?? null,
          choice_maze: chosen
        });
      };
    }
  }

  return MazeSelectPluginClass;
})(jsPsychModule);
