async function fetchMazes() {
  const res = await fetch("/generate_mazes");
  return await res.json();
}

async function main() {
  const mazes = await fetchMazes();
  console.log(mazes.length);

  // Initialize jsPsych
  const jsPsych = initJsPsych({ on_finish: () => jsPsych.data.displayData() });
  jsPsych

  // Create timeline
  const timeline = [];

  let reward = 0;
  const updateReward = (r) => reward += r;

  // Make window fullscreen
  timeline.push({
    type: jsPsychFullscreen,
    fullscreen_mode: true
  });

  // Give instructions for maze
  const instructions = (page) => ({
    type: jsPsychInstructions,
    pages: [page],
    key_forward: " "
  });
  timeline.push(instructions(`
    <p>Welcome!</p>
    <p>In this experiment, you will be asked to complete <strong>mazes</strong> and to play a <strong>game</strong>.</p>
    <p>There are two rounds to the experiment. Each round will consist of a <strong>practice phase</strong> and a <strong>trial phase</strong>.</br>
    You will have an opportunity to earn a point reward in the trial phases, which will determine your monetary bonus.</p>
    <p>When you have read through all the instructions, please press the <strong>spacebar</strong> to move to the next screen</p>
`));

  const formatTime = (time, simplify = false) => {
    if (simplify) {
      return `${time >= 60 ? `${Math.floor(time / 60)} minute${Math.floor(time / 60) !== 1 ? "s" : ""}` : ""}${time % 60 !== 0 ? ` ${time % 60} seconds` : ""}`;
    } else {
      return `${time < 60 ? `${time} sec` : `${Math.floor(time / 60)} min ${time % 60} sec`}`;
    }
  }
  

  // Check whether a task was empirically fun
  const manipulationCheck = (activity, time_spent) => ({
    type: jsPsychSurveyLikert,
    preamble: `
      <p>You just finished ${activity} for ${formatTime(time_spent)}.</p>
    `,
    on_start: function(trial) {
      if (!time_spent) {
        const data = jsPsych.data.get().last(1).values()[0];
        const data_time_spent = data.time_remaining_or_spent;
        trial.preamble = `
          <p>You just finished ${activity} for ${formatTime(data_time_spent)}.</p>
        `;
      }
    },
    questions: [
      {
        prompt: "How much did you enjoy the task?",
        name: "ManipulationCheck", 
        labels: [
          "Strongly dislike",
          "Dislike",
          "Neutral", 
          "Like", 
          "Strongly like"
        ],
        required: true
      }
    ],
  });

  // Run familiarity phase to practice solving a maze and calibrate competence
  const mazePhase = (time_limit, difficulty, maze, switch_before, switch_after, on_success_message, updateReward = null) => ({
    timeline: [{
      type: MazePlayPlugin,
      time_limit: time_limit,
      difficulty: difficulty,
      maze: maze,
      on_start: function(trial) {
        if (switch_before) {
          const data = jsPsych.data.get().last(1).values()[0];
          trial.time_limit = data.time_remaining_or_spent;
        }
      },
      switch_after: switch_after,
      on_success_message: on_success_message,
      on_finish: function(data) {
        if (updateReward) updateReward(data.reward ? 10 : 0);
      }
    }],
    conditional_function: function(){
      // If switched to from another trial that already timed out, then skip
      return !(switch_before && jsPsych.data.get().last(1).values()[0].reason === "timeout");
    }
  });

  // Run familiarity phase to practice solving a maze and calibrate competence
  const gamePhase = (time_limit, difficulty, score_goal, switch_before, switch_after, maze, on_timeout_message, updateReward) => ({
    timeline: [{
      type: funGamePlayPlugin,
      time_limit: time_limit,
      difficulty: difficulty,
      score_goal: score_goal,
      on_start: function(trial) {
        if (switch_before) {
          const data = jsPsych.data.get().last(1).values()[0];
          trial.time_limit = data.time_remaining_or_spent;
        }
      },
      switch_after: switch_after,
      maze: maze,
      on_timeout_message: on_timeout_message,
      on_finish: function(data) {
        if (updateReward) updateReward(data.reward ? 10 : 0);
      }
    }],
    conditional_function: function(){
      // If switched to from another trial that already timed out, then skip
      return !(switch_before && jsPsych.data.get().last(1).values()[0].reason === "timeout");
    }
  });

  const generateInstructions = (round, part, procrastination, time_limit) => {
    let instructions = `<p><strong>Round ${round} ${part < 3 ? "practice" : "trial"} phase${part < 3 ? ` (part ${part})`: ""}</strong></p>`;
    if (part < 3) {
      const maze = procrastination !== (part == 2);
      instructions += `<p>For the ${part == 1 ? "first" : "second"} part of the Round ${round} practice phase, you will`;
      instructions += `${part == 1 ? "" : " attempt to"} ${maze ? "complete a <strong>maze" : "play a <strong>game"} of medium difficulty</strong>${procrastination || part == 2 ? "" : ", where your goal is to achieve a score of <strong>5 points</strong>"}.</br>`;
      if (part == 1) {
        instructions += `This ${maze ? "maze" : "game"} is <strong>not timed</strong>, but you should try to complete it as fast as possible.</p>`;
      } else {
        instructions += `You will have <strong>${formatTime(time_limit, true)}</strong> to practice the ${maze ? "maze" : "game"}.</p>`;
      }
      instructions += `<p>To ${maze ? "navigate the maze" : "control the game"}, use the ${maze ? "<strong>arrow</strong> or WASD keys" : "<strong>spacebar</strong>, up arrow key, W key, or left-click"}.</p>`;
      instructions += `<p>When you have read through all the instructions, please press the <strong>spacebar</strong> to start the practice ${maze ? "maze" : "game"}.</p>`;
    } else {
      instructions += `<p>For the trial phase of Round ${round}, you will have a total time of <strong>${formatTime(time_limit, true)}</strong>, during which you have two tasks you can do.</br>
        It is up to you how much time you choose to spend on each task.</pr>`;
      instructions += `<p>You will start out ${procrastination ? "playing a <strong>game" : "solving a <strong>maze"} of medium difficulty</strong>.</p>`;
      instructions += `<p>Starting 15 seconds in, we will ask you when you want to switch to the second task, which is a <strong>${procrastination ? "maze" : "game"} of hard difficulty</strong>${procrastination ? "" : ", where your goal is to achieve a score of <strong>5 points</strong>"}.</br>`;
      instructions += `You can choose to either continue with the first task (in which case you will decide when to get asked again), or switch to the second task.</p>`;
      instructions += `<p>Your reward for this trial will be based on whether or not you complete the <strong>second, ${procrastination ? "maze" : "game"} task</strong>.</br>
        If you ${procrastination ? "fully solve the maze" : "achieve a score of 5 points in the game"}, you will recieve a small monetary bonus.</p>`;
    }
    return instructions;
  };

  const procrastinationConditionRound = (round, familiarityTimeLimit, trialTimeLimit) => {
    // Maze practice (no time limit, goal is to complete maze)
    timeline.push(instructions(generateInstructions(round, 1, true, null)));
    timeline.push(mazePhase(null, 0, mazes[0], false, false, "Thank you for completing the practice maze!"));
    timeline.push(manipulationCheck("solving a maze"));

    // Game practice (time limit of familiarityTimeLimit)
    timeline.push(instructions(generateInstructions(round, 2, true, familiarityTimeLimit)));
    timeline.push(gamePhase(familiarityTimeLimit, 0, null, false, false, null, "Thank you for completing the practice game!"));
    timeline.push(manipulationCheck("playing the game", familiarityTimeLimit));

    // Start with game, switch to maze (total time limit of trialTimeLimit, goal is to complete maze)
    timeline.push(instructions(generateInstructions(round, 3, true, trialTimeLimit)));
    timeline.push(gamePhase(trialTimeLimit, 0, null, false, true, mazes[1]));
    timeline.push(mazePhase(trialTimeLimit, 1, mazes[3], true, false, updateReward));
  };

  const nonProcrastinationConditionRound = (round, familiarityTimeLimit, trialTimeLimit) => {
    // Game practice (no time limit, goal is to achieve a score)
    timeline.push(instructions(generateInstructions(round, 1, false, null)));
    timeline.push(gamePhase(null, 0, 5, false, false, null, "Thank you for completing the practice game!"));
    timeline.push(manipulationCheck("playing the game"));

    // Maze practice (time limit of familiarityTimeLimit)
    timeline.push(instructions(generateInstructions(round, 2, false, familiarityTimeLimit)));
    timeline.push(mazePhase(familiarityTimeLimit, 0, mazes[1], false, false, "Thank you for completing the practice maze!"));
    timeline.push(manipulationCheck("solving a maze", familiarityTimeLimit));

    // Start with game, switch to maze (total time limit of trialTimeLimit, goal is to achieve a score)
    timeline.push(instructions(generateInstructions(round, 3, false, trialTimeLimit)));
    timeline.push(mazePhase(trialTimeLimit, 0, mazes[2], false, true));
    timeline.push(gamePhase(trialTimeLimit, 1, 5, true, false, null, updateReward));
  };

  // Randomize condition order
  if (Math.random() < 0.5) {
    procrastinationConditionRound(1, 45, 120);
    nonProcrastinationConditionRound(2, 45, 120);
  } else {
    nonProcrastinationConditionRound(2, 45, 120);
    procrastinationConditionRound(1, 45, 120);
  }

  // Conclude experiment
  const conclusion = () => ({
    type: jsPsychInstructions,
    pages: [`
        <p>You have earned a reward of ${reward} points.</p>
        <p>Thank you for participating in this experiment!</p>
    `],
    key_forward: " "
  });
  timeline.push(conclusion);

  // Run experiment
  jsPsych.run(timeline);
}

main();