// utility method
Number.prototype.clamp = function(min, max) {
  return Math.min(Math.max(this, min), max);
};

// represents the game environment
function Game() {
  this.board       = [];      // internal representation of board
  this.size        = 0;       // size of the board
  this.tiles       = '';      // string with the board tiles
  this.agent       = {};      // hash with agent information
  this.dirs        = 'nesw';  // available actions
  this.exploration = 0.5;     // exploration impetus

  // my rewards based on the board information
  // i.e. ## - Impassable wood
  //      @2 - Hero number 2
  //      [] - Tavern
  //      $- - Neutral gold mine
  //      $3 - Hero number 3's gold mine
  // the rewards object is created using rewards build and is called
  // at the beginning of the game round
  this.rewards = {};
};

/**
 * Builds up the rewards based on the agent id
 * - if we are agent 1, then we must set lower rewards
 *   for our own mines, and higher rewards for targeting
 *   opponents mines.
 *   Same approach for targeting enemies, we must make
 *   sure that we indicate the opponents accurately
 */
Game.prototype.rewardsBuild = function(displayRewards) {
  displayRewards = displayRewards || false;
  this.rewards['##'] = -1;
  this.rewards['[]'] =  1;
  this.rewards['  '] =  0;

  // Mines
  this.rewards['$-'] = 100;
  for(var i = 1; i <= 4; i++) {
    if(this.agent.id === i) {
      this.rewards['$' + i] = -1;
    } else {
      this.rewards['$' + i] = 100;
    }
  }
  // Enemies
  for(var i = 1; i <= 4; i++) {
    if(this.agent.id != i) {
      this.rewards['@' + i] = 50;
    }
  }

  if(displayRewards) {
    for(var r in this.rewards) {
      if(this.rewards.hasOwnProperty(r)) {
        console.log(r + ' : ' + this.rewards[r]);
      }
    }
  }
};

/**
 * Chooses a random action/direction
 */
Game.prototype.randomAction = function() {
  var i = Math.floor(Math.random() * 4);
  return this.dirs[i];
};

/**
 * Given a direction, what is my next Position going to be?
 */
Game.prototype.nextPos = function(dir) {
  var newDir = this.agent.pos;
  switch(dir) {
    case 'n':
      newDir.x--;

      //newDir.y--;
      break;
    case 's':
      newDir.x++;
      //newDir.y++;
      break;
    case 'e':
      newDir.y++;
      //newDir.x++;
      break;
    case 'w':
      newDir.y--;
      //newDir.x--;
      break;
  }

  // make sure the newPos isn't out of bounds
  newDir.x = newDir.x.clamp(0, (this.size - 1));
  newDir.y = newDir.y.clamp(0, (this.size - 1));

  return newDir;
};

/**
 * Returns the reward for moving to the new position
 */
Game.prototype.getReward = function(new_pos) {
  // get the item at new_pos
  var item = this.board[new_pos.x][new_pos.y];

  // return the reward for the item - all rewards are measured from
  // a current empty position because the agent is returned to
  // their original position unless they are entering another
  // empty position i.e. if the agent enters the tavern on the
  // current turn, they will be returned to the empty position
  // that they originally entered the tavern from.
  // this means that all states start from the '0' or empty state
  var reward = this.rewards[item];

  return reward;
};

/**
 * Returns what is North, East, West, and South of the agent
 * - Will use the agents current position, or a passed in position
 */
Game.prototype.agentSurroundings = function(pos) {
  // used to check if the query is in bounds of the board
  var limit = this.size - 1;

  var agent_pos = pos || this.agent.pos;

  var x = agent_pos.x, y = agent_pos.y;

  // return the items at the given locations, default to '##' if out of bounds
  return {
    n: (x <= 0)     ? '##' : this.board[x - 1][y],
    s: (x >= limit) ? '##' : this.board[x + 1][y],
    e: (y <= 0)     ? '##' : this.board[x][y + 1],
    w: (y >= limit) ? '##' : this.board[x][y - 1]
  };
};

/**
 * returns the surroundings as a string
 */
