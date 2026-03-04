import { useState } from 'react';

type MenuState = 'main' | 'quick' | 'room' | 'connecting';

interface MainMenuProps {
  onJoinRoom: (roomId: string, playerName: string) => void;
}

export default function MainMenu({ onJoinRoom }: MainMenuProps) {
  const [menuState, setMenuState] = useState<MenuState>('main');
  const [roomId, setRoomId] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [statusText, setStatusText] = useState('');

  const handleQuickPlay = () => {
    setMenuState('connecting');
    setStatusText('正在搜寻附近的幸存者...');
    // Simulate finding a room
    setTimeout(() => {
      setStatusText('正在空投至目标区域...');
      setTimeout(() => {
        onJoinRoom('public-match', playerName || 'Survivor');
      }, 1000);
    }, 1500);
  };

  const handleJoinRoom = () => {
    if (!roomId || roomId.length !== 6) {
      alert('房间号不存在，请重新输入。');
      return;
    }
    setMenuState('connecting');
    setStatusText('正在空投至目标区域...');
    setTimeout(() => {
      onJoinRoom(roomId, playerName || 'Survivor');
    }, 1000);
  };

  const handleCreateRoom = () => {
    const newRoomId = Math.floor(100000 + Math.random() * 900000).toString();
    setMenuState('connecting');
    setStatusText('正在空投至目标区域...');
    setTimeout(() => {
      onJoinRoom(newRoomId, playerName || 'Survivor');
    }, 1000);
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-zinc-900 text-white font-sans">
      <div className="max-w-md w-full p-8 bg-zinc-800 rounded-2xl shadow-2xl border border-zinc-700">
        <h1 className="text-4xl font-black text-center mb-8 tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">
          BATTLE ROYALE
        </h1>

        <div className="mb-6">
          <label className="block text-sm font-medium text-zinc-400 mb-2">玩家昵称</label>
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="输入你的名字..."
            className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl focus:outline-none focus:border-yellow-500 transition-colors"
          />
        </div>

        {menuState === 'main' && (
          <div className="space-y-4">
            <button
              onClick={() => setMenuState('quick')}
              className="w-full py-4 bg-yellow-500 hover:bg-yellow-400 text-zinc-900 font-bold rounded-xl text-xl transition-transform hover:scale-105 active:scale-95"
            >
              开始搜索 (START)
            </button>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setMenuState('room')}
                className="py-3 bg-zinc-700 hover:bg-zinc-600 font-semibold rounded-xl transition-colors"
              >
                创建房间
              </button>
              <button
                onClick={() => setMenuState('room')}
                className="py-3 bg-zinc-700 hover:bg-zinc-600 font-semibold rounded-xl transition-colors"
              >
                加入房间
              </button>
            </div>
          </div>
        )}

        {menuState === 'quick' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <div>
              <h2 className="text-2xl font-bold mb-2">快速寻找比赛</h2>
              <p className="text-zinc-400">立即寻找当前可用的战局，与世界各地的玩家竞争。</p>
            </div>
            <button
              onClick={handleQuickPlay}
              className="w-full py-4 bg-yellow-500 hover:bg-yellow-400 text-zinc-900 font-bold rounded-xl text-xl transition-transform hover:scale-105 active:scale-95"
            >
              立即出发
            </button>
            <button
              onClick={() => setMenuState('main')}
              className="w-full py-2 text-zinc-400 hover:text-white transition-colors"
            >
              返回
            </button>
          </div>
        )}

        {menuState === 'room' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <div>
              <h2 className="text-2xl font-bold mb-2">房间联机</h2>
              <p className="text-zinc-400 text-sm mb-4">在私人房间中，你可以邀请好友共同进入大地图进行生存竞技。</p>
              
              <input
                type="text"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                placeholder="请输入 6 位房间号..."
                maxLength={6}
                className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl focus:outline-none focus:border-yellow-500 transition-colors text-center text-2xl tracking-widest font-mono"
              />
            </div>
            
            <div className="space-y-3">
              <button
                onClick={handleJoinRoom}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 font-bold rounded-xl transition-colors"
              >
                加入指定房间 (JOIN BY ID)
              </button>
              <button
                onClick={handleCreateRoom}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 font-bold rounded-xl transition-colors"
              >
                创建私人房间 (HOST PRIVATE)
              </button>
            </div>
            
            <button
              onClick={() => setMenuState('main')}
              className="w-full py-2 text-zinc-400 hover:text-white transition-colors"
            >
              返回
            </button>
          </div>
        )}

        {menuState === 'connecting' && (
          <div className="py-12 flex flex-col items-center justify-center space-y-6 animate-in fade-in">
            <div className="w-12 h-12 border-4 border-zinc-700 border-t-yellow-500 rounded-full animate-spin"></div>
            <p className="text-lg font-medium text-zinc-300 animate-pulse">{statusText}</p>
          </div>
        )}
      </div>
    </div>
  );
}
