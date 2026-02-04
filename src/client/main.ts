import { GameScene } from "./index.js";
import { io, Socket } from "socket.io-client";

// --- STATE ---
let socket: Socket;
let isLeader = false;
let myId = "";
let selectedBenchPlayer: string | null = null; 

// UI Elements
const lobbyView = document.getElementById('lobby-view')!;
const gameView = document.getElementById('game-view')!;
const slotsLeftEl = document.getElementById('slots-left')!;
const slotsRightEl = document.getElementById('slots-right')!;
const benchListEl = document.getElementById('bench-list')!;
const leaderControls = document.getElementById('leader-controls')!;
const btnStart = document.getElementById('btn-start') as HTMLButtonElement;
const leaderMsg = document.getElementById('leader-msg')!;

const game = new GameScene();

function init() {
    socket = io("http://localhost:3000"); 
    
    socket.on('connect', () => {
        console.log("Connected to Lobby");
        myId = socket.id || "";
    });

    socket.on('lobbyState', (state: any) => {
        renderLobby(state);
    });

    socket.on('gameStarted', () => {
        console.log("Game Starting...");
        lobbyView.style.display = 'none';
        gameView.style.display = 'block';
        
        const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        
        // Tenta fazer resize se o método existir
        if (typeof (game as any).resize === 'function') {
            (game as any).resize();
        } else {
            // Fallback se não tiveres adicionado o método público resize ao GameScene
            game['engine'].resize();
        }

        game.startConnection(socket); 
        console.log("Requesting Game Init...");
        socket.emit('requestGameInit');
    });

    // Global exports for HTML onclick
    (window as any).setMode = (mode: string) => socket.emit('lobby_setMode', mode);
    (window as any).startGame = () => socket.emit('lobby_start');
    
    (window as any).selectBenchPlayer = (id: string) => {
        if (!isLeader) return;
        selectedBenchPlayer = id;
        document.querySelectorAll('.bench-player').forEach(el => (el as HTMLElement).style.borderColor = 'transparent');
        const el = document.getElementById(`bench-${id}`);
        if(el) el.style.borderColor = 'cyan';
    };

    (window as any).clickSlot = (side: string, index: number, content: string) => {
        if (!isLeader) return;
        if (selectedBenchPlayer) {
            socket.emit('lobby_movePlayer', { targetId: selectedBenchPlayer, side, slotIndex: index });
            selectedBenchPlayer = null; 
            return;
        }
        if (content === 'empty') {
            socket.emit('lobby_addBot', { side, slotIndex: index });
        }
    };

    (window as any).removeBot = (side: string, index: number) => {
        socket.emit('lobby_removeBot', { side, slotIndex: index });
    };

    (window as any).changeBotLevel = (side: string, index: number, delta: number) => {
        socket.emit('lobby_botLevel', { side, slotIndex: index, delta });
    };
}

// --- RENDER LOGIC ---

function renderLobby(state: any) {
    isLeader = (state.leader === myId);
    
    // UI Updates
    leaderControls.style.display = isLeader ? 'flex' : 'none';
    leaderMsg.style.display = isLeader ? 'block' : 'none';

    // --- CORREÇÃO DO BOTÃO START ---
    // Só ative se for Leader E se o servidor disser que está tudo preenchido (isReadyToStart)
    if (isLeader && state.isReadyToStart) {
        btnStart.disabled = false;
        btnStart.innerText = "START GAME";
        btnStart.style.opacity = "1";
        btnStart.style.cursor = "pointer";
    } else {
        btnStart.disabled = true;
        btnStart.style.opacity = "0.5";
        btnStart.style.cursor = "not-allowed";
        
        if (!isLeader) btnStart.innerText = "Waiting for Leader...";
        else btnStart.innerText = "Fill all slots to start";
    }
    // -------------------------------

    renderTeamSlots(slotsLeftEl, state.slots.left, 'left');
    renderTeamSlots(slotsRightEl, state.slots.right, 'right');

    benchListEl.innerHTML = '';
    state.bench.forEach((playerId: string) => {
        const div = document.createElement('div');
        div.className = `bench-player ${playerId === myId ? 'me' : ''}`;
        div.id = `bench-${playerId}`;
        div.innerHTML = `<span>Player ${playerId.substr(0,4)}</span>`;
        if (isLeader) {
            div.onclick = () => (window as any).selectBenchPlayer(playerId);
            div.style.cursor = "pointer";
        }
        benchListEl.appendChild(div);
    });
}

function renderTeamSlots(container: HTMLElement, slots: any[], side: string) {
    container.innerHTML = '';
    slots.forEach(slot => {
        const div = document.createElement('div');
        div.className = `slot ${slot.content}`;
        
        if (slot.content === 'empty') {
            div.innerHTML = `<span>[ Empty Slot ]</span>`;
            if (isLeader) div.onclick = () => (window as any).clickSlot(side, slot.index, 'empty');
        } 
        else if (slot.content === 'human') {
            div.innerHTML = `
                <span>👤 ${slot.playerName}</span>
                ${isLeader ? `<button class="mini" onclick="selectBenchPlayer('${slot.socketId}')">To Bench</button>` : ''} 
            `;
        } 
        else if (slot.content === 'bot') {
            div.innerHTML = `
                <span>🤖 Bot Lvl ${slot.botLevel}</span>
                ${isLeader ? `
                    <div class="slot-actions">
                        <button class="mini" onclick="changeBotLevel('${side}', ${slot.index}, -1)">-</button>
                        <button class="mini" onclick="changeBotLevel('${side}', ${slot.index}, 1)">+</button>
                        <button class="mini" style="background:red" onclick="removeBot('${side}', ${slot.index})">X</button>
                    </div>
                ` : ''}
            `;
            if (isLeader) div.onclick = (e) => {
                if((e.target as HTMLElement).tagName === 'BUTTON') return;
                (window as any).clickSlot(side, slot.index, 'bot');
            };
        }

        container.appendChild(div);
    });
}

init();