Game.prototype.agentState = function(pos) {
  var surroundings = this.agentSurroundings(pos);
  var state = 'S';
  for(var direction in surroundings) {
    if(surroundings.hasOwnProperty(direction)) {
      if(surroundings[direction] == '@1') {
        state += '  ';
      } else {
        state += surroundings[direction]
      }
    }
  }

  return state;
};

/**
 * Displays a summary of the agent information
 */
Game.prototype.agentDisplay = function() {
  process.stdout.write('Bot ID: ' + this.agent.id + '\n');
  process.stdout.write('Health: ' + this.agent.life + 'HP\nGold: ' + this.agent.gold + 'G\n');
  process.stdout.write('Position: [' + this.agent.pos.x + ',' + this.agent.pos.y + ']\n');
};

/**
 * Updates the agent information e.g. current position
 */
Game.prototype.agentUpdate = function(agent) {
  this.agent = agent;
};

/**
 * Simple representation of the board on the command line
 */
Game.prototype.boardDisplay = function() {
  process.stdout.write('\tThe Map (' + this.size + 'x' + this.size + ')\n');
  var lines = this.tiles.match( new RegExp('.{1,' + this.size * 2 + '}', 'g'));

  for(var i = 0; i < this.size; i++ ) {
    process.stdout.write('\t' + lines[i] + '\n');
  }
};

/**
 * Updates the internal board state
 */
Game.prototype.boardUpdate = function(board) {
  this.size  = board.size;
  this.tiles = board.tiles;

  var lines = this.tiles.match( new RegExp('.{1,' + this.size * 2 + '}', 'g'));

  // go through each line
  for(var i = 0; i < this.size; i++ ) {
    // parse each line for the elements
    this.board[i] = this.parseLine(lines[i]);
  }

  return this.board;
};

/**
 * Returns the individual parts of the line as map elements
 * i.e. a line of 5 objects like '##@1  ##@2##'
 * would be parse to ['##', '@1', '  ', '##', '@2', '##']
 */
Game.prototype.parseLine = function(line) {
  return line.match(new RegExp('.{1,2}', 'g'));
};

// stores state information
function State(name) {
  this.name = name;
  this.actions = {};
  this.actionsList = [];
};

State.prototype.addAction = function(next, reward, actionName) {
  var action = {
    name: actionName === undefined ? next : actionName,
    nextState: next,
    reward: reward
  };

  this.actionsList.push(action);
  this.actions[action.name] = action;
};

State.prototype.randomAction = function(){
  var i = Math.floor(Math.random() * this.actionsList.length);
  return this.actionsList[i];
};

// 'class' implementation of a Q-Learner
function QLearner(gamma) {
  this.gamma        = gamma || 0.8;
  this.rewards      = {};
  this.states       = {};
  this.statesList   = [];
  this.currentState = null;
}

// adds a new state, with a connection to the next state
QLearner.prototype.add = function(from, to, reward, actionName) {
  // add the states to the hash if they aren't already present
  if (!this.states[from]) this.addState(from);
  if (!this.states[to]) this.addState(to);

  // set the target 'to' state from the source 'from' state
  this.states[from].addAction(to, reward, actionName);
};

// adds a new state to the state list for the Learner
QLearner.prototype.addState = function(stateName) {
  var state = new State(stateName);

  this.states[stateName] = state;
  this.statesList.push(state);

  return state;
};

// sets the current state
QLearner.prototype.setState = function(stateName) {
  this.currentState = this.states[stateName];

  return this.currentState;
};

// returns the current state
QLearner.prototype.getState = function() {
  return this.currentState && this.currentState.name;
};

// returns a random state from the statesList
QLearner.prototype.randomState = function() {
  var i = Math.floor(Math.random() * this.statesList.length);
  return this.statesList[i];
};

// determines an optimal future value
QLearner.prototype.optimalFutureValue = function(state){
  // get the rewards for this state
  var stateRewards = this.rewards[state];
  var max = 0;

  // get the maximum reward
  for(var action in stateRewards) {
    if(stateRewards.hasOwnProperty(action)) {
      max = Math.max(max, stateRewards[action] || 0);
    }
  }

  return max;
};

