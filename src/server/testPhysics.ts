import { ServerBall } from "./elements/ServerBall.js";

// 1. Criar uma bola no servidor
const ball = new ServerBall(0, 0);

console.log("--- INÍCIO DA SIMULAÇÃO ---");
console.log(`Posição Inicial: X=${ball.pos.x.toFixed(2)}, Z=${ball.pos.z.toFixed(2)}`);

// 2. Simular 60 frames (1 segundo de jogo)
for (let i = 0; i < 60; i++) {
    // Simula um passo de tempo de ~16ms (0.016s)
    ball.update(0.016);
    
    // Imprime a cada 10 frames para não poluir o log
    if (i % 10 === 0) {
        console.log(`Frame ${i}: X=${ball.pos.x.toFixed(2)}, Z=${ball.pos.z.toFixed(2)}`);
    }
}

console.log("--- FIM DA SIMULAÇÃO ---");