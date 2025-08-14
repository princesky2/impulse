/***************************************
* Pokemon Showdown EXP Commands        *
* Original Code By: Volco & Insist     *
* Updated To Typescript By: Prince Sky *
***************************************/

/*********************************************
* Add this code in server/chat.ts            *
* In parse function//Output the message      *
* if (this.user.registered)                  *
* Impulse.ExpSystem.addExp(this.user.id, 1); *
*********************************************/

import { FS } from '../lib/fs';

// Constants
const EXP_FILE_PATH = 'impulse-db/exp.json';
const EXP_CONFIG_PATH = 'impulse-db/exp-config.json';
const DEFAULT_EXP = 0;
const EXP_UNIT = `EXP`;
const MIN_LEVEL_EXP = 15;
const MULTIPLIER = 1.4;
const EXP_COOLDOWN = 30000;
const DOUBLE_EXP_MULTIPLIER = 2;
const MILESTONE_LEVEL_INTERVAL = 5;
const ANNOUNCEMENT_LEVEL_INTERVAL = 10;
const BONUS_EXP_MULTIPLIER = 5;
const INACTIVE_USER_THRESHOLD = 300000; // 5 minutes

// Global variables
let DOUBLE_EXP = false;
let DOUBLE_EXP_END_TIME: number | null = null;

// Set EXP unit globally
Impulse.expUnit = EXP_UNIT;

// Helper functions
const formatTime = (date: Date): string => {
  return date.toISOString().replace('T', ' ').slice(0, 19);
};

const getDurationMs = (value: number, unit: string): number => {
  const units: Record<string, number> = {
    minute: 60 * 1000,
    hour: 60 * 60 * 1000,
    day: 24 * 60 * 60 * 1000
  };
  return value * (units[unit] || 0);
};

const toSafeID = (input: string): string => toID(input);

// Interfaces
interface ExpData {
  [userid: string]: number;
}

interface CooldownData {
  [userid: string]: number;
}

interface ExpConfig {
  doubleExp: boolean;
  doubleExpEndTime: number | null;
}

interface LevelInfo {
  level: number;
  currentExp: number;
  expForNext: number;
  expForCurrent: number;
  progressInLevel: number;
  progressPercentage: number;
  expNeeded: number;
}

export class ExpSystem {
  private static data: ExpData = ExpSystem.loadExpData();
  private static cooldowns: CooldownData = {};
  private static config: ExpConfig = ExpSystem.loadExpConfig();

  // Data loading and saving
  private static loadExpData(): ExpData {
    try {
      const rawData = FS(EXP_FILE_PATH).readIfExistsSync();
      return rawData ? (JSON.parse(rawData) as ExpData) : {};
    } catch (error) {
      console.error(`Error reading EXP data: ${error}`);
      return {};
    }
  }

  private static saveExpData(): void {
    try {
      const dataToWrite = Object.fromEntries(
        Object.entries(this.data).map(([id, amount]) => [toSafeID(id), amount])
      );
      FS(EXP_FILE_PATH).writeUpdate(() => JSON.stringify(dataToWrite, null, 2));
    } catch (error) {
      console.error(`Error saving EXP data: ${error}`);
    }
  }

  private static loadExpConfig(): ExpConfig {
    try {
      const rawData = FS(EXP_CONFIG_PATH).readIfExistsSync();
      if (rawData) {
        const config = JSON.parse(rawData) as ExpConfig;
        // Restore double exp settings if they exist
        DOUBLE_EXP = config.doubleExp;
        DOUBLE_EXP_END_TIME = config.doubleExpEndTime;
        return config;
      }
      return { doubleExp: false, doubleExpEndTime: null };
    } catch (error) {
      console.error(`Error reading EXP config: ${error}`);
      return { doubleExp: false, doubleExpEndTime: null };
    }
  }

  private static saveExpConfig(): void {
    try {
      const config: ExpConfig = {
        doubleExp: DOUBLE_EXP,
        doubleExpEndTime: DOUBLE_EXP_END_TIME
      };
      FS(EXP_CONFIG_PATH).writeUpdate(() => JSON.stringify(config, null, 2));
    } catch (error) {
      console.error(`Error saving EXP config: ${error}`);
    }
  }

  // Cooldown check
  private static isOnCooldown(userid: string): boolean {
    const lastExp = this.cooldowns[userid] || 0;
    return Date.now() - lastExp < EXP_COOLDOWN;
  }

