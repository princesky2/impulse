/*************************************
 * Pokemon Safari Zone Renderer      *
 * Author: @musaddiktemkar           *
 * Updated by: @smoothoperator07     *
 * Last Updated: 2025-04-15          *
 **************************************/

import { Player, GameStatus, SAFARI_CONSTANTS } from './safari-types';

/**
 * Handles all rendering and UI functionality for the Safari Zone game
 */
export class SafariRenderer {
    private game: any; // Reference to the SafariGame instance

    constructor(game: any) {
        this.game = game;
    }

    /**
     * Formats timestamp to UTC time string
     * @param timestamp Timestamp to format
     * @returns Formatted time string
     */
    formatUTCTime(timestamp: number): string {
        return new Date(timestamp)
            .toISOString()
            .replace('T', ' ')
            .substr(0, 19);
    }

    /**
     * Gets a formatted player list
     * @returns String of player names
     */
    getPlayerList(): string {
        const players = Object.values(this.game.players);
        if (players.length === 0) return 'None';
        return players.map((p: Player) => Impulse.nameColor(p.name, true, true)).join(', ');
    }

    /**
     * Main method to display the game UI
     */
    display() {
        const status = this.game.getStatus();
        
        if (status === 'waiting') {
            this.displayWaitingScreen();
            return;
        }

        this.game.room.add(`|uhtmlchange|safari-waiting|`, -1000);

        const currentPlayerId = this.game.turnOrder[this.game.currentTurn];

        if (status === 'started') {
            this.displayActiveGameForPlayers(currentPlayerId);
        } else if (status === 'ended') {
            this.clearAllPlayerDisplays();
        }

        this.updateSpectatorsView(status);
    }
	
