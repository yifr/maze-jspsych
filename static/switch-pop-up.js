// Helper function to draw maze game board
function switchPopUpHelper(currentlyOnGame, display_element, containerEl, checkInInterval, updateNextCheckIn, getLog, getEnd) {
  const createEl = (tag, properties) => Object.assign(document.createElement(tag), properties);
  
  const checkInEl = createEl("div", {id: "check-in", className: "jspsych-pop-up"});
  checkInEl.innerHTML = `Would you like to keep ${currentlyOnGame ? "playing the game" : "solving the maze"} or switch to the ${currentlyOnGame ? "maze" : "game"}?
        <div style = "margin: 5px; display: flex; flex-direction: row;">
          <button id = "continue-button" class = "jspsych-button">Continue</button>
          <button id = "switch-button" class = "jspsych-button">Switch</button>
        </div>`;
  containerEl.appendChild(checkInEl);
  
  const continuePageEl = createEl("form", {id: "continue-page", className: "jspsych-pop-up"});
  continuePageEl.innerHTML = `
        <div style = "margin: 10px;">
          You selected "Continue". When do you actually want to switch? We'll remind you then. (Intervals of ${checkInInterval} sec.)<br>
          <div id = ask-again-options style = "display: flex; flex-direction: row; justify-content: center; align-items: center; gap: 15px;"></div>
        </div>
        <div style = "margin: 10px;">
          <label for = "continue-completion-prob">How likely do think you are to complete the ${currentlyOnGame ? "maze" : "game"} task if you start the next time we ask?<br></label>
          <output>50</output>%
          <input type = "range" id = "continue-completion-prob" name = "continue-completion-prob" required min = "0" max = "100"
            value = "50" oninput = "this.previousElementSibling.value = this.value; this.setCustomValidity('')">
        </div>
        <div>
          <button type = "submit" class = "jspsych-button">Submit</button>
        </div>
  `;
  containerEl.appendChild(continuePageEl);

  const optionsEl = display_element.querySelector("#ask-again-options");
  for (let i = 1; i <= 4; i++) {
    const val = i * checkInInterval;
    const div = createEl("div");
    const input = createEl("input", {type: "radio", id: `opt-${i}`, name: "ask-again", value: `${val}`, required: true});
    const label = createEl("label", {for: input.id, textContent: `${Math.floor(val / 60)}:${(val % 60).toString().padStart(2, "0")}`});
    div.appendChild(input);
    div.appendChild(label);
    optionsEl.appendChild(div);
  }

  const switchPageEl = createEl("form", {id: "switch-page", className: "jspsych-pop-up"});
  switchPageEl.innerHTML = `<div style = "margin: 10px;">
          You selected "Switch". You will now begin your attempt to ${currentlyOnGame ? "solve the maze" : "play the game"} in the time remaining.
        </div>
        <div style = "margin: 10px;">
          <label for = "switch-completion-prob">How likely do think you are to complete the ${currentlyOnGame ? "maze" : "game"} task?<br></label>
          <output>50</output>%
          <input type = "range" id = "switch-completion-prob" name = "switch-completion-prob" required min = "0" max = "100"
            value = "50" oninput = "this.previousElementSibling.value = this.value; this.setCustomValidity('')">
        </div>
        <div>
          <button type = "submit" class = "jspsych-button">Submit</button>
        </div>`;
  containerEl.appendChild(switchPageEl);

  // Control which pop-ups are visible
  const checkIn = () => {
    checkInEl.style.display = "flex";
    getLog()("check-in-appear");
  }
  const continueAction = () => {
    checkInEl.style.display = "none";
    continuePageEl.style.display = "flex";
    getLog()("check-in-choose-continue");
  }
  const switchAction = () => {
    checkInEl.style.display = "none";
    switchPageEl.style.display = "flex";
    getLog()("check-in-choose-switch");
  }
  // Handle form submissions
  ranges = [display_element.querySelector("#continue-completion-prob"), display_element.querySelector("#switch-completion-prob")]
  ranges.forEach((el) => (el).setCustomValidity("Please adjust the slider."));
  continuePageEl.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = new FormData(continuePageEl);
    getLog()("continue-submit", {
      askAgain: data.get("ask-again"),
      completionProb: data.get("continue-completion-prob")
    });
    continuePageEl.style.display = "none";
    updateNextCheckIn(data.get("ask-again"));
  });
  switchPageEl.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = new FormData(switchPageEl);
    getLog()("switch-submit", {
      completionProb: data.get("switch-completion-prob")
    });
    switchPageEl.style.display = "none";
    getEnd()("switch");
  });

  display_element.querySelector("#continue-button").addEventListener("click", continueAction);
  display_element.querySelector("#switch-button").addEventListener("click", switchAction);

  return checkIn;
};