  private static calculateGainedAmount(baseAmount: number): number {
    return DOUBLE_EXP ? baseAmount * DOUBLE_EXP_MULTIPLIER : baseAmount;
  }

  private static updateCooldown(userid: string): void {
    this.cooldowns[userid] = Date.now();
  }

  private static processLevelUp(userid: string, currentExp: number, newExp: number): void {
    const currentLevel = this.getLevel(currentExp);
    const newLevel = this.getLevel(newExp);
    
    if (newLevel > currentLevel) {
      this.notifyLevelUp(userid, newLevel, currentLevel);
    }
  }

  // Core EXP methods
  static writeExp(userid: string, amount: number): void {
    this.data[toSafeID(userid)] = amount;
    this.saveExpData();
  }

  static readExp(userid: string): number {
    return this.data[toSafeID(userid)] || DEFAULT_EXP;
  }

  static hasExp(userid: string, amount: number): boolean {
    return this.readExp(userid) >= amount;
  }

  static addExp(userid: string, amount: number, reason?: string, by?: string): number {
    const id = toSafeID(userid);
    
    if (!by && this.isOnCooldown(id)) {
      return this.readExp(id);
    }

    const currentExp = this.readExp(id);
    const gainedAmount = this.calculateGainedAmount(amount);
    
    this.data[id] = (this.data[id] || 0) + gainedAmount;
    
    if (!by) {
      this.updateCooldown(id);
    }
    
    this.saveExpData();
    this.processLevelUp(id, currentExp, this.data[id]);
    
    return this.data[id];
  }

  static addExpRewards(userid: string, amount: number, reason?: string, by?: string): number {
    const id = toSafeID(userid);
    const currentExp = this.readExp(id);
    const gainedAmount = this.calculateGainedAmount(amount);
    
    this.data[id] = (this.data[id] || 0) + gainedAmount;
    this.saveExpData();
    this.processLevelUp(id, currentExp, this.data[id]);
    
    return this.data[id];
  }

  static takeExp(userid: string, amount: number, reason?: string, by?: string): number {
    const id = toSafeID(userid);
    const currentExp = this.data[id] || 0;
    
    if (currentExp >= amount) {
      this.data[id] = currentExp - amount;
      this.saveExpData();
      return this.data[id];
    }
    return currentExp;
  }

  static resetAllExp(): void {
    this.data = {};
    this.saveExpData();
  }

  private static createLevelUpPopupHTML(userid: string, newLevel: number, oldLevel: number, rewards?: string): string {
    return (
      `|html|<div style="text-align: center;">` +
      `<h3 style="color: #3498db;">Level Up!</h3>` +
      `<div style="font-size: 1.2em; margin: 10px 0;">` +
      `You are now <b style="color: #e74c3c;">Level ${newLevel}</b>!` +
      `</div>` +
      `<div style="margin: 10px 0; font-style: italic;">` +
      `You advanced from Level ${oldLevel} to Level ${newLevel}` +
      `</div>` +
      (rewards ? `<div style="margin-top: 10px; color: #27ae60;">${rewards}</div>` : '') +
      `<div style="margin-top: 15px; font-size: 0.9em; opacity: 0.8;">` +
      `Keep chatting and participating to earn more ${EXP_UNIT}!` +
      `</div>` +
      `</div>`
    );
  }

  private static createAnnouncementHTML(userid: string, level: number): string {
    return (
      `|html|<div class="broadcast-blue">` +
      `<b>${Impulse.nameColor(userid, true, true)}</b> has reached <b>Level ${level}</b>!` +
      `</div>`
    );
  }

  // Level-up notification
  static notifyLevelUp(userid: string, newLevel: number, oldLevel: number): void {
    const user = Users.get(userid);
    if (!user || !user.connected) return;
    
    let rewards = '';
    
    // For milestone levels, give special rewards
    if (newLevel % MILESTONE_LEVEL_INTERVAL === 0) {
      const bonusExp = newLevel * BONUS_EXP_MULTIPLIER;
      this.addExpRewards(userid, bonusExp, 'Level milestone bonus');
      rewards = `You received a bonus of ${bonusExp} ${EXP_UNIT} for reaching a milestone level!`;
    }
    
    // Send popup notification to user
    const popupHTML = this.createLevelUpPopupHTML(userid, newLevel, oldLevel, rewards);
    user.popup(popupHTML);
    
    // For significant levels, announce in the lobby
    if (newLevel % ANNOUNCEMENT_LEVEL_INTERVAL === 0) {
      const mainRoom = Rooms.get('lobby');
      if (mainRoom) {
        const announcementHTML = this.createAnnouncementHTML(userid, newLevel);
        mainRoom.add(announcementHTML).update();
      }
    }
  }

