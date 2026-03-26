/* jsPsych v8 plugin (UMD/IIFE): maze-play
   Maze format: 0=open, 1=wall; start/end: [x,y]
*/
var MazePlayPlugin = (function (jspsych) {
  "use strict";
  const { ParameterType } = jspsych;

  const info = {
    name: "maze-play",
    version: "1.0.1",
    parameters: {
      maze:        { type: ParameterType.COMPLEX, default: undefined },
      difficulty:  { type: ParameterType.FLOAT, default: 0 },
      start:       { type: ParameterType.INT, array: true, default: [0, 0] },
      end:         { type: ParameterType.INT, array: true, default: [0, 0] },
      cell_size:   { type: ParameterType.INT, default: 25 },
      wall_color:  { type: ParameterType.STRING, default: "#111827" },
      bg_color:    { type: ParameterType.STRING, default: "#ffffff" },
      start_color: { type: ParameterType.STRING, default: "#0ea5e9" },
      goal_color:  { type: ParameterType.STRING, default: "#22c55e" },
      player_color:{ type: ParameterType.STRING, default: "#111827" },
      time_limit:  { type: ParameterType.INT, default: null }
    },
    data: {
      rt:          { type: ParameterType.FLOAT },
      reason:      { type: ParameterType.STRING },
      solved:      { type: ParameterType.BOOL },
      timeout:     { type: ParameterType.BOOL },
      start:       { type: ParameterType.COMPLEX },
      end:         { type: ParameterType.COMPLEX },
      final_pos:   { type: ParameterType.COMPLEX },
      path:        { type: ParameterType.COMPLEX },
      events:      { type: ParameterType.COMPLEX },
      reward:      { type: ParameterType.FLOAT }
    }
  };

  class MazePlay {
    constructor(jsPsych) { this.jsPsych = jsPsych; }
    static info = info;

    trial(display_element, trial) {
      const src = trial.maze;
      const rows = src.length;
      const cols = src[0].length;

      // Defensive bounds
      const sx = Math.max(0, Math.min(cols - 1, trial.start[0]));
      const sy = Math.max(0, Math.min(rows - 1, trial.start[1]));
      const gx = Math.max(0, Math.min(cols - 1, trial.end[0]));
      const gy = Math.max(0, Math.min(rows - 1, trial.end[1]));

      // Play grid: copy and force start/goal to open
      const grid = src.map(r => r.slice());
      grid[sy][sx] = 0;
      grid[gy][gx] = 0;

      const cs = trial.cell_size;
      const pad = 8;
      const W = cols * cs + pad * 2;
      const H = rows * cs + pad * 2;

      display_element.innerHTML = `
        <div style="font-family:system-ui,-apple-system,sans-serif;">
          <div id="hud" style="display:flex;justify-content:space-between;
              align-items:center;margin-bottom:6px;font-size:14px;color:#374151;">
            <div>Arrow keys to move · Esc to leave</div>
            <div id="timer"></div>
          </div>
          <canvas id="maze" width="${W}" height="${H}"
            style="border:1px solid #e5e7eb;border-radius:10px;display:block;margin:auto;"></canvas>
        </div>`;
      const ctx = display_element.querySelector("#maze").getContext("2d");
      const timerEl = display_element.querySelector("#timer");
      if (trial.time_limit) {
        // Initial style
        timerEl.style.fontSize = "18px";
        timerEl.style.fontWeight = "600";
        timerEl.style.transition = "all 0.3s ease";
        timerEl.style.color = "#374151"; // gray-700

        let remaining = Math.ceil(trial.time_limit / 1000);
        const updateTimer = () => {
          if (remaining <= 0) return;

          // Style shift as time runs out
          if (remaining <= 5) {
            timerEl.style.color = remaining <= 2 ? "#dc2626" : "#f59e0b"; // red or amber
            timerEl.style.transform = "scale(1.2)";
            timerEl.style.textShadow = "0 0 8px rgba(255,0,0,0.4)";
          } else {
            timerEl.style.color = "#374151";
            timerEl.style.transform = "scale(1.0)";
            timerEl.style.textShadow = "none";
          }

          timerEl.textContent = `⏱ ${remaining}s`;
          remaining--;
        };

        // Initialize
        updateTimer();

        // Tick interval with pulse reset
        var tickInterval = setInterval(() => {
          updateTimer();
          if (remaining < 0) clearInterval(tickInterval);
        }, 1000);
      }

      const pos  = { x: sx, y: sy };
      const goal = { x: gx, y: gy };
      const t0 = performance.now();
      const path = [];
      const events = [];
      let solved = false;
      let timeout_hit = false;

      const colors = {
        bg: trial.bg_color, wall: trial.wall_color,
        start: trial.start_color, goal: trial.goal_color, player: trial.player_color
      };

      const log = (type, payload={}) => events.push({ t: performance.now()-t0, type, payload });
      const pushPath = () => path.push({ t: performance.now()-t0, x: pos.x, y: pos.y });

      const draw = () => {
        ctx.fillStyle = colors.bg; ctx.fillRect(0,0,W,H);
        // walls from play grid
        ctx.fillStyle = colors.wall;
        for (let y=0;y<rows;y++) for (let x=0;x<cols;x++)
          if (grid[y][x] === 1) ctx.fillRect(pad+x*cs, pad+y*cs, cs, cs);
        // start and goal markers
        ctx.fillStyle = colors.start;
        ctx.fillRect(pad+sx*cs+3, pad+sy*cs+3, cs-6, cs-6);
        ctx.fillStyle = colors.goal;
        ctx.fillRect(pad+gx*cs+3, pad+gy*cs+3, cs-6, cs-6);
        // player
        ctx.fillStyle = colors.player;
        ctx.beginPath();
        ctx.arc(pad+pos.x*cs+cs/2, pad+pos.y*cs+cs/2, cs/3, 0, Math.PI*2);
        ctx.fill();
      };

      const inBounds = (x,y)=> x>=0 && x<cols && y>=0 && y<rows;
      const isOpen = (x,y)=> inBounds(x,y) && grid[y][x] === 0;

      const move = (dx,dy) => {
        const nx = pos.x+dx, ny = pos.y+dy;
        if (isOpen(nx,ny)) {
          pos.x=nx; pos.y=ny;
          pushPath(); log("move_ok",{to:[nx,ny]});
          draw();
          if (nx===goal.x && ny===goal.y) {
            solved = true;
            log("solve",{path_len:path.length});
            end("solved");
          }
        } else {
          log("move_blocked",{try:[nx,ny]});
        }
      };

      const onKey = (e) => {
        if (e.key==="ArrowUp")   { e.preventDefault(); move(0,-1); }
        if (e.key==="ArrowDown") { e.preventDefault(); move(0, 1); }
        if (e.key==="ArrowLeft") { e.preventDefault(); move(-1,0); }
        if (e.key==="ArrowRight"){ e.preventDefault(); move(1,0); }
        if (e.key==="Escape") end("left");
      };
      document.addEventListener("keydown", onKey);

      let timer = null;
      if (trial.time_limit) {
        timer = setTimeout(()=>{ timeout_hit=true; log("timeout"); end("timeout"); }, trial.time_limit);
      }

      const end = (reason) => {
        document.removeEventListener("keydown", onKey);
        if (timer) clearTimeout(timer);
        if (tickInterval) clearInterval(tickInterval);
        const rt = performance.now()-t0;

        const reward = reason === "solved" ? trial.difficulty : 0;

        this.jsPsych.finishTrial({
          rt, reason, solved, timeout: timeout_hit, 
          start: [sx,sy], end: [gx,gy], final_pos: [pos.x,pos.y],
          path, events, reward
        });
      };

      log("maze_show", { rows, cols, start: [sx,sy], end: [gx,gy] });
      pushPath(); draw();
    }
  }

  return MazePlay;
})(jsPsychModule);