// executes a 'step' for the simulation
QLearner.prototype.step = function() {
  // use the current state (or default to a random state if one isn't provided)
  this.currentState || (this.currentState = this.randomState());

  // select an action at random (from the actions available for that state)
  var action = this.currentState.randomAction();

  // if there's no action available, do nothing and finish.
  if(!action) return null;

  // get the rewards for the current state
  // - if there are no rewards, use an empty object/hash.
  this.rewards[this.currentState.name] || (this.rewards[this.currentState.name] = {});
  // choose an optimal next state
  this.rewards[this.currentState.name][action.name] = 
    (action.reward || 0) + this.gamma * this.optimalFutureValue(action.nextState);

  return this.currentState = this.states[action.nextState];
};

QLearner.prototype.learn = function(steps) {
  // default to 1 step if no steps are provided
  steps = Math.max(1, steps || 0);

  // for each step, choose a random state to start from
  // and make a step()
  while(steps--) {
    this.currentState = this.randomState();
    this.step();
  }
};

// determine the best action by comparing the rewards for each action.
QLearner.prototype.bestAction = function(state) {
  var stateRewards = this.rewards[state] || {};
  var bestAction = null;

  // iterate through the actions in the rewards
  for(var action in stateRewards) {
    if(stateRewards.hasOwnProperty[action]) {
      // if we have no best action yet, set it to the first action
      if(!bestAction) {
        bestAction = action;
      }
      // if the current action and the best action have the same reward,
      // choose between them randomly (50/50)
      else if((stateRewards[action] == stateRewards[bestAction]) && (Math.random() > 0.5)) {
        bestAction = action;
      }
      // otherwise, if the current action has a higher reward thant the best action,
      // set it as the new best action
      else if(stateRewards[action] > stateRewards[bestAction]) {
        bestAction = action;
      }
    }
  }

  return bestAction;
};

QLearner.prototype.knowsAction = function(state, action) {
  return (this.rewards[state] || {}).hasOwnProperty[state];
};

var game    = new Game();
var learner = new QLearner();

function randomBot(state, callback) {
  var i = Math.floor(Math.random() * 4);
  callback(null, this.dirs[i]);
}

function bot(state, callback) {
  // update map
  game.boardUpdate(state.game.board);
  //game.boardDisplay();

  game.agentUpdate(state.hero);

  // current state is the agents current surroundings
  var currentState = game.agentState();

  // get a random direction to fall back on
  var random = game.randomAction();

  // determine the best direction
  var action = learner.bestAction(currentState);

  // if we don't have a best action, fallback to the random direction
  if( action === null || action === undefined || (!learner.knowsAction(currentState, random) && Math.random() < game.exploration)) {
    action = random;
  } else {
    process.stdout.write('best action: ' + action + '\n');
  }

  // action is always one of 'n', 's', 'e', 'w'
  // based on the next action, get the coordinates of that location
  var nextPos = game.nextPos(action);

  // what is the reward for moving to the new position
  var reward = game.getReward(nextPos);

  // and determing the nextState
  var nextState = game.agentState(nextPos);

  // update the learner
  learner.add(currentState, nextState, reward, action);

  // do some learning
  learner.learn(50);

  // complete the step
  callback(null, action);
};

module.exports = bot;
if (require.main === module)
  var cli = require('vindinium-client').cli;

  cli(bot, function(ev, arg) {
    switch(ev) {
      case 'turn':
        // process.stdout.write('TURN  - ' + arg.game.turn + '/' + arg.game.maxTurns + '\n');
        process.stdout.write(".");
        break;

      case 'start':
        process.stdout.write('START - ' + arg.viewUrl + '\n');
        process.stdout.write('\t' + arg.game.maxTurns + ' turns\n');

        // must specify the hero
        game.agentUpdate(arg.hero);
        // need to build up R(s,a)
        game.rewardsBuild();
        break;

      default:
        cli.defaultLog(ev, arg);
    }
  });