  private static createDoubleExpMessage(isEnabled: boolean, user?: User): string {
    if (isEnabled) {
      const durationText = DOUBLE_EXP_END_TIME 
        ? `until ${formatTime(new Date(DOUBLE_EXP_END_TIME))} UTC`
        : 'No duration specified';
          
      return (
        `<div class="broadcast-blue">` +
        `<b>Double EXP has been enabled${user ? ` by ${Impulse.nameColor(user.name, true, true)}` : ''}!</b><br>` +
        `Duration: ${durationText}<br>` +
        `All EXP gains will now be doubled.` +
        `</div>`
      );
    } else {
      return (
        `<div class="broadcast-blue">` +
        `<b>Double EXP has been ${DOUBLE_EXP_END_TIME ? 'ended' : 'disabled'}${user ? ` by ${Impulse.nameColor(user.name, true, true)}` : ''}!</b><br>` +
        `All EXP gains will now be normal.` +
        `</div>`
      );
    }
  }

  // Double EXP management
  static checkDoubleExpStatus(room?: Room | null, user?: User): void {
    if (DOUBLE_EXP && DOUBLE_EXP_END_TIME && Date.now() >= DOUBLE_EXP_END_TIME) {
      DOUBLE_EXP = false;
      DOUBLE_EXP_END_TIME = null;
      this.saveExpConfig();
    }
    
    if (!room) return;
    
    const message = this.createDoubleExpMessage(DOUBLE_EXP, user);
    room.add(`|html|${message}`).update();
    
    if (user) {
      const status = DOUBLE_EXP ? 'enabled' : 'disabled';
      const duration = DOUBLE_EXP_END_TIME 
        ? `until ${formatTime(new Date(DOUBLE_EXP_END_TIME))} UTC`
        : 'No duration specified';
      // Uncomment if modlog is needed: this.modlog('TOGGLEDOUBLEEXP', null, `${status} - ${duration}`, { by: user.id });
    }
  }

  // Auto EXP granting
  static grantExp(): void {
    Users.users.forEach(user => {
      if (!user?.named || !user.connected || !user.lastPublicMessage) return;
      if (Date.now() - user.lastPublicMessage > INACTIVE_USER_THRESHOLD) return;
      this.addExp(user.id, 1);
    });
  }

  // Utility methods
  static getRichestUsers(limit: number = 100): [string, number][] {
    return Object.entries(this.data)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit);
  }

  static getLevel(exp: number): number {
    if (exp < MIN_LEVEL_EXP) return 0;
    
    let level = 1;
    let totalExp = MIN_LEVEL_EXP;
    
    while (exp >= totalExp) {
      totalExp += Math.floor(MIN_LEVEL_EXP * Math.pow(MULTIPLIER, level));
      level++;
    }
    return level - 1;
  }

  static getExpForNextLevel(level: number): number {
    if (level <= 0) return MIN_LEVEL_EXP;
    
    let totalExp = MIN_LEVEL_EXP;
    for (let i = 1; i < level; i++) {
      totalExp += Math.floor(MIN_LEVEL_EXP * Math.pow(MULTIPLIER, i));
    }
    return totalExp;
  }

  static getLevelInfo(userid: string): LevelInfo {
    const currentExp = this.readExp(userid);
    const currentLevel = this.getLevel(currentExp);
    const nextLevelExp = this.getExpForNextLevel(currentLevel + 1);
    const previousLevelExp = this.getExpForNextLevel(currentLevel);
    
    const expInCurrentLevel = currentExp - previousLevelExp;
    const expNeededForNextLevel = nextLevelExp - previousLevelExp;
    const progressPercentage = Math.floor((expInCurrentLevel / expNeededForNextLevel) * 100);
    const expNeeded = nextLevelExp - currentExp;

    return {
      level: currentLevel,
      currentExp,
      expForNext: nextLevelExp,
      expForCurrent: previousLevelExp,
      progressInLevel: expInCurrentLevel,
      progressPercentage,
      expNeeded
    };
  }
}

// Attach to global Impulse object
Impulse.ExpSystem = ExpSystem;

