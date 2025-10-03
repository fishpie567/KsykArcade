let animationFrame = null;
let gameState = null;

function startClicker(canvas) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const width = canvas.width = canvas.offsetWidth;
  const height = canvas.height = canvas.offsetHeight;
  gameState = {
    ctx,
    width,
    height,
    coins: [],
    score: 0,
    lastSpawn: 0,
    running: true,
  };
  canvas.addEventListener('click', handleClick);
  loop(0);
}

function handleClick(event) {
  if (!gameState?.running) return;
  const rect = event.target.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const hitIndex = gameState.coins.findIndex((coin) => {
    const dx = x - coin.x;
    const dy = y - coin.y;
    return Math.sqrt(dx * dx + dy * dy) < coin.radius;
  });
  if (hitIndex >= 0) {
    const [coin] = gameState.coins.splice(hitIndex, 1);
    gameState.score += Math.round(coin.value * 10) / 10;
    drawScore();
  }
}

function loop(timestamp) {
  if (!gameState?.running) return;
  const { ctx, width, height } = gameState;
  ctx.clearRect(0, 0, width, height);
  if (timestamp - gameState.lastSpawn > 900) {
    spawnCoin();
    gameState.lastSpawn = timestamp;
  }
  updateCoins();
  drawCoins();
  drawScore();
  animationFrame = requestAnimationFrame(loop);
}

function spawnCoin() {
  gameState.coins.push({
    x: Math.random() * (gameState.width - 60) + 30,
    y: -20,
    radius: 24,
    speed: 1 + Math.random() * 2,
    value: 0.5 + Math.random() * 2,
  });
}

function updateCoins() {
  gameState.coins.forEach((coin) => {
    coin.y += coin.speed;
  });
  gameState.coins = gameState.coins.filter((coin) => coin.y < gameState.height + coin.radius);
}

function drawCoins() {
  const { ctx } = gameState;
  gameState.coins.forEach((coin) => {
    ctx.beginPath();
    ctx.arc(coin.x, coin.y, coin.radius, 0, Math.PI * 2);
    const gradient = ctx.createRadialGradient(coin.x - 10, coin.y - 10, 10, coin.x, coin.y, coin.radius);
    gradient.addColorStop(0, '#facc15');
    gradient.addColorStop(1, '#f97316');
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 20px Inter';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('€', coin.x, coin.y);
  });
}

function drawScore() {
  const { ctx } = gameState;
  ctx.save();
  ctx.fillStyle = 'rgba(15,23,42,0.6)';
  ctx.fillRect(10, 10, 140, 40);
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 18px Inter';
  ctx.fillText(`Score: €${gameState.score.toFixed(1)}`, 20, 36);
  ctx.restore();
}

function stopClicker(canvas) {
  if (animationFrame) cancelAnimationFrame(animationFrame);
  animationFrame = null;
  if (canvas) {
    canvas.removeEventListener('click', handleClick);
  }
  gameState = null;
}

export { startClicker, stopClicker };
