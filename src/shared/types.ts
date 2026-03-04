export type WeaponType = 'pistol' | 'shotgun' | 'rifle' | 'sniper';
export type SkillType = 'none' | 'dash' | 'heal';
export type ItemType = WeaponType | SkillType;

export interface Player {
  id: string;
  name: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  weapon: WeaponType;
  skill: SkillType;
  kills: number;
  isAlive: boolean;
  color: string;
  lastShootTime: number;
  lastSkillTime: number;
  dashEndTime: number;
  dashDir: { x: number; y: number };
}

export interface Bullet {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  range: number;
  distanceTraveled: number;
  color: string;
}

export interface Box {
  id: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
}

export interface DroppedItem {
  id: string;
  x: number;
  y: number;
  type: ItemType;
}

export interface SafeZone {
  x: number;
  y: number;
  radius: number;
  targetX: number;
  targetY: number;
  targetRadius: number;
  shrinkStartTime: number;
  shrinkEndTime: number;
}

export interface GameState {
  roomId: string;
  players: Record<string, Player>;
  bullets: Record<string, Bullet>;
  boxes: Record<string, Box>;
  items: Record<string, DroppedItem>;
  safeZone: SafeZone;
  mapWidth: number;
  mapHeight: number;
  gameStarted: boolean;
  gameEnded: boolean;
  winnerName: string | null;
}

export interface PlayerInput {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  mouseX: number;
  mouseY: number;
  shooting: boolean;
  useSkill: boolean;
  interact: boolean;
}

export interface KillEvent {
  killerName: string;
  victimName: string;
}

