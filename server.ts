import express from 'express';
import { createServer as createViteServer } from 'vite';
import { Server } from 'socket.io';
import { createServer } from 'http';
import { v4 as uuidv4 } from 'uuid';
import { GameState, Player, PlayerInput, Bullet, Box, DroppedItem, WeaponType, SkillType, ItemType, KillEvent } from './src/shared/types.js';

const PORT = 3000;
const MAP_WIDTH = 3000;
const MAP_HEIGHT = 3000;
const TICK_RATE = 30; // 30 updates per second
const TICK_INTERVAL = 1000 / TICK_RATE;

const rooms: Record<string, GameState> = {};
const playerRooms: Record<string, string> = {};
const playerInputs: Record<string, PlayerInput> = {};

function createInitialGameState(roomId: string): GameState {
  return {
    roomId,
    players: {},
    bullets: {},
    boxes: {},
    items: {},
    safeZone: {
      x: MAP_WIDTH / 2,
      y: MAP_HEIGHT / 2,
      radius: MAP_WIDTH,
      targetX: MAP_WIDTH / 2,
      targetY: MAP_HEIGHT / 2,
      targetRadius: MAP_WIDTH,
      shrinkStartTime: Date.now() + 10000, // Start shrinking after 10s
      shrinkEndTime: Date.now() + 40000, // Shrink over 30s
    },
    mapWidth: MAP_WIDTH,
    mapHeight: MAP_HEIGHT,
    gameStarted: false,
    gameEnded: false,
    winnerName: null,
  };
}

function spawnBoxes(gameState: GameState, count: number) {
  for (let i = 0; i < count; i++) {
    const id = uuidv4();
    gameState.boxes[id] = {
      id,
      x: Math.random() * MAP_WIDTH,
      y: Math.random() * MAP_HEIGHT,
      hp: 50,
      maxHp: 50,
    };
  }
}

function getRandomItem(): ItemType {
  const rand = Math.random();
  if (rand < 0.2) return 'shotgun';
  if (rand < 0.4) return 'rifle';
  if (rand < 0.6) return 'sniper';
  if (rand < 0.8) return 'dash';
  return 'heal';
}

function getWeaponStats(weapon: WeaponType) {
  switch (weapon) {
    case 'pistol': return { damage: 15, speed: 15, range: 600, cooldown: 400, spread: 0, count: 1 };
    case 'shotgun': return { damage: 12, speed: 12, range: 400, cooldown: 800, spread: 0.2, count: 5 };
    case 'rifle': return { damage: 10, speed: 18, range: 800, cooldown: 150, spread: 0.05, count: 1 };
    case 'sniper': return { damage: 60, speed: 25, range: 1500, cooldown: 1500, spread: 0, count: 1 };
  }
}

function getSkillCooldown(skill: SkillType) {
  switch (skill) {
    case 'dash': return 3000;
    case 'heal': return 10000;
    default: return 0;
  }
}

function startGame(roomId: string) {
  const oldState = rooms[roomId];
  const newState = createInitialGameState(roomId);
  newState.gameStarted = true;
  spawnBoxes(newState, 50);
  
  // Reset all connected players
  if (oldState) {
    for (const id in oldState.players) {
      newState.players[id] = createPlayer(id, oldState.players[id].name);
    }
  }
  rooms[roomId] = newState;
}

function createPlayer(id: string, name: string): Player {
  return {
    id,
    name,
    x: Math.random() * MAP_WIDTH,
    y: Math.random() * MAP_HEIGHT,
    hp: 100,
    maxHp: 100,
    weapon: 'pistol',
    skill: 'none',
    kills: 0,
    isAlive: true,
    color: `hsl(${Math.random() * 360}, 70%, 50%)`,
    lastShootTime: 0,
    lastSkillTime: 0,
    dashEndTime: 0,
    dashDir: { x: 0, y: 0 },
  };
}

