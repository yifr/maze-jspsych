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

  // Make window fullscreen
  timeline.push({
    type: jsPsychFullscreen,
    fullscreen_mode: true
  });

  // Give instructions for maze
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
  const mazeFamiliarityPhase = (maze) => ({
    type: MazePlayPlugin,
    maze: maze,
    time_limit: null,
    data: { maze_id: maze.id, difficulty: maze.difficulty },
    on_finish: (data) => {
      timeline.push(priorPhase(maze.difficulty, Math.floor(data.rt / 1000)));
      timeline.push(rankPhase(maze.difficulty, Math.floor(data.rt / 1000)));
    }
  });
  timeline.push(mazeFamiliarityPhase(mazes[0]));     // need to choose familiarity maze

  // Collect data about participants' priors of competence
  const priorPhase = (practiceDifficulty, practiceTime) => ({
    type: jsPsychSurveyText,
    preamble: `
      <p>Mazes have difficulty ranging from 1 to 100.</p>
      <p>You finished the practice maze, which has <strong>difficulty ${practiceDifficulty}</strong>, in <strong>${Math.floor(practiceTime / 60)} min ${practiceTime % 60} sec</strong>.</p>
    `,
    questions: [
      {
        prompt: "If you tried your hardest, what is the most difficult maze you believe you could complete within 2 minutes? Please enter the difficulty level:",
        required: true
      }
    ],
  });

  // Ask participants to rank mazes in order of preference
  const rankPhase = (practiceDifficulty, practiceTime) => ({
    type: MazeRankPlugin,
    mazes: mazes,
    cols: 3,
    practiceDifficulty: practiceDifficulty,
    practiceTime: practiceTime,
    on_finish: (data) => {
      timeline.push(funGameInstructions);
      timeline.push(funGameFamiliarityPhase);
      timeline.push(mainuplationCheckPhase);
      timeline.push(assignmentPhase(mazes, data.ordering));
    }
  });

  // Give instructions for fun game
  const funGameInstructions = {
    type: jsPsychInstructions,
    pages: [`
        <p>In addition to the maze, you'll also have the opportunity to play a game during the experiment.</p>
        <p>To get a sense of how to play the game, you will be given <strong>one minute</strong> to practice playing it on the next screen.</p>
        <p>To control the game, you can use the <strong>spacebar</strong>, up arrow key, W key, or left-click.</p>
        <p>When you have read through all the instructions, please press the <strong>spacebar</strong> to start the practice game.</p>
    `],
    key_forward: " "
  };

  // Run familiarity phase to practice playing fun game and check manipulation
  const funGameFamiliarityPhase = {
    type: funGamePlayPlugin,
    time_limit: 60
  };

  // Check whether the game was empirically fun
  const mainuplationCheckPhase = {
    type: jsPsychSurveyMultiChoice,
    preamble: `
      <p>You just finished playing a game for one minute.</p>
    `,
    questions: [
      {
        prompt: "Did you enjoy playing the game?",
        name: "ManipulationCheck", 
        options: ["Yes", "No"], 
        required: true
      }
    ],
  };

  // Assign participants to either procrastination or non-procrastination condition
  const assignmentPhase = (mazes, ordering) => ({
    type: MazeAssignPlugin,
    mazes: mazes,
    ordering: ordering,
    on_finish: (data) => {
      timeline.push(funGameFinalPhase(data.procrastination, data.assignedMaze));
    }
  });

  // Start off by playing a fun game
  const funGameFinalPhase = (procrastination, maze) => ({
    type: funGamePlayPlugin,
    maze: maze,
    time_limit: 120,
    procrastination: procrastination,
    checkInInterval: 15,
    firstCheckIn: 15,
    on_finish: (data) => {
      if (data.reason === "switch") {
        timeline.push(mazeFinalPhase(procrastination, maze, data.remaining));
      }
    }
  })

  // Eventually switch over to solving assigned maze
  const mazeFinalPhase = (procrastination, maze, remaining) => ({
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
        <p>You have earned a reward of ${reward ? 50 : 0} points.</p>
        <p>Thank you for participating in this experiment!</p>
    `],
    key_forward: " "
  });

  // Run experiment
  jsPsych.run(timeline);
}

main();