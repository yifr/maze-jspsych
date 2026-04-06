// Helper function to draw start/end arrows
function drawArrowHelper(ctx, rows, cols, cs, pad, x, y, start) {
  // Position arrow
  ctx.save();
  ctx.translate(pad + x*cs + cs/2, pad + y*cs + cs/2);
  if (y === 0) {
    ctx.rotate(0.5*Math.PI)
  } else if (x === cols - 1) {
    ctx.rotate(Math.PI)
  } else if (y === rows - 1) {
    ctx.rotate(1.5*Math.PI)
  }
  ctx.translate(-1.1*cs, 0);
  if (!start) {
    ctx.rotate(Math.PI)
  }

  // Draw arrow
  ctx.beginPath();
  ctx.moveTo(-0.5*cs, 0);
  ctx.lineTo(0.3*cs, 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.lineTo(0.5*cs, 0);
  ctx.lineTo(0.05*cs, -0.3*cs);
  ctx.lineTo(0.05*cs, 0.3*cs);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

// Helper function to draw maze game board
function drawHelper(ctx, maze, moves, pos, vw, vh, canvasSizeCoeff, padCoeff, centerToView) {
  const colors = { bg: "#ffffff", wall: "#606060", start: "#0ea5e9", end: "#22c55e", player: "#000000" };
  
  // Maze display data
  const src = maze.grid;
  const rows = src.length;
  const cols = src[0].length;

  // Copy grid and force start/end to open
  const [sx, sy] = maze.start;
  const [ex, ey] = maze.end;
  const grid = src.map(g => g.slice());
  grid[sy][sx] = 0;
  grid[ey][ex] = 0;

  // Calculate sizes
  const cs = Math.floor(Math.min((canvasSizeCoeff * vw) / ((2 * padCoeff) + cols), (canvasSizeCoeff * vh) / ((2 * padCoeff) + rows)));
  const pad = Math.round(padCoeff * cs);
  const W = 2 * pad + cols * cs;
  const H = 2 * pad + rows * cs;

  // Draw background and walls
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, vw, vh);
  if (centerToView) {
    ctx.save();
    ctx.translate(Math.round(((canvasSizeCoeff * vw) - W) / 2), Math.round(((canvasSizeCoeff * vh) - H) / 2));
  }
  ctx.fillStyle = colors.wall;
  ctx.lineWidth = 1;
  ctx.strokeStyle = colors.wall;
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++)
    if (grid[y][x] === 1) {
      ctx.fillRect(pad + x*cs, pad + y*cs, cs, cs);
    }
  
  // Draw start and finish markers
  ctx.lineWidth = Math.ceil(cs / 7);
  ctx.strokeStyle = colors.start;
  ctx.fillStyle = colors.start;
  drawArrowHelper(ctx, rows, cols, cs, pad, sx, sy, true);
  ctx.strokeStyle = colors.end;
  ctx.fillStyle = colors.end;
  drawArrowHelper(ctx, rows, cols, cs, pad, ex, ey, false);

  // Draw past moves
  if (moves) {
    ctx.lineWidth = Math.ceil(cs / 14);
    ctx.strokeStyle = colors.player;
    ctx.beginPath();
    let curX = pad + sx*cs + cs/2;
    let curY = pad + sy*cs + cs/2;
    ctx.moveTo(curX, curY);
    for (const [dx, dy] of moves) {
      curX += dx*cs;
      curY += dy*cs;
      ctx.lineTo(curX, curY);
    }
    ctx.stroke();
  }
  
  // Draw player icon
  if (pos) {
    ctx.fillStyle = colors.player;
    ctx.beginPath();
    ctx.arc(pad + pos.x*cs + cs/2, pad + pos.y*cs + cs/2, cs/3, 0, Math.PI*2);
    ctx.fill();
  }

  if (centerToView) { ctx.restore(); }

  return [grid, rows, cols, sx, sy, ex, ey, W, H];
};