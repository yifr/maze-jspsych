async function fetchMazes() {
  const res = await fetch("/generate_mazes");
  return await res.json();
}

fetchMazes().then((mazes) => {
  const jsPsych = jsPsychModule.initJsPsych({
    on_finish: () => jsPsych.data.displayData(),
  });

  let main_timeline = [];

  // Ensure each maze has an id
  mazes.forEach((m, i) => {
    m.id = m.id || `maze_${i}`;
  });

  // --- Maze selection screen ---
  const selectTrial = {
    type: MazeSelectPlugin,
    mazes: mazes,
    cols: 3,
    on_finish: (data) => {
      const chosen = data.choice_maze || mazes[data.choice_idx];
      if (!chosen) return;

      // When a maze is selected, push its play trial next
      const playTrial = makeMazeTrial(chosen);
      main_timeline.push(playTrial);
    },
  };

  // --- Maze play trial template ---
  const makeMazeTrial = (maze) => ({
    type: MazePlayPlugin,
    maze: maze.grid,
    difficulty: maze.difficulty,
    start: maze.start,
    end: maze.end,
    time_limit: 20000,
    data: { maze_id: maze.id, difficulty: maze.difficulty },
    on_finish: () => {
      // After completing a maze, mark it as "played"
      const playedIDs = jsPsych.data
        .get()
        .values()
        .filter((d) => d.trial_type === "maze-play")
        .map((d) => d.maze_id);

      const totalReward = jsPsych.data
        .get()
        .values()
        .filter((d) => d.trial_type === "maze-play")
        .reduce((sum, d) => sum + (d.reward || 0), 0);

      console.log("Played so far:", playedIDs);
      console.log("Total reward so far:", totalReward);
      console.log(jsPsych.data.get().values());

      // Re-render selectTrial with updated greying
      if (playedIDs.length < mazes.length) {
        main_timeline.push({
          ...selectTrial,
          mazes: mazes, // pass all mazes, plugin greys out played ones
          solvedIDs: playedIDs,
          totalReward: totalReward,
        });
      }
    },
  });

  // --- Start experiment ---
  main_timeline.push(selectTrial);
  jsPsych.run(main_timeline);
});
