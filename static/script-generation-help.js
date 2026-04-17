// Helper function to format time
const formatTime = (time, type = "clock") => {
  if (type === "clock") {
    return `${Math.floor(time / 60)}:${(time % 60).toString().padStart(2, "0")}`;
  } else if (type === "sentence") {
    return `${time >= 60 ? `${Math.floor(time / 60)} minute${Math.floor(time / 60) !== 1 ? "s" : ""}` : ""}${time % 60 !== 0 ? ` ${time % 60} seconds` : ""}`;
  } else {
    return `${time < 60 ? `${time} sec` : `${Math.floor(time / 60)} min ${time % 60} sec`}`;
  }
}

// Helper function to generate inner html for manipulation check questions
function generateManipulationCheckHtml(id, question, leftLabel, rightLabel) {
  return `<div style = "margin-top: 30px;">
    <label for = "${id}">${question} (<output id = "out-${id}" style = "font-weight: bold;">50</output>/100)<br></label>
    <div style = "margin: 10px;">
      <input type = "range" id = "${id}" name = "${id}" style = "width: 500px" required min = "0" max = "100"
        value = "50" oninput = "document.getElementById('out-${id}').value = this.value; this.setCustomValidity('')">
      <div class = "jspsych-range-labels">
        <span>${leftLabel}</span>
        <span>Neutral</span>
        <span>${rightLabel}</span>
      </div>
    </div>
  </div>`;
};

// Helper function to generate instructions for a task
const generateInstructions = (round, part, procrastination, time_limit) => {
  return generateInstructionsOneRound(part, procrastination, time_limit)
}

// Version for two rounds (so participants do both conditions)
const generateInstructionsTwoRounds = (round, part, procrastination, time_limit) => {
    let instructions = `<p><strong>Round ${round} ${part < 3 ? "practice" : "trial"} phase${part < 3 ? ` (part ${part})`: ""}</strong></p>`;
    if (part < 3) {
      // Practice phase
      const maze = procrastination !== (part == 2);
      instructions += `<p>For the ${part == 1 ? "first" : "second"} part of the Round ${round} practice phase, you will`;
      instructions += `${part == 1 ? "" : " attempt to"} ${maze ? "complete a <strong>maze" : "play a <strong>game"} of medium difficulty</strong>${procrastination || part == 2 ? "" : ", where your goal is to achieve a score of <strong>5 points</strong>"}.</br>`;
      if (part == 1) {
        instructions += `This ${maze ? "maze" : "game"} is <strong>not timed</strong>, but you should try to complete it as fast as possible.</p>`;
      } else {
        instructions += `You will have <strong>${formatTime(time_limit, "sentence")}</strong> to practice the ${maze ? "maze" : "game"}.</p>`;
      }
      instructions += `<p>To ${maze ? "navigate the maze" : "control the game"}, use the ${maze ? "<strong>arrow</strong> or WASD keys" : "<strong>spacebar</strong>, up arrow key, W key, or left-click"}.</p>`;
      instructions += `<p>When you have read through all the instructions, please press the <strong>spacebar</strong> to start the practice ${maze ? "maze" : "game"}.</p>`;
    } else {
      // Trial phase
      instructions += `<p>For the trial phase of Round ${round}, you will have a total time of <strong>${formatTime(time_limit, "sentence")}</strong>, during which you have two tasks you can do.</br>
        It is up to you how much time you choose to spend on each task.</pr>`;
      instructions += `<p>You will start out ${procrastination ? "playing a <strong>game" : "solving a <strong>maze"} of medium difficulty</strong>.</p>`;
      instructions += `<p>Starting 15 seconds in, we will ask you when you want to switch to the second task, which is a <strong>${procrastination ? "maze" : "game"} of hard difficulty</strong>${procrastination ? "" : ", where your goal is to achieve a score of <strong>5 points</strong>"}.</br>`;
      instructions += `You can choose to either continue with the first task (in which case you will decide when to get asked again), or switch to the second task.</p>`;
      instructions += `<p>Your reward for this trial will be based on whether or not you complete the <strong>second, ${procrastination ? "maze" : "game"} task</strong>.</br>
        If you ${procrastination ? "fully solve the maze" : "achieve a score of 5 points in the game"}, you will recieve a small monetary bonus.</p>`;
    }
    return instructions;
  };

// Version for one round (so participants only do one condition)
const generateInstructionsOneRound = (part, procrastination, time_limit) => {
    let instructions = `<p><strong>${part < 3 ? "Practice" : "Trial"} Phase${part < 3 ? ` (Part ${part})`: ""}</strong></p>`;
    if (part < 3) {
      // Practice phase
      const maze = procrastination !== (part == 2);
      instructions += `<p>For the ${part == 1 ? "first" : "second"} part of the practice phase, you will`;
      instructions += `${part == 1 ? "" : " attempt to"} ${maze ? "complete a <strong>maze" : "play a <strong>game"} of medium difficulty</strong>${procrastination || part == 2 ? "" : ", where your goal is to achieve a score of <strong>5 points</strong>"}.</br>`;
      if (part == 1) {
        instructions += `This ${maze ? "maze" : "game"} is <strong>not timed</strong>, but you should try to complete it as fast as possible.</p>`;
      } else {
        instructions += `You will have <strong>${formatTime(time_limit, "sentence")}</strong> to practice the ${maze ? "maze" : "game"}.</p>`;
      }
      instructions += `<p>To ${maze ? "navigate the maze" : "control the game"}, use the ${maze ? "<strong>arrow</strong> or WASD keys" : "<strong>spacebar</strong>, up arrow key, W key, or left-click"}.</p>`;
      instructions += `<p>When you have read through all the instructions, please press the <strong>spacebar</strong> to start the practice ${maze ? "maze" : "game"}.</p>`;
    } else {
      // Trial phase
      instructions += `<p>For the trial phase, you will have a total time of <strong>${formatTime(time_limit, "sentence")}</strong>, during which you have two tasks you can do.</br>
        It is up to you how much time you choose to spend on each task.</pr>`;
      instructions += `<p>You will start out ${procrastination ? "playing a <strong>game" : "solving a <strong>maze"} of medium difficulty</strong>.</p>`;
      instructions += `<p>Starting 15 seconds in, we will ask you when you want to switch to the second task, which is a <strong>${procrastination ? "maze" : "game"} of hard difficulty</strong>${procrastination ? "" : ", where your goal is to achieve a score of <strong>5 points</strong>"}.</br>`;
      instructions += `You can choose to either continue with the first task (in which case you will decide when to get asked again), or switch to the second task.</p>`;
      instructions += `<p>Your reward for this trial will be based on whether or not you complete the <strong>second, ${procrastination ? "maze" : "game"} task</strong>.</br>
        If you ${procrastination ? "fully solve the maze" : "achieve a score of 5 points in the game"}, you will recieve a small monetary bonus.</p>`;
    }
    return instructions;
  };