// Pages component
export const pages: Chat.PageTable = {
  expladder(args, user) {
    const richest = ExpSystem.getRichestUsers(100);
    if (!richest.length) {
      return `<div class="pad"><h2>No users have any ${EXP_UNIT} yet.</h2></div>`;
    }

    const data = richest.map(([userid, exp], index) => {
      const level = ExpSystem.getLevel(exp);
      const expForNext = ExpSystem.getExpForNextLevel(level + 1);
      return [
        (index + 1).toString(),
        Impulse.nameColor(userid, true, true),
        `${exp} ${EXP_UNIT}`,
        level.toString(),
        `${expForNext} ${EXP_UNIT}`,
      ];
    });

    const output = Impulse.generateThemedTable(
      `Top ${richest.length} Users by ${EXP_UNIT}`,
      ['Rank', 'User', 'EXP', 'Level', 'Next Level At'],
      data,
      Impulse.nameColor('TurboRx', true, true)
    );
    return `<div class="pad ladder">${output}</div>`;
  },
};

// Helper functions for command responses
const createProgressBarHTML = (percentage: number): string => {
  return (
    `<div style="width: 200px; height: 18px; background: rgba(200, 200, 200, 0.2); border-radius: 10px; overflow: hidden; border: 1px solid rgba(150, 150, 150, 0.3); margin: 5px auto;">` +
    `<div style="width: ${percentage}%; height: 100%; background: linear-gradient(90deg, #3498db, #2980b9); box-shadow: inset 0 0 5px rgba(0, 0, 0, 0.2);"></div>` +
    `</div>`
  );
};

const createExpDisplayHTML = (userid: string, levelInfo: LevelInfo, executedBy: string = ''): string => {
  const progressBarHTML = createProgressBarHTML(levelInfo.progressPercentage);
  
  return (
    `<div style="background: linear-gradient(135deg, rgba(255, 255, 255, 0.05), rgba(0, 0, 0, 0.05)); border-radius: 10px; padding: 12px; box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1); border: 1px solid rgba(125, 125, 125, 0.2);">` +
    
    // Name at the top
    `<div style="text-align: center; margin-bottom: 8px;">` +
    `<div style="font-size: 1.5em; font-weight: bold;">` +
    `<span>${Impulse.nameColor(userid, true, false)}</span>` +
    `</div>` +
    `</div>` +
    
    // Level display
    `<div style="text-align: center; margin-bottom: 10px;">` +
    `<div style="font-size: 1.3em; font-weight: bold; display: inline-block; padding: 3px 12px; border-radius: 15px; background: linear-gradient(90deg, rgba(52, 152, 219, 0.2), rgba(155, 89, 182, 0.2)); color: #3498db;">` +
    `Level ${levelInfo.level}` +
    `</div>` +
    `</div>` +
    
    // Progress bar
    `<div style="margin: 12px 0;">` +
    `${progressBarHTML}` +
    `</div>` +
    
    // Completion percentage
    `<div style="text-align: center; font-size: 0.9em; margin-bottom: 10px;">` +
    `${levelInfo.progressPercentage}% complete` +
    `</div>` +
    
    // Stats boxes
    `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 5px;">` +
    `<div style="background: rgba(150, 150, 150, 0.1); padding: 8px; border-radius: 8px; text-align: center;">` +
    `<div style="font-size: 0.8em; opacity: 0.7;">Current EXP</div>` +
    `<div style="font-weight: bold; color: #3498db;">${levelInfo.currentExp} ${EXP_UNIT}</div>` +
    `</div>` +
    `<div style="background: rgba(150, 150, 150, 0.1); padding: 8px; border-radius: 8px; text-align: center;">` +
    `<div style="font-size: 0.8em; opacity: 0.7;">Needed for Level ${levelInfo.level + 1}</div>` +
    `<div style="font-weight: bold; color: #e74c3c;">${levelInfo.expNeeded} ${EXP_UNIT}</div>` +
    `</div>` +
    `</div>` +
    
    `<div style="font-size: 0.8em; margin-top: 10px; text-align: center; opacity: 0.7;">` +
    `Total progress: ${levelInfo.currentExp}/${levelInfo.expForNext} ${EXP_UNIT}` +
    `</div>` +
    `</div>`
  );
};

const validateExpCommand = (parts: string[]): { user: User | null; amount: number; reason: string; error?: string } => {
  if (parts.length < 2) {
    return { user: null, amount: 0, reason: '', error: 'Usage: [user], [amount], [reason]' };
  }

  const targetUser = Users.get(parts[0]);
  const amount = parseInt(parts[1], 10);
  const reason = parts.slice(2).join(',').trim() || 'No reason specified.';

  if (!targetUser) {
    return { user: null, amount: 0, reason, error: `User "${parts[0]}" not found.` };
  }
  if (isNaN(amount) || amount <= 0) {
    return { user: null, amount: 0, reason, error: 'Please specify a valid positive amount.' };
  }

  return { user: targetUser, amount, reason };
};

