import { GameScene } from "./index.js";
import { io, Socket } from "socket.io-client";
import { WS_URL } from "../services/RuntimeConfig";

import { escapeHtml } from "../shared/utils";
/* --- STATE --- */
let socket: Socket;
let isLeader = false;
let myId = "";
let selectedBenchPlayer: string | null = null;
let currentPowerUpsState = true;

/* --- UI ELEMENTS --- */
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
    socket = io(WS_URL);

    socket.on('connect', () => {
        console.log("Connected to Lobby");
        myId = socket.id || "";
    });

    socket.on('lobbyState', renderLobby);

    socket.on('gameStarted', () => {
        console.log("Game Starting...");
        lobbyView.style.display = 'none';
        gameView.style.display = 'block';

        // Force canvas resize
        const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        // Resize Engine (Support custom method or direct engine access)
        if (typeof (game as any).resize === 'function') (game as any).resize();
        else if (game['engine']) game['engine'].resize();

        game.startConnection(socket);
        console.log("Requesting Game Init...");
        socket.emit('requestGameInit');
    });

    /* --- HTML BINDINGS --- */
    const w = window as any;
    w.setMode = (m: string) => socket.emit('lobby_setMode', m);
    w.startGame = () => socket.emit('lobby_start');
    w.setDuration = (d: string) => socket.emit('lobby_setDuration', d);
    w.togglePowerUps = () => socket.emit('lobby_setPowerUps', !currentPowerUpsState);

    w.selectBenchPlayer = (id: string) => {
        if (!isLeader) return;
        selectedBenchPlayer = id;
        document.querySelectorAll('.bench-player').forEach(el => (el as HTMLElement).style.borderColor = 'transparent');
        const el = document.getElementById(`bench-${id}`);
        if (el) el.style.borderColor = 'cyan';
    };

    w.moveToBench = (id: string) => {
        if (!isLeader) return;
        socket.emit('lobby_moveToBench', id);
        if (selectedBenchPlayer === id) selectedBenchPlayer = null;
    };

    w.clickSlot = (side: string, idx: number, content: string) => {
        if (!isLeader) return;
        if (selectedBenchPlayer) {
            socket.emit('lobby_movePlayer', { targetId: selectedBenchPlayer, side, slotIndex: idx });
            selectedBenchPlayer = null;
        } else if (content === 'empty') {
            socket.emit('lobby_addBot', { side, slotIndex: idx });
        }
    };

    w.removeBot = (side: string, idx: number) => socket.emit('lobby_removeBot', { side, slotIndex: idx });
    w.changeBotLevel = (side: string, idx: number, delta: number) => socket.emit('lobby_botLevel', { side, slotIndex: idx, delta });
}

/* --- RENDER LOGIC --- */

function renderLobby(state: any) {
    isLeader = (state.leader === myId);
    currentPowerUpsState = state.config.power_ups;

    // Leader Visibility
    leaderControls.style.display = isLeader ? 'flex' : 'none';
    leaderMsg.style.display = isLeader ? 'block' : 'none';

    updateButtonStates(state);

    // Start Button State
    const ready = isLeader && state.isReadyToStart;
    btnStart.disabled = !ready;
    btnStart.style.opacity = ready ? "1" : "0.5";
    btnStart.style.cursor = ready ? "pointer" : "not-allowed";
    btnStart.innerText = isLeader
        ? (ready ? "START GAME" : "Fill all slots to start")
        : "Waiting for Leader...";

    // Render Lists
    renderTeamSlots(slotsLeftEl, state.slots.left, 'left');
    renderTeamSlots(slotsRightEl, state.slots.right, 'right');
    renderBench(state.bench);
}

function renderBench(bench: string[]) {
    benchListEl.innerHTML = '';
    bench.forEach((pid) => {
        const div = document.createElement('div');
        div.className = `bench-player ${pid === myId ? 'me' : ''}`;
        div.id = `bench-${pid}`;
        div.innerHTML = `<span>Player ${pid.slice(0, 4)}</span>`;
        if (isLeader) {
            div.onclick = () => (window as any).selectBenchPlayer(pid);
            div.style.cursor = "pointer";
        }
        benchListEl.appendChild(div);
    });
}

function updateButtonStates(state: any) {
    const setBtn = (id: string, active: boolean) => {
        const btn = document.getElementById(id) as HTMLButtonElement;
        if (!btn) return;
        active ? btn.classList.add('active') : btn.classList.remove('active');
        btn.disabled = !isLeader;
        btn.style.cursor = isLeader ? 'pointer' : 'not-allowed';
        if (!isLeader) btn.style.opacity = active ? "1" : "0.3";
    };

    // Modes
    const pc = state.config.players_per_side;
    setBtn('btn-mode-1', pc === 1);
    setBtn('btn-mode-2', pc === 2);
    setBtn('btn-mode-3', pc === 3);

    // Duration
    const dl = state.config.duration_label;
    setBtn('btn-dur-fast', dl === 'fast');
    setBtn('btn-dur-normal', dl === 'normal');
    setBtn('btn-dur-long', dl === 'long');

    // Power Ups
    const puBtn = document.getElementById('btn-powerups') as HTMLButtonElement;
    if (puBtn) {
        const on = state.config.power_ups;
        puBtn.innerText = `Power Ups: ${on ? "ON" : "OFF"}`;
        puBtn.style.backgroundColor = on ? "#2e7d32" : "#c62828";
        puBtn.disabled = !isLeader;
        puBtn.style.cursor = isLeader ? 'pointer' : 'not-allowed';
    }
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
                <span>👤 ${escapeHtml(slot.playerName)}</span>
                ${isLeader ? `<button class="mini" onclick="moveToBench ('${slot.socketId}')">To Bench</button>` : ''} 
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
                    </div>` : ''}
            `;
            if (isLeader) div.onclick = (e) => {
                if ((e.target as HTMLElement).tagName === 'BUTTON') return;
                (window as any).clickSlot(side, slot.index, 'bot');
            };
        }
        container.appendChild(div);
    });
}

init();