function updateGame(io: Server, roomId: string) {
  const gameState = rooms[roomId];
  if (!gameState || !gameState.gameStarted || gameState.gameEnded) return;

  const now = Date.now();

  // Update Safe Zone
  if (now > gameState.safeZone.shrinkEndTime) {
    // Set next shrink
    if (gameState.safeZone.targetRadius > 0) {
      gameState.safeZone.radius = gameState.safeZone.targetRadius;
      gameState.safeZone.x = gameState.safeZone.targetX;
      gameState.safeZone.y = gameState.safeZone.targetY;
      
      gameState.safeZone.targetRadius = Math.max(0, gameState.safeZone.radius - 300);
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * (gameState.safeZone.radius - gameState.safeZone.targetRadius);
      gameState.safeZone.targetX = gameState.safeZone.x + Math.cos(angle) * dist;
      gameState.safeZone.targetY = gameState.safeZone.y + Math.sin(angle) * dist;
      
      gameState.safeZone.shrinkStartTime = now + 10000; // Wait 10s
      gameState.safeZone.shrinkEndTime = now + 40000; // Shrink over 30s
    }
  } else if (now > gameState.safeZone.shrinkStartTime) {
    const ticksLeft = (gameState.safeZone.shrinkEndTime - now) / TICK_INTERVAL;
    if (ticksLeft > 0) {
      gameState.safeZone.radius -= (gameState.safeZone.radius - gameState.safeZone.targetRadius) / ticksLeft;
      gameState.safeZone.x -= (gameState.safeZone.x - gameState.safeZone.targetX) / ticksLeft;
      gameState.safeZone.y -= (gameState.safeZone.y - gameState.safeZone.targetY) / ticksLeft;
    }
  }

  // Update Players
  let aliveCount = 0;
  let lastAlivePlayer: Player | null = null;

  for (const id in gameState.players) {
    const player = gameState.players[id];
    if (!player.isAlive) continue;
    aliveCount++;
    lastAlivePlayer = player;

    const input = playerInputs[id];
    if (!input) continue;

    // Movement
    let speed = 7;
    let isDashing = false;

    if (now < player.dashEndTime) {
      speed = 20;
      isDashing = true;
      player.x += player.dashDir.x * speed;
      player.y += player.dashDir.y * speed;
    } else {
      let dx = 0;
      let dy = 0;
      if (input.up) dy -= 1;
      if (input.down) dy += 1;
      if (input.left) dx -= 1;
      if (input.right) dx += 1;

      if (dx !== 0 || dy !== 0) {
        const len = Math.sqrt(dx * dx + dy * dy);
        player.x += (dx / len) * speed;
        player.y += (dy / len) * speed;
      }
    }

    // Bounds
    player.x = Math.max(20, Math.min(MAP_WIDTH - 20, player.x));
    player.y = Math.max(20, Math.min(MAP_HEIGHT - 20, player.y));

    // Safe zone damage
    const distToSafeZone = Math.sqrt(Math.pow(player.x - gameState.safeZone.x, 2) + Math.pow(player.y - gameState.safeZone.y, 2));
    if (distToSafeZone > gameState.safeZone.radius) {
      player.hp -= 1; // 1 damage per tick outside safe zone
      if (player.hp <= 0) {
        player.isAlive = false;
        dropLoot(gameState, player.x, player.y, player.weapon, player.skill);
      }
    }

    // Skills
    if (input.useSkill && now - player.lastSkillTime > getSkillCooldown(player.skill)) {
      if (player.skill === 'dash') {
        player.lastSkillTime = now;
        player.dashEndTime = now + 200;
        
        // Dash towards mouse
        const dx = input.mouseX - player.x;
        const dy = input.mouseY - player.y;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        player.dashDir = { x: dx / len, y: dy / len };
      } else if (player.skill === 'heal') {
        player.lastSkillTime = now;
        player.hp = Math.min(player.maxHp, player.hp + 50);
      }
    }

    // Shooting
    if (input.shooting && now - player.lastShootTime > getWeaponStats(player.weapon).cooldown) {
      player.lastShootTime = now;
      const stats = getWeaponStats(player.weapon);
      
      const dx = input.mouseX - player.x;
      const dy = input.mouseY - player.y;
      const baseAngle = Math.atan2(dy, dx);

      for (let i = 0; i < stats.count; i++) {
        const angle = baseAngle + (Math.random() - 0.5) * stats.spread;
        const bulletId = uuidv4();
        gameState.bullets[bulletId] = {
          id: bulletId,
          ownerId: player.id,
          x: player.x,
          y: player.y,
          vx: Math.cos(angle) * stats.speed,
          vy: Math.sin(angle) * stats.speed,
          damage: stats.damage,
          range: stats.range,
          distanceTraveled: 0,
          color: player.color,
        };
      }
    }

    // Pickup items (only when interact is pressed)
    if (input.interact) {
      for (const itemId in gameState.items) {
        const item = gameState.items[itemId];
        const dist = Math.sqrt(Math.pow(player.x - item.x, 2) + Math.pow(player.y - item.y, 2));
        if (dist < 40) {
          if (['pistol', 'shotgun', 'rifle', 'sniper'].includes(item.type)) {
            // Swap weapon
            const oldWeapon = player.weapon;
            player.weapon = item.type as WeaponType;
            item.type = oldWeapon; // Drop old weapon
            if (oldWeapon === 'pistol') {
               delete gameState.items[itemId]; // Don't drop pistol
            }
          } else {
            // Swap skill
            const oldSkill = player.skill;
            player.skill = item.type as SkillType;
            if (oldSkill === 'none') {
              delete gameState.items[itemId];
            } else {
              item.type = oldSkill;
            }
          }
          input.interact = false; // Prevent picking up multiple items at once
          break;
        }
      }
    }
  }

  // Check win condition
  if (aliveCount <= 1 && Object.keys(gameState.players).length > 1) {
    gameState.gameEnded = true;
    gameState.winnerName = lastAlivePlayer ? lastAlivePlayer.name : 'No one';
    setTimeout(() => startGame(roomId), 10000); // Restart after 10s
  } else if (aliveCount === 0 && Object.keys(gameState.players).length === 1) {
     // Solo player died
     gameState.gameEnded = true;
     gameState.winnerName = 'No one';
     setTimeout(() => startGame(roomId), 5000);
  }

  // Update Bullets
  for (const id in gameState.bullets) {
    const bullet = gameState.bullets[id];
    bullet.x += bullet.vx;
    bullet.y += bullet.vy;
    const speed = Math.sqrt(bullet.vx * bullet.vx + bullet.vy * bullet.vy);
    bullet.distanceTraveled += speed;

    let hit = false;

    // Check player collision
    for (const playerId in gameState.players) {
      const player = gameState.players[playerId];
      if (!player.isAlive || player.id === bullet.ownerId) continue;

      const dist = Math.sqrt(Math.pow(player.x - bullet.x, 2) + Math.pow(player.y - bullet.y, 2));
      if (dist < 20) { // Player radius
        player.hp -= bullet.damage;
        hit = true;
        if (player.hp <= 0) {
          player.isAlive = false;
          dropLoot(gameState, player.x, player.y, player.weapon, player.skill);
          const owner = gameState.players[bullet.ownerId];
          if (owner) {
            owner.kills++;
            io.to(roomId).emit('killEvent', { killerName: owner.name, victimName: player.name });
          }
        }
        break;
      }
    }

    // Check box collision
    if (!hit) {
      for (const boxId in gameState.boxes) {
        const box = gameState.boxes[boxId];
        const dist = Math.sqrt(Math.pow(box.x - bullet.x, 2) + Math.pow(box.y - bullet.y, 2));
        if (dist < 25) { // Box radius
          box.hp -= bullet.damage;
          hit = true;
          if (box.hp <= 0) {
            delete gameState.boxes[boxId];
            const dropId = uuidv4();
            gameState.items[dropId] = {
              id: dropId,
              x: box.x,
              y: box.y,
              type: getRandomItem(),
            };
          }
          break;
        }
      }
    }

    if (hit || bullet.distanceTraveled >= bullet.range || bullet.x < 0 || bullet.x > MAP_WIDTH || bullet.y < 0 || bullet.y > MAP_HEIGHT) {
      delete gameState.bullets[id];
    }
  }
}

function dropLoot(gameState: GameState, x: number, y: number, weapon: WeaponType, skill: SkillType) {
  if (weapon !== 'pistol') {
    const id = uuidv4();
    gameState.items[id] = { id, x: x - 20, y, type: weapon };
  }
  if (skill !== 'none') {
    const id = uuidv4();
    gameState.items[id] = { id, x: x + 20, y, type: skill };
  }
}

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: '*' }
  });

  // API routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Socket.io
  io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);
    
    socket.on('joinRoom', (roomId: string, playerName: string) => {
      // Leave previous room
      const oldRoomId = playerRooms[socket.id];
      if (oldRoomId) {
        socket.leave(oldRoomId);
        if (rooms[oldRoomId]) {
          delete rooms[oldRoomId].players[socket.id];
        }
      }

      socket.join(roomId);
      playerRooms[socket.id] = roomId;

      if (!rooms[roomId]) {
        rooms[roomId] = createInitialGameState(roomId);
      }
      
      const gameState = rooms[roomId];
      const newPlayer = createPlayer(socket.id, playerName || `Player_${socket.id.substring(0, 4)}`);
      
      if (gameState.gameStarted && Object.keys(gameState.players).length > 0) {
        newPlayer.isAlive = false;
      }
      
      gameState.players[socket.id] = newPlayer;
      playerInputs[socket.id] = {
        up: false, down: false, left: false, right: false,
        mouseX: 0, mouseY: 0, shooting: false, useSkill: false, interact: false
      };

      socket.emit('init', socket.id);
    });

    socket.on('startGame', () => {
      const roomId = playerRooms[socket.id];
      if (roomId && rooms[roomId]) {
        startGame(roomId);
      }
    });

    socket.on('input', (input: PlayerInput) => {
      playerInputs[socket.id] = input;
    });

    socket.on('disconnect', () => {
      console.log('Player disconnected:', socket.id);
      const roomId = playerRooms[socket.id];
      if (roomId && rooms[roomId]) {
        delete rooms[roomId].players[socket.id];
      }
      delete playerRooms[socket.id];
      delete playerInputs[socket.id];
    });
  });

  // Game Loop
  setInterval(() => {
    for (const roomId in rooms) {
      updateGame(io, roomId);
      io.to(roomId).emit('state', rooms[roomId]);
    }
  }, TICK_INTERVAL);

  // Vite middleware
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
