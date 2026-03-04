import React, { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { GameState, PlayerInput, KillEvent } from '../shared/types';
import MainMenu from './MainMenu';

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [inGame, setInGame] = useState(false);
  const [killMessages, setKillMessages] = useState<string[]>([]);
  const [interactionText, setInteractionText] = useState<string | null>(null);

  const inputRef = useRef<PlayerInput>({
    up: false, down: false, left: false, right: false,
    mouseX: 0, mouseY: 0, shooting: false, useSkill: false, interact: false
  });

  useEffect(() => {
    const newSocket = io();
    setSocket(newSocket);

    newSocket.on('init', (id: string) => {
      setPlayerId(id);
    });

    newSocket.on('state', (state: GameState) => {
      setGameState(state);
    });

    newSocket.on('killEvent', (event: KillEvent) => {
      setKillMessages(prev => {
        const newMsgs = [...prev, `你击败了玩家 [${event.victimName}]，获得了他的全部技能与装备。`];
        setTimeout(() => {
          setKillMessages(current => current.slice(1));
        }, 5000);
        return newMsgs;
      });
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const handleJoinRoom = (roomId: string, playerName: string) => {
    if (socket) {
      socket.emit('joinRoom', roomId, playerName);
      setInGame(true);
    }
  };

  const handleStartGame = () => {
    if (socket) {
      socket.emit('startGame');
    }
  };

  useEffect(() => {
    if (!inGame) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'w' || e.key === 'W') inputRef.current.up = true;
      if (e.key === 's' || e.key === 'S') inputRef.current.down = true;
      if (e.key === 'a' || e.key === 'A') inputRef.current.left = true;
      if (e.key === 'd' || e.key === 'D') inputRef.current.right = true;
      if (e.key === ' ') inputRef.current.useSkill = true;
      if (e.key === 'f' || e.key === 'F') inputRef.current.interact = true;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'w' || e.key === 'W') inputRef.current.up = false;
      if (e.key === 's' || e.key === 'S') inputRef.current.down = false;
      if (e.key === 'a' || e.key === 'A') inputRef.current.left = false;
      if (e.key === 'd' || e.key === 'D') inputRef.current.right = false;
      if (e.key === ' ') inputRef.current.useSkill = false;
      if (e.key === 'f' || e.key === 'F') inputRef.current.interact = false;
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!canvasRef.current || !gameState || !playerId) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const me = gameState.players[playerId];
      if (!me) return;

      const canvasX = e.clientX - rect.left;
      const canvasY = e.clientY - rect.top;
      
      const cameraX = me.x - window.innerWidth / 2;
      const cameraY = me.y - window.innerHeight / 2;

      inputRef.current.mouseX = canvasX + cameraX;
      inputRef.current.mouseY = canvasY + cameraY;
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0) inputRef.current.shooting = true;
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 0) inputRef.current.shooting = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [gameState, playerId, inGame]);

  useEffect(() => {
    if (!socket || !inGame) return;
    const interval = setInterval(() => {
      socket.emit('input', inputRef.current);
    }, 1000 / 30);
    return () => clearInterval(interval);
  }, [socket, inGame]);

  // Check for interactions
  useEffect(() => {
    if (!gameState || !playerId || !inGame) {
      setInteractionText(null);
      return;
    }

    const me = gameState.players[playerId];
    if (!me || !me.isAlive) {
      setInteractionText(null);
      return;
    }

    let foundInteraction = false;

    // Check boxes
    for (const boxId in gameState.boxes) {
      const box = gameState.boxes[boxId];
      const dist = Math.sqrt(Math.pow(me.x - box.x, 2) + Math.pow(me.y - box.y, 2));
      if (dist < 60) {
        setInteractionText('射击打破补给箱');
        foundInteraction = true;
        break;
      }
    }

    // Check items
    if (!foundInteraction) {
      for (const itemId in gameState.items) {
        const item = gameState.items[itemId];
        const dist = Math.sqrt(Math.pow(me.x - item.x, 2) + Math.pow(me.y - item.y, 2));
        if (dist < 40) {
          setInteractionText(`发现更高级的 [${item.type}]，按 [F] 替换`);
          foundInteraction = true;
          break;
        }
      }
    }

    if (!foundInteraction) {
      setInteractionText(null);
    }
  }, [gameState, playerId, inGame]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !gameState || !playerId || !inGame) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const me = gameState.players[playerId];
    if (!me) return;

    const cameraX = me.x - canvas.width / 2;
    const cameraY = me.y - canvas.height / 2;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(-cameraX, -cameraY);

    // Draw Map Bounds
    ctx.fillStyle = '#222';
    ctx.fillRect(0, 0, gameState.mapWidth, gameState.mapHeight);

    // Draw Grid
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    for (let x = 0; x <= gameState.mapWidth; x += 100) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, gameState.mapHeight); ctx.stroke();
    }
    for (let y = 0; y <= gameState.mapHeight; y += 100) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(gameState.mapWidth, y); ctx.stroke();
    }

    // Draw Safe Zone
    ctx.fillStyle = 'rgba(0, 255, 0, 0.05)';
    ctx.beginPath();
    ctx.arc(gameState.safeZone.x, gameState.safeZone.y, gameState.safeZone.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
    ctx.lineWidth = 5;
    ctx.stroke();

    // Draw Danger Zone (outside Safe Zone)
    ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
    ctx.beginPath();
    ctx.rect(0, 0, gameState.mapWidth, gameState.mapHeight);
    ctx.arc(gameState.safeZone.x, gameState.safeZone.y, gameState.safeZone.radius, 0, Math.PI * 2, true);
    ctx.fill();

    // Draw Safe Zone Target
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.arc(gameState.safeZone.targetX, gameState.safeZone.targetY, gameState.safeZone.targetRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw Items
    for (const id in gameState.items) {
      const item = gameState.items[id];
      ctx.fillStyle = ['pistol', 'shotgun', 'rifle', 'sniper'].includes(item.type) ? '#ffaa00' : '#00aaff';
      ctx.beginPath();
      ctx.arc(item.x, item.y, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = '10px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(item.type, item.x, item.y - 15);
    }

    // Draw Boxes
    for (const id in gameState.boxes) {
      const box = gameState.boxes[id];
      ctx.fillStyle = '#8b4513';
      ctx.fillRect(box.x - 20, box.y - 20, 40, 40);
      // HP Bar
      ctx.fillStyle = 'red';
      ctx.fillRect(box.x - 20, box.y - 30, 40, 5);
      ctx.fillStyle = 'green';
      ctx.fillRect(box.x - 20, box.y - 30, 40 * (box.hp / box.maxHp), 5);
    }

    // Draw Bullets
    for (const id in gameState.bullets) {
      const bullet = gameState.bullets[id];
      ctx.fillStyle = bullet.color;
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw Players
    for (const id in gameState.players) {
      const player = gameState.players[id];
      if (!player.isAlive) continue;

      ctx.fillStyle = player.color;
      ctx.beginPath();
      ctx.arc(player.x, player.y, 20, 0, Math.PI * 2);
      ctx.fill();

      // Draw Name
      ctx.fillStyle = '#fff';
      ctx.font = '14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(player.name, player.x, player.y - 35);

      // Draw HP Bar
      ctx.fillStyle = 'red';
      ctx.fillRect(player.x - 20, player.y - 30, 40, 5);
      ctx.fillStyle = 'green';
      ctx.fillRect(player.x - 20, player.y - 30, 40 * (player.hp / player.maxHp), 5);
    }

    ctx.restore();
  }, [gameState, playerId, inGame]);

  if (!inGame) {
    return <MainMenu onJoinRoom={handleJoinRoom} />;
  }

  if (!gameState || !playerId) {
    return <div className="flex items-center justify-center h-screen bg-zinc-900 text-white">Connecting to server...</div>;
  }

  const me = gameState.players[playerId];

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black font-sans">
      <canvas ref={canvasRef} className="block w-full h-full" />
      
      {/* UI Overlay */}
      {me && (
        <div className="absolute bottom-0 left-0 p-6 text-white pointer-events-none">
          <div className="text-2xl font-bold mb-2">HP: {Math.max(0, Math.floor(me.hp))} / {me.maxHp}</div>
          <div className="text-xl mb-1">Weapon: <span className="text-yellow-400 uppercase">{me.weapon}</span></div>
          <div className="text-xl mb-1">Skill: <span className="text-blue-400 uppercase">{me.skill}</span></div>
          <div className="text-xl">Kills: {me.kills}</div>
        </div>
      )}

      <div className="absolute top-0 right-0 p-6 text-white text-right pointer-events-none">
        <div className="text-xl font-bold mb-2">Room: {gameState.roomId}</div>
        <div className="text-xl font-bold">Alive: {Object.values(gameState.players).filter((p: any) => p.isAlive).length}</div>
      </div>

      {/* Interaction Prompt */}
      {interactionText && me?.isAlive && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 mt-20 text-white bg-black/50 px-6 py-2 rounded-full font-bold animate-pulse pointer-events-none">
          {interactionText}
        </div>
      )}

      {/* Kill Messages */}
      <div className="absolute top-20 right-6 space-y-2 pointer-events-none">
        {killMessages.map((msg, i) => (
          <div key={i} className="bg-red-500/80 text-white px-4 py-2 rounded-lg text-sm shadow-lg animate-in slide-in-from-right">
            {msg}
          </div>
        ))}
      </div>

      {/* Lobby State */}
      {!gameState.gameStarted && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-white flex-col">
          <h1 className="text-4xl font-bold mb-4">等待玩家加入...</h1>
          <p className="text-xl mb-8">当前人数: {Object.keys(gameState.players).length}</p>
          <button 
            onClick={handleStartGame}
            className="px-8 py-4 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-xl text-xl pointer-events-auto"
          >
            开始游戏 (START GAME)
          </button>
        </div>
      )}

      {!me?.isAlive && gameState.gameStarted && !gameState.gameEnded && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-white flex-col">
          <h1 className="text-6xl font-bold mb-4 text-red-500">YOU DIED</h1>
          <p className="text-2xl">Spectating...</p>
        </div>
      )}

      {gameState.gameEnded && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-white flex-col">
          <h1 className="text-6xl font-bold mb-4 text-yellow-400">GAME OVER</h1>
          <p className="text-3xl mb-8">Winner: {gameState.winnerName}</p>
          <p className="text-xl text-zinc-400">Restarting soon...</p>
        </div>
      )}
    </div>
  );
}
