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
    <p>When you have read through all the instructions, please press the <strong>spacebar</strong> to move to the next screen.</p>
`));
  
  // Check whether a task was empirically fun
  const manipulationCheck = (activity, time_spent) => ({
    type: jsPsychSurveyHtmlForm,
    preamble: `<p>You just finished ${activity} for ${formatTime(time_spent, "other")}.</p>`,
    on_start: function(trial) {
      if (!time_spent) {
        const data = jsPsych.data.get().last(1).values()[0];
        const data_time_spent = data.time_remaining_or_spent;
        trial.preamble = `<p>You just finished ${activity} for ${formatTime(data_time_spent, "other")}.</p>`;
      }
    },
    html: generateManipulationCheckHtml("enjoyment", "How much did you enjoy the task?", "Strongly disliked", "Strongly liked") +
      generateManipulationCheckHtml("avoidance", "How willing would you be to do this task again in the future?", "Avoid at all costs", "Would love to") +
      generateManipulationCheckHtml("avoidance-higher", "How willing would you be to do this task again but at a higher difficulty in the future?", "Avoid at all costs", "Would love to") +
      generateManipulationCheckHtml("avoidance-lower", "How willing would you be to do this task again but at a lower difficulty in the future?", "Avoid at all costs", "Would love to"),
    on_load() {
      ranges = [document.querySelector("#enjoyment"), document.querySelector("#avoidance"), document.querySelector("#avoidance-higher"), document.querySelector("#avoidance-lower")]
      ranges.forEach((el) => (el).setCustomValidity("Please adjust the slider."));
    }
  });

  // Run familiarity phase to practice solving a maze and calibrate competence
  const mazePhase = (time_limit, difficulty, maze, switch_before, switch_after, on_success_message, on_timeout_message, update_reward = null) => ({
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
      on_timeout_message: on_timeout_message,
      on_finish: function(data) {
        if (update_reward) update_reward(data.reward ? 10 : 0);
      }
    }],
    conditional_function: function(){
      // If switched to from another trial that already timed out, then skip
      return !(switch_before && jsPsych.data.get().last(1).values()[0].reason === "timeout");
    }
  });

  // Run familiarity phase to practice solving a maze and calibrate competence
  const gamePhase = (time_limit, difficulty, score_goal, switch_before, switch_after, maze, on_success_message, on_timeout_message, update_reward = null) => ({
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
      on_success_message: on_success_message,
      on_timeout_message: on_timeout_message,
      on_finish: function(data) {
        if (update_reward) update_reward(data.reward ? 10 : 0);
      }
    }],
    conditional_function: function(){
      // If switched to from another trial that already timed out, then skip
      return !(switch_before && jsPsych.data.get().last(1).values()[0].reason === "timeout");
    }
  });

  // Initialize reward
  let reward = 0;
  const updateReward = (r) => reward += r;

  const procrastinationConditionRound = (round, familiarityTimeLimit, trialTimeLimit) => {
    // Maze practice (no time limit, goal is to complete maze)
    timeline.push(instructions(generateInstructions(round, 1, true, null)));
    timeline.push(mazePhase(
      null, 0, mazes[0],
      false, false,
      "Thank you for completing the practice maze!", undefined
    ));
    timeline.push(manipulationCheck("solving a maze"));

    // Game practice (time limit of familiarityTimeLimit)
    timeline.push(instructions(generateInstructions(round, 2, true, familiarityTimeLimit)));
    timeline.push(gamePhase(
      familiarityTimeLimit, 0, null,
      false, false, null,
      undefined, "Thank you for playing the practice game!"
    ));
    timeline.push(manipulationCheck("playing the game", familiarityTimeLimit));

    // Start with game, switch to maze (total time limit of trialTimeLimit, goal is to complete maze)
    timeline.push(instructions(generateInstructions(round, 3, true, trialTimeLimit)));
    timeline.push(gamePhase(
      trialTimeLimit, 0, null,
      false, true, mazes[3]
    ));
    timeline.push(mazePhase(
      trialTimeLimit, 1, mazes[3],
      true, false,
      undefined, undefined,
      updateReward
    ));
  };

  const nonProcrastinationConditionRound = (round, familiarityTimeLimit, trialTimeLimit) => {
    // Game practice (no time limit, goal is to achieve a score)
    timeline.push(instructions(generateInstructions(round, 1, false, null)));
    timeline.push(gamePhase(
      null, 0, 5,
      false, false, null,
      "Thank you for completing the practice game!", undefined
    ));
    timeline.push(manipulationCheck("playing the game"));

    // Maze practice (time limit of familiarityTimeLimit)
    timeline.push(instructions(generateInstructions(round, 2, false, familiarityTimeLimit)));
    timeline.push(mazePhase(
      familiarityTimeLimit, 0, mazes[1],
      false, false,
      "Thank you for completing the practice maze!", "Thank you for attempting the practice maze!"
    ));
    timeline.push(manipulationCheck("solving a maze", familiarityTimeLimit));

    // Start with game, switch to maze (total time limit of trialTimeLimit, goal is to achieve a score)
    timeline.push(instructions(generateInstructions(round, 3, false, trialTimeLimit)));
    timeline.push(mazePhase(
      trialTimeLimit, 0, mazes[2],
      false, true,
      "You finished the maze!", undefined
    ));
    timeline.push(gamePhase(
      trialTimeLimit, 1, 5,
      true, false, null,
      undefined, undefined,
      updateReward
    ));
  };

  // Randomize condition assignment
  if (Math.random() < 0.5) {
    procrastinationConditionRound(1, 45, 120);
  } else {
    nonProcrastinationConditionRound(1, 45, 120);
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