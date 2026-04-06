async function fetchMazes() {
  const res = await fetch("/generate_mazes");
  return await res.json();
}

async function main() {
  const mazes = await fetchMazes();

  // Initialize jsPsych
  const jsPsych = initJsPsych({ on_finish: () => jsPsych.data.displayData() });
  jsPsych

  // Create timeline
  const timeline = [];

  // // Make window fullscreen
  // timeline.push({
  //   type: jsPsychFullscreen,
  //   fullscreen_mode: true
  // });

  // Give instructions
  const instructions = {
    type: jsPsychInstructions,
    pages: [`
        <p>Welcome!</p>
        <p>In this experiment, you will be asked to complete a maze. Mazes vary in difficulty level.</p>
        <p>To get a sense of how hard the mazes and to learn the controls, you will be asked to solve a <strong>practice maze</strong> on the next screen.<br>
        This maze is not timed, but you should try to complete it as fast as possible.</p>
        <p>To navigate the maze, use the <strong>arrow</strong> (or WASD) keys.</p>
        <p>When you have read through all the instructions, please press the <strong>spacebar</strong> to start the practice maze.</p>
    `],
    key_forward: " "
  };
  timeline.push(instructions);

  // Run familiarity phase to practice solving a maze and calibrate competence
  const familiarityPhase = (maze) => ({
    type: MazePlayPlugin,
    maze: maze,
    time_limit: null,
    data: { maze_id: maze.id, difficulty: maze.difficulty },
    on_finish: (data) => {
      timeline.push(priorPhase(maze.difficulty, Math.floor(data.rt / 1000)));
    }
  });
  timeline.push(familiarityPhase(mazes[0]));     // need to choose familiarity maze

  // Collect data about participants' priors of competence
  const priorPhase = (practiceDifficulty, practiceTime) => ({
    type: jsPsychSurveyText,
    preamble: `
      <p>Mazes have difficulty ranging from 1 to 100.</p>
      <p>You finished the practice maze, which has <strong>difficulty ${practiceDifficulty}</strong>, in <strong>${Math.floor(practiceTime / 60)} min ${practiceTime % 60} sec</strong>.</p>
    `,
    questions: [
      {prompt: "If you tried your hardest, what is the most difficult maze you believe you could complete within 2 minutes? Please enter the difficulty level:", required: true}
    ],
    on_finish: (data) => {
      timeline.push(rankPhase(practiceDifficulty, practiceTime));
    }
  });
  // timeline.push(priorPhase(0, 0));

  // Ask participants to rank mazes in order of preference
  const rankPhase = (practiceDifficulty, practiceTime) => ({
    type: MazeRankPlugin,
    mazes: mazes,
    cols: 3,
    practiceDifficulty: practiceDifficulty,
    practiceTime: practiceTime,
    on_finish: (data) => {
      timeline.push(assignmentPhase(mazes, data.ordering));
    }
  });
  // timeline.push(rankPhase(0, 0));

  // Assign participants to either procrastination or non-procrastination condition
  const assignmentPhase = (mazes, ordering) => ({
    type: MazeAssignPlugin,
    mazes: mazes,
    ordering: ordering,
    on_finish: (data) => {
      timeline.push(funGamePhase(data.procrastination, data.assignedMaze));
    }
  });
  // timeline.push(assignmentPhase(mazes, [0, 1, 2, 3, 4, 5]));

  // Start off by playing a fun game
  const funGamePhase = (procrastination, maze) => ({
    type: funGamePlayPlugin,
    maze: maze,
    time_limit: 120,
    procrastination: procrastination,
    checkInInterval: 15,
    firstCheckIn: 15,
    on_finish: (data) => {
      if (data.reason === "switch") {
        timeline.push(finalMazePhase(procrastination, maze, data.remaining));
      }
    }
  })
  // timeline.push(funGamePhase(true, mazes[5]));

  // Eventually switch over to solving assigned maze
  const finalMazePhase = (procrastination, maze, remaining) => ({
    type: MazePlayPlugin,
    maze: maze,
    time_limit: remaining,
    procrastination: procrastination,
    on_finish: (data) => {
      timeline.push(conclusion(data.reward));
    }
  });

  // Conclude experiment
  const conclusion = (reward) => ({
    type: jsPsychInstructions,
    pages: [`
        <p>[You have earned a reward of ${reward}! or something]</p>
        <p>Thank you for participating in this experiment!</p>
    `],
    key_forward: " "
  });

  // Run experiment
  jsPsych.run(timeline);
}

main();