	private displayWaitingScreen() {
  const now = this.formatUTCTime(Date.now());
  const players = this.getPlayerList();
  const balls = this.game.getBallsPerPlayer();
  const pool = this.game.getPrizePool();

  const html =
    '<div class="safari-zone-box">' +
      '<h1 class="safari-title">SAFARI ZONE</h1>' +
      '<div class="safari-subtitle">A wild Pokémon adventure awaits!</div>' +

      '<div class="safari-info-grid">' +
        '<div><b>Guide:</b> ' + Impulse.nameColor(this.game.getHost(), true, true) + '</div>' +
        '<div><b>Time:</b> ' + now + ' UTC</div>' +
        '<div><b>Balls:</b> ' + balls + ' each</div>' +
        '<div><b>Prize:</b> ' + pool + ' coins</div>' +
      '</div>' +

      '<div class="safari-info-grid">' +
        '<div><b>Explorers:</b> ' + players + '</div>' +
        '<div><b>Min/Max:</b> ' +
          SAFARI_CONSTANTS.MIN_PLAYERS + ' / ' + SAFARI_CONSTANTS.MAX_PLAYERS +
        '</div>' +
      '</div>' +

      '<div class="safari-pokemon-showcase">' +
        '<img src="https://play.pokemonshowdown.com/sprites/ani/scyther.gif" alt="Scyther" />' +
        '<img src="https://play.pokemonshowdown.com/sprites/ani/tauros.gif" alt="Tauros" />' +
        '<img src="https://play.pokemonshowdown.com/sprites/ani/kangaskhan.gif" alt="Kangaskhan" />' +
      '</div>' +

      '<button class="safari-button" name="send" value="/safari join">' +
        'Join Safari Zone!' +
      '</button>' +

      '<div class="safari-tips">' +
        '<div>SAFARI TIPS:</div>' +
        '<div>• Move carefully to find rare Pokémon!</div>' +
        '<div>• Stronger Pokémon yield more points</div>' +
        '<div>• Each Safari Ball is precious—use wisely</div>' +
      '</div>' +
    '</div>';

  this.game.room.add('|uhtml|safari-waiting|' + html).update();
	}
	/** 
 * Shows the live Safari Zone view with current Pokémon, move buttons, 
 * and a player‐stats table.
 */
private displayActiveGameForPlayers() {
  const currentPokemon = this.game.getCurrentPokemon();             // e.g. "Scyther"
  const moveOptions = this.game.getMoveOptions();                   // e.g. ["north","south","east","west"]
  const playerStatsTable = this.renderPlayerStatsTable();           // builds an HTML <table> via concat

  let html =
    '<div class="safari-zone-box">' +
      
      // Header
      '<h1 class="safari-title">SAFARI ZONE – IN PROGRESS</h1>' +
      '<div class="safari-subtitle">Catch or move carefully!</div>' +

      // Current Pokémon Showcase
      '<div class="safari-pokemon-showcase">' +
        '<img src="' + currentPokemon.image + '" alt="' + currentPokemon.name + '" />' +
        '<div><b>' + currentPokemon.name + '</b></div>' +
      '</div>' +

      // Move Buttons
      '<div class="safari-info-grid">' +
        moveOptions.map(dir =>
          '<button class="safari-button" name="send" value="/safari move ' + dir + '">' +
            'Go ' + dir.charAt(0).toUpperCase() + dir.slice(1) +
          '</button>'
        ).join('') +
      '</div>' +

      // Player Stats Table
      playerStatsTable +

    '</div>';

  this.game.room.add('|uhtml|safari-active|' + html).update();
}


/** 
 * Helper: builds the <table> of explorers’ stats via string concatenation 
 */
private renderPlayerStatsTable(): string {
  const stats = this.game.getPlayerStats(); // [{ name, caughtCount, ballsLeft }, …]

  let table =
    '<table class="safari-player-table">' +
      '<tr>' +
        '<th>Explorer</th>' +
        '<th>Caught</th>' +
        '<th>Balls</th>' +
      '</tr>';

  for (const s of stats) {
    table +=
      '<tr>' +
        '<td>' + Impulse.nameColor(s.name, true, true) + '</td>' +
        '<td>' + s.caughtCount + '</td>' +
        '<td>' + s.ballsLeft + '</td>' +
      '</tr>';
  }

  table += '</table>';
  return table;
}


/** 
 * Shows the final results: who won, what they caught, and prizes awarded 
 */
private displayResultsScreen() {
  const winners = this.game.getWinners();       // ["Alice", "Bob"]
  const prizes = this.game.getPrizes();         // { Alice: 500, Bob: 300, … }
  const catchList = this.game.getAllCatches();  // { Alice: ["Scyther","Tauros"], … }

  // Build winners line
  const winnersLine = 
    '<div><b>Winners:</b> ' +
      winners.map(p => Impulse.nameColor(p, true, true)).join(', ') +
    '</div>';

  // Build catch‐per‐player list
  let catchesHtml = '';
  for (const player of Object.keys(catchList)) {
    catchesHtml +=
      '<div><b>' + Impulse.nameColor(player, true, true) + ':</b> ' +
        catchList[player].join(', ') +
      '</div>';
  }

  // Build prize table
  let prizeTable =
    '<table class="safari-player-table">' +
      '<tr><th>Explorer</th><th>Coins Won</th></tr>';
  for (const player of Object.keys(prizes)) {
    prizeTable +=
      '<tr>' +
        '<td>' + Impulse.nameColor(player, true, true) + '</td>' +
        '<td>' + prizes[player] + '</td>' +
      '</tr>';
  }
  prizeTable += '</table>';

  const html =
    '<div class="safari-zone-box">' +
      '<h1 class="safari-title">SAFARI ZONE – RESULTS</h1>' +
      '<div class="safari-subtitle">Adventure concluded!</div>' +

      '<div class="safari-info-grid">' +
        winnersLine +
        '<div><b>Total Rounds:</b> ' + this.game.getRoundCount() + '</div>' +
      '</div>' +

      '<div class="safari-results-box">' +
        '<h2 class="safari-results-title">Catches</h2>' +
        catchesHtml +
      '</div>' +

      '<div class="safari-results-box">' +
        '<h2 class="safari-results-title">Prizes</h2>' +
        prizeTable +
      '</div>' +
    '</div>';

  this.game.room.add('|uhtml|safari-results|' + html).update();
}

    private renderPlayerControls(userid: string, player: Player, timeLeft: number): string {
        let buf = `<div class="safari-controls">`;
        
        if (player.ballsLeft > 0) {
            const state = this.game.getMovementState(userid);
            
            if (!state || state.canMove) {
                buf += `<div class="movement-controls">` +
                       `<button name="send" value="/safari move up">↑</button><br />` +
                       `<button name="send" value="/safari move left">←</button>` +
                       `<button name="send" value="/safari move right">→</button><br />` +
                       `<button name="send" value="/safari move down">↓</button>` +
                       `</div>` +
                       `<div class="movement-prompt"><b>Choose a direction to move!</b></div>`;
            } else if (state.pokemonDisplayed && state.currentPokemon) {
                buf += `<div class="pokemon-encounter">` +
                       `<img src="${state.currentPokemon.sprite}" width="80" height="80">` +
                       `<div class="encounter-text"><b>A wild ${state.currentPokemon.name} appeared!</b></div>` +
                       `<button class="throw-ball" name="send" value="/safari throw">Throw Safari Ball</button>` +
                       `</div>`;
            }

            if (timeLeft <= 10) {
                buf += `<div class="warning-text">Warning: You'll lose a ball if you don't act!</div>`;
            }
        } else {
            buf += `<div class="no-balls-message">You have no Safari Balls left!</div>`;
        }
        
        buf += `</div>`;
        return buf;
    }

    private clearAllPlayerDisplays() {
        for (const userid in this.game.players) {
            const roomUser = Users.get(userid);
            if (roomUser?.connected) {
                roomUser.sendTo(this.game.room, `|uhtmlchange|safari-player-${userid}|`);
            }
        }
    }

    private updateSpectatorsView(status: GameStatus) {
        for (const spectatorId of this.game.getSpectators()) {
            if (status === 'ended') {
                const roomUser = Users.get(spectatorId);
                if (roomUser?.connected) {
                    roomUser.sendTo(this.game.room, `|uhtmlchange|safari-spectator-${spectatorId}|`);
                }
            } else {
                this.displayToSpectator(spectatorId);
            }
        }
    }

    displayToSpectator(userid: string): void {
        if (!this.game.getSpectators().has(userid)) return;
        
        const now = Date.now();
        const currentPlayerId = this.game.turnOrder[this.game.currentTurn];
        const timeLeft = Math.max(0, Math.ceil((SAFARI_CONSTANTS.TURN_TIME - (now - this.game.turnStartTime)) / 1000));
        
        let buf = `<div class="safari-spectator-box">` +
                 `<div class="safari-content">` +
                 `<h2 class="safari-game-title">Safari Zone Game${this.game.getStatus() === 'ended' ? ' (Ended)' : ''}</h2>`;
        
        buf += `<div class="safari-game-info">` +
               `<small>Game Time: ${this.formatUTCTime(now)} UTC</small><br />` +
               `<small>Game Duration: ${Math.floor((now - this.game.getGameStartTime()) / 1000)}s</small>` +
               `</div>`;
        
        buf += `<div class="safari-game-stats">` +
               `<b>Host:</b> ${Impulse.nameColor(this.game.getHost(), true, true)}<br />` +
               `<b>Status:</b> ${this.game.getStatus()}<br />` +
               `<b>Prize Pool:</b> ${this.game.getPrizePool()} coins<br />` +
               `</div>`;

        if (this.game.getStatus() === 'started' && currentPlayerId) {
            buf += `<div class="safari-turn-info">` +
                   `<b>Current Turn:</b> ${Impulse.nameColor(this.game.players[currentPlayerId].name, true, true)}` +
                   ` <b class="safari-timer ${timeLeft <= 10 ? 'warning' : ''}">(${timeLeft}s left)</b>` +
                   `</div>`;
        }

        if (Object.keys(this.game.players).length) {
            buf += this.renderPlayerTable(currentPlayerId, userid);
        }

        if (this.game.getStatus() === 'started' && this.game.getLastCatchMessage()) {
            buf += `<div class="safari-catch-message ${this.game.getLastWasCatch() ? 'success' : 'failure'}">` +
                   `${this.game.getLastCatchMessage()}` +
                   `</div>`;
        }

        buf += `<div class="spectator-notice">You are spectating this game</div>` +
               `</div></div>`;

        const roomUser = Users.get(userid);
        if (roomUser?.connected) {
            roomUser.sendTo(this.game.room, `|uhtml|safari-spectator-${userid}|${buf}`);
        }
    }
}