// Commands component
export const commands: Chat.Commands = {
  level: 'exp',
  exp(target, room, user) {
    if (!target) target = user.name;
    if (!this.runBroadcast()) return;
    
    const userid = toSafeID(target);
    const levelInfo = ExpSystem.getLevelInfo(userid);
    const executedBy = user.name === target ? '' : ` (Checked by ${Impulse.nameColor(user.name, true, true)})`;
    
    const displayHTML = createExpDisplayHTML(userid, levelInfo, executedBy);
    this.sendReplyBox(displayHTML);
  },

  giveexp(target, room, user) {
    this.checkCan('manager');
    if (!target) return this.sendReply(`Usage: /giveexp [user], [amount], [reason]`);
    
    const parts = target.split(',').map(p => p.trim());
    const validation = validateExpCommand(parts);
    
    if (validation.error) {
      return this.errorReply(validation.error);
    }

    const { user: targetUser, amount, reason } = validation;
    if (!targetUser) return; // TypeScript guard

    ExpSystem.addExp(targetUser.id, amount, reason, user.id);
    const levelInfo = ExpSystem.getLevelInfo(targetUser.id);
    
    this.sendReplyBox(
      `${Impulse.nameColor(user.name, true, true)} gave ${amount} ${EXP_UNIT}${DOUBLE_EXP ? ' (Double EXP)' : ''} to ${Impulse.nameColor(targetUser.name, true, true)} (${reason}). ` +
      `New Level: ${levelInfo.level} (${levelInfo.currentExp}/${levelInfo.expForNext} ${EXP_UNIT})`
    );
    
    this.modlog('GIVEEXP', targetUser, `${amount} ${EXP_UNIT}${DOUBLE_EXP ? ' (Double EXP)' : ''}`, { by: user.id, reason });
    if (targetUser.connected) {
      targetUser.popup(
        `|html|You received <b>${amount} ${EXP_UNIT}${DOUBLE_EXP ? ' (Double EXP)' : ''}</b> from <b>${Impulse.nameColor(user.name, true, true)}</b>.<br>` +
        `Reason: ${reason}<br>` +
        `You are now Level ${levelInfo.level} (${levelInfo.currentExp}/${levelInfo.expForNext} ${EXP_UNIT})`
      );
    }
  },

  takeexp(target, room, user) {
    this.checkCan('manager');
    if (!target) return this.sendReply(`Usage: /takeexp [user], [amount], [reason]`);
    
    const parts = target.split(',').map(p => p.trim());
    const validation = validateExpCommand(parts);
    
    if (validation.error) {
      return this.errorReply(validation.error);
    }

    const { user: targetUser, amount, reason } = validation;
    if (!targetUser) return; // TypeScript guard

    ExpSystem.takeExp(targetUser.id, amount, reason, user.id);
    const levelInfo = ExpSystem.getLevelInfo(targetUser.id);
    
    this.sendReplyBox(
      `${Impulse.nameColor(user.name, true, true)} took ${amount} ${EXP_UNIT} from ${Impulse.nameColor(targetUser.name, true, true)} (${reason}). ` +
      `New Level: ${levelInfo.level} (${levelInfo.currentExp}/${levelInfo.expForNext} ${EXP_UNIT})`
    );
    
    this.modlog('TAKEEXP', targetUser, `${amount} ${EXP_UNIT}`, { by: user.id, reason });
    if (targetUser.connected) {
      targetUser.popup(
        `|html|<b>${Impulse.nameColor(user.name, true, true)}</b> took <b>${amount} ${EXP_UNIT}</b> from you.<br>` +
        `Reason: ${reason}<br>` +
        `You are now Level ${levelInfo.level} (${levelInfo.currentExp}/${levelInfo.expForNext} ${EXP_UNIT})`
      );
    }
  },

  resetexp(target, room, user) {
    this.checkCan('manager');
    if (!target) return this.sendReply(`Usage: /resetexp [user], [reason]`);
    
    const parts = target.split(',').map(p => p.trim());
    const targetUser = Users.get(parts[0]);
    const reason = parts.slice(1).join(',').trim() || 'No reason specified.';

    if (!targetUser) {
      return this.errorReply(`User "${parts[0]}" not found.`);
    }

    ExpSystem.writeExp(targetUser.id, DEFAULT_EXP);
    this.sendReplyBox(
      `${Impulse.nameColor(user.name, true, true)} reset ${Impulse.nameColor(targetUser.name, true, true)}'s EXP to ${DEFAULT_EXP} ${EXP_UNIT} (Level 0) (${reason}).`
    );
    
    this.modlog('RESETEXP', targetUser, `${DEFAULT_EXP} ${EXP_UNIT}`, { by: user.id, reason });
    if (targetUser.connected) {
      targetUser.popup(
        `|html|Your ${EXP_UNIT} has been reset to <b>${DEFAULT_EXP}</b> (Level 0) by <b>${Impulse.nameColor(user.name, true, true)}</b>.<br>` +
        `Reason: ${reason}`
      );
    }
  },

  resetexpall(target, room, user) {
    this.checkCan('manager');
    const reason = target.trim() || 'No reason specified.';

    ExpSystem.resetAllExp();
    this.sendReplyBox(
      `All user EXP has been reset to ${DEFAULT_EXP} ${EXP_UNIT} (Level 0) (${reason}).`
    );
    
    this.modlog('RESETEXPALL', null, `all EXP to ${DEFAULT_EXP} ${EXP_UNIT}`, { by: user.id, reason });
    if (room) {
      room.add(
        `|html|<center><div class="broadcast-blue">` +
        `<b>${Impulse.nameColor(user.name, true, true)}</b> has reset all ${EXP_UNIT} to <b>${DEFAULT_EXP}</b> (Level 0).<br>` +
        `Reason: ${reason}` +
        `</div></center>`
      );
      room.update();
    }
  },

  toggledoubleexp(target, room, user) {
    this.checkCan('manager');
    
    if (!target) {
      DOUBLE_EXP = !DOUBLE_EXP;
      DOUBLE_EXP_END_TIME = null;
      ExpSystem.saveExpConfig();
      ExpSystem.checkDoubleExpStatus(room, user);
      return;
    }

    if (target.toLowerCase() === 'off') {
      DOUBLE_EXP = false;
      DOUBLE_EXP_END_TIME = null;
      ExpSystem.saveExpConfig();
      ExpSystem.checkDoubleExpStatus(room, user);
      return;
    }

    const match = target.match(/^(\d+)\s*(minute|hour|day)s?$/i);
    if (!match) {
      return this.errorReply('Invalid format. Use: number + unit (minutes/hours/days)');
    }

    const [, amount, unit] = match;
    const duration = getDurationMs(parseInt(amount), unit.toLowerCase());
    const endTime = Date.now() + duration;

    DOUBLE_EXP = true;
    DOUBLE_EXP_END_TIME = endTime;
    
    ExpSystem.saveExpConfig();
    ExpSystem.checkDoubleExpStatus(room, user);
    setTimeout(() => ExpSystem.checkDoubleExpStatus(), duration);
  },
  
  expladder(target, room, user) {
    if (!this.runBroadcast()) return;
    return this.parse(`/join view-expladder`);
  },

  exphelp(target, room, user) {
    if (!this.runBroadcast()) return;
    this.sendReplyBox(
      `<div><b><center>EXP System Commands By ${Impulse.nameColor('Prince Sky', true, true)}</center></b>` +
      `<ul>` +
      `<li><code>/level [user]</code> (Or <code>/exp</code>) - Check your or another user's EXP, current level, and EXP needed for the next level.</li>` +
      `<li><code>/giveexp [user], [amount], [reason]</code> - Give a specified amount of EXP to a user. (Requires: & and higher)</li>` +
      `<li><code>/takeexp [user], [amount], [reason]</code> - Take a specified amount of EXP from a user. (Requires: & and higher)</li>` +
      `<li><code>/resetexp [user], [reason]</code> - Reset a user's EXP to ${DEFAULT_EXP}. (Requires: & and higher)</li>` +
      `<li><code>/resetexpall [reason]</code> - Reset all users' EXP to ${DEFAULT_EXP}. (Requires: & and higher)</li>` +
      `<li><code>/expladder</code> - View the top 100 users with the most EXP and their levels.</li>` +
      `<li><code>/toggledoubleexp [duration]</code> - Toggle double EXP with optional duration (e.g., "2 hours", "1 day", "30 minutes"). Use "off" to disable. (Requires: & and higher)</li>` +
      `</ul></div>`
    );
  },
};