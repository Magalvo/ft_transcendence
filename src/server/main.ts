// import { Game, GameConfiguration, GamePlayer } from "./index";

// // Thats like a lobby or something like that
// // you can change things in real time

// // Setup Game
// const configs = new GameConfiguration("normal", "one_for_one");
// const gameInstance = new Game(configs);

// // button for power ups
// configs.power_ups = true;

// // buttons for game duration
// // you can choose one of those
// configs.setGameDuration("fast");
// configs.setGameDuration("long");
// configs.setGameDuration("normal");

// // buttons for game type
// // you can choose one of those
// configs.setGameType("three_for_three");
// configs.setGameType("two_for_two");
// configs.setGameType("one_for_one");

// // add player example
// // it needs:
// // - is socket.id
// // - is team
// const player1 = new GamePlayer("human", "4f2323f42", "left");
// gameInstance.setNewPlayer(player1);

// // add bot example
// // it needs:
// // - is level 1 - 10
// // - is team
// const player2 = new GamePlayer("bot", 5, "right");
// gameInstance.setNewPlayer(player2);

// // you can also remove a player if someone leaves
// // gameInstance.removePlayer(id);

// // then finally start the game
// console.log("Starting game...");
// gameInstance.start();