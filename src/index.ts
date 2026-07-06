// Chess Forge Server — Bot + Matchmaking
// Cloudflare Worker com Durable Objects para salas

export interface Env {
	MATCHES: DurableObjectNamespace;
}

// ═════════════════════════════════════════════════════════════════
// BOT ENGINE (igual ao anterior)
// ═════════════════════════════════════════════════════════════════

const PIECE_VALUES: Record<string, number> = {
	pawn: 100, knight: 300, bishop: 300, rook: 500, queen: 900, king: 20000,
	warrior: 180, catapult: 420, mage: 320, sniper: 430, princess: 700,
	carrier: 380, spytower: 380, ram: 280, siren: 750, peasant: 130
};

const PIECE_ABBREV: Record<string, string> = {
	pawn: "P", knight: "N", bishop: "B", rook: "R", queen: "Q", king: "K",
	warrior: "W", catapult: "C", mage: "M", sniper: "S", princess: "F",
	carrier: "V", ram: "D", siren: "E", peasant: "A", spytower: "T"
};

interface Vec2 { x: number; y: number; }
function Vec2(x: number, y: number): Vec2 { return { x, y }; }

interface Piece { color: string; raw: string; }
interface Move { from: Vec2; to: Vec2; }

function cloneBoard(bd: (Piece | null)[][]): (Piece | null)[][] {
	return bd.map(row => [...row]);
}

function inBounds(v: Vec2): boolean {
	return v.x >= 0 && v.x < 8 && v.y >= 0 && v.y < 8;
}

function fenToBoard(fen: string): { board: (Piece | null)[][]; turn: string } {
	const parts = fen.split(" ");
	const rows = parts[0].split("/");
	const board: (Piece | null)[][] = Array(8).fill(null).map(() => Array(8).fill(null));
	
	const abbrevToPiece: Record<string, string> = {};
	for (const [name, abbr] of Object.entries(PIECE_ABBREV)) {
		abbrevToPiece[abbr.toUpperCase()] = name;
		abbrevToPiece[abbr.toLowerCase()] = name;
	}
	
	for (let y = 0; y < 8; y++) {
		let x = 0;
		for (const char of rows[y]) {
			if (char >= '1' && char <= '8') {
				x += parseInt(char);
			} else {
				const raw = abbrevToPiece[char];
				const color = char === char.toUpperCase() ? "white" : "black";
				board[x][y] = { color, raw };
				x++;
			}
		}
	}
	
	return { board, turn: parts[1] === "w" ? "white" : "black" };
}

function boardToFen(bd: (Piece | null)[][], turn: string): string {
	let fen = "";
	for (let y = 0; y < 8; y++) {
		let empty = 0;
		for (let x = 0; x < 8; x++) {
			const p = bd[x][y];
			if (!p) {
				empty++;
			} else {
				if (empty > 0) { fen += empty; empty = 0; }
				const c = p.color === "white" ? PIECE_ABBREV[p.raw].toUpperCase() : PIECE_ABBREV[p.raw].toLowerCase();
				fen += c;
			}
		}
		if (empty > 0) fen += empty;
		if (y < 7) fen += "/";
	}
	fen += ` ${turn[0]} - - 0 1`;
	return fen;
}

// ── GERAÇÃO DE MOVIMENTOS ──
const ORTHO = [Vec2(1,0), Vec2(-1,0), Vec2(0,1), Vec2(0,-1)];
const DIAG = [Vec2(1,1), Vec2(-1,1), Vec2(1,-1), Vec2(-1,-1)];
const RADIAL = [...ORTHO, ...DIAG];
const KNIGHT_DIRS = [
	Vec2(1,2), Vec2(2,1), Vec2(-1,2), Vec2(-2,1),
	Vec2(1,-2), Vec2(2,-1), Vec2(-1,-2), Vec2(-2,-1)
];

function getDirections(raw: string, color: string): Vec2[] {
	switch (raw) {
		case "rook": return ORTHO;
		case "bishop": return DIAG;
		case "queen": return RADIAL;
		case "king": return RADIAL;
		case "knight": return KNIGHT_DIRS;
		case "catapult": return ORTHO.map(d => Vec2(d.x * 2, d.y * 2));
		case "warrior":
			return color === "white" 
				? [Vec2(1, -1), Vec2(-1, -1)]
				: [Vec2(1, 1), Vec2(-1, 1)];
		case "mage": return DIAG.map(d => Vec2(d.x * 2, d.y * 2));
		case "princess": return [...ORTHO, ...KNIGHT_DIRS];
		case "carrier": return [
			Vec2(2, 3), Vec2(3, 2), Vec2(-2, 3), Vec2(-3, 2),
			Vec2(2, -3), Vec2(3, -2), Vec2(-2, -3), Vec2(-3, -2)
		];
		case "sniper":
			return color === "white"
				? [Vec2(0, -1), Vec2(1, -1), Vec2(-1, -1)]
				: [Vec2(0, 1), Vec2(1, 1), Vec2(-1, 1)];
		case "siren": return RADIAL;
		case "ram": return [];
		default: return [];
	}
}

function getMaxSteps(raw: string): number {
	switch (raw) {
		case "rook": case "bishop": case "queen": return 8;
		case "king": case "knight": case "catapult": case "warrior":
		case "mage": case "princess": case "carrier": case "sniper":
		case "siren": return 1;
		default: return 1;
	}
}

function canJump(raw: string): boolean {
	return ["knight", "mage", "carrier"].includes(raw);
}

function canSlide(raw: string): boolean {
	return ["rook", "bishop", "queen", "princess"].includes(raw);
}

function generateMoves(bd: (Piece | null)[][], color: string): Move[] {
	const moves: Move[] = [];
	for (let x = 0; x < 8; x++) {
		for (let y = 0; y < 8; y++) {
			const p = bd[x][y];
			if (!p || p.color !== color) continue;
			const from = Vec2(x, y);
			const raw = p.raw;
			
			if (raw === "peasant") {
				const targetRank = color === "white" ? 2 : 5;
				for (let tx = 0; tx < 8; tx++) {
					const to = Vec2(tx, targetRank);
					if (!bd[to.x][to.y]) moves.push({ from, to });
				}
				const dir = color === "white" ? -1 : 1;
				for (const dx of [-1, 0, 1]) {
					const to = Vec2(from.x + dx, from.y + dir);
					if (!inBounds(to)) continue;
					const t = bd[to.x][to.y];
					if (t && t.color !== color) moves.push({ from, to });
				}
				continue;
			}
			
			if (raw === "spytower") continue;
			
			if (raw === "ram") {
				for (let tx = 0; tx < 8; tx++) {
					for (let ty = 0; ty < 8; ty++) {
						const to = Vec2(tx, ty);
						if (to.x === from.x && to.y === from.y) continue;
						const t = bd[to.x][to.y];
						if (t && t.color !== color) moves.push({ from, to });
					}
				}
				continue;
			}
			
			const dirs = getDirections(raw, color);
			for (const dir of dirs) {
				for (let step = 1; step <= getMaxSteps(raw); step++) {
					const to = Vec2(from.x + dir.x * step, from.y + dir.y * step);
					if (!inBounds(to)) break;
					const target = bd[to.x][to.y];
					if (target) {
						if (target.color !== color) moves.push({ from, to });
						if (!canJump(raw)) break;
					} else {
						moves.push({ from, to });
						if (!canSlide(raw)) break;
					}
				}
			}
			
			if (raw === "sniper") {
				for (const dir of [Vec2(3, 3), Vec2(3, -3), Vec2(-3, 3), Vec2(-3, -3)]) {
					const to = Vec2(from.x + dir.x, from.y + dir.y);
					if (!inBounds(to)) continue;
					const t = bd[to.x][to.y];
					if (t && t.color !== color) moves.push({ from, to });
				}
			}
		}
	}
	return moves;
}

function simulateMove(bd: (Piece | null)[][], from: Vec2, to: Vec2): (Piece | null)[][] {
	const sim = cloneBoard(bd);
	const moving = sim[from.x][from.y];
	if (!moving) return sim;
	const raw = moving.raw;
	const color = moving.color;
	const target = sim[to.x][to.y];
	
	if (raw === "ram" && target) {
		const dir = Vec2(Math.sign(to.x - from.x), Math.sign(to.y - from.y));
		const pushTo = Vec2(to.x + dir.x * 2, to.y + dir.y * 2);
		if (inBounds(pushTo) && !sim[pushTo.x][pushTo.y]) {
			sim[pushTo.x][pushTo.y] = target;
		}
		sim[to.x][to.y] = moving;
		sim[from.x][from.y] = null;
		return sim;
	}
	
	if (raw === "siren" && target) {
		const dir = Vec2(Math.sign(to.x - from.x), Math.sign(to.y - from.y));
		const pullTo = Vec2(from.x + dir.x, from.y + dir.y);
		if (inBounds(pullTo) && !sim[pullTo.x][pullTo.y]) {
			sim[pullTo.x][pullTo.y] = target;
			sim[to.x][to.y] = null;
		}
		sim[to.x][to.y] = moving;
		sim[from.x][from.y] = null;
		return sim;
	}
	
	sim[to.x][to.y] = moving;
	sim[from.x][from.y] = null;
	return sim;
}

function evaluate(bd: (Piece | null)[][], turn: string): number {
	let score = 0;
	for (let x = 0; x < 8; x++) {
		for (let y = 0; y < 8; y++) {
			const p = bd[x][y];
			if (!p) continue;
			const v = PIECE_VALUES[p.raw] || 100;
			const pst = getPST(p.raw, x, y, p.color);
			if (p.color === "white") score += v + pst;
			else score -= v + pst;
		}
	}
	return turn === "white" ? score : -score;
}

function getPST(raw: string, x: number, y: number, color: string): number {
	const fy = color === "white" ? y : (7 - y);
	const cx = Math.abs(x - 3.5);
	const cy = Math.abs(y - 3.5);
	const dist = cx + cy;
	const center = (7 - dist) * 2;
	switch (raw) {
		case "pawn": case "warrior": case "peasant": return fy * 10 + center * 0.6;
		case "knight": case "carrier": return center * 4.5;
		case "bishop": case "mage": case "sniper": return center * 2 + (x > 1 && x < 6 ? 3 : 0);
		case "rook": case "catapult": case "spytower": case "ram": return (fy >= 5 ? 8 : fy >= 4 ? 3 : 0) + center * 0.8;
		case "queen": case "princess": case "siren": return center * 1.2;
		case "king": return center * 2.5;
		default: return 0;
	}
}

function orderScore(m: Move, bd: (Piece | null)[][]): number {
	let score = 0;
	const target = bd[m.to.x][m.to.y];
	const raw = bd[m.from.x][m.from.y]?.raw || "";
	if (target) {
		const victim = PIECE_VALUES[target.raw] || 0;
		const attacker = PIECE_VALUES[raw] || 0;
		score += 1000000 + victim * 100 - attacker;
	}
	if (["pawn", "warrior", "peasant"].includes(raw) && (m.to.y === 0 || m.to.y === 7)) {
		score += 500000;
	}
	return score;
}

function isKingInCheck(bd: (Piece | null)[][], color: string): boolean {
	let kingPos: Vec2 | null = null;
	for (let x = 0; x < 8; x++) {
		for (let y = 0; y < 8; y++) {
			const p = bd[x][y];
			if (p && p.raw === "king" && p.color === color) {
				kingPos = Vec2(x, y); break;
			}
		}
		if (kingPos) break;
	}
	if (!kingPos) return false;
	const opp = color === "white" ? "black" : "white";
	const oppMoves = generateMoves(bd, opp);
	for (const m of oppMoves) {
		if (m.to.x === kingPos.x && m.to.y === kingPos.y) return true;
	}
	return false;
}

function getLegalMoves(bd: (Piece | null)[][], color: string): Move[] {
	const all = generateMoves(bd, color);
	const legal: Move[] = [];
	for (const m of all) {
		const sim = simulateMove(bd, m.from, m.to);
		if (!isKingInCheck(sim, color)) legal.push(m);
	}
	return legal;
}

function quiescence(bd: (Piece | null)[][], turn: string, alpha: number, beta: number, depth: number, startTime: number, timeLimit: number): number {
	if (Date.now() - startTime > timeLimit) return evaluate(bd, turn);
	if (depth <= 0) return evaluate(bd, turn);
	const stand = evaluate(bd, turn);
	if (stand >= beta) return beta;
	if (alpha < stand) alpha = stand;
	const moves = getLegalMoves(bd, turn).filter(m => bd[m.to.x][m.to.y]);
	if (moves.length === 0) return stand;
	moves.sort((a, b) => orderScore(b, bd) - orderScore(a, bd));
	const nxt = turn === "white" ? "black" : "white";
	for (const m of moves) {
		const nb = simulateMove(bd, m.from, m.to);
		const sc = -quiescence(nb, nxt, -beta, -alpha, depth - 1, startTime, timeLimit);
		if (sc >= beta) return beta;
		if (sc > alpha) alpha = sc;
	}
	return alpha;
}

function alphabeta(bd: (Piece | null)[][], turn: string, depth: number, alpha: number, beta: number, startTime: number, timeLimit: number): number {
	if (Date.now() - startTime > timeLimit) return evaluate(bd, turn);
	if (depth <= 0) return quiescence(bd, turn, alpha, beta, 2, startTime, timeLimit);
	const moves = getLegalMoves(bd, turn);
	if (moves.length === 0) {
		if (isKingInCheck(bd, turn)) return -999999 + (10 - depth);
		return 0;
	}
	moves.sort((a, b) => orderScore(b, bd) - orderScore(a, bd));
	const nxt = turn === "white" ? "black" : "white";
	for (const m of moves) {
		const nb = simulateMove(bd, m.from, m.to);
		const sc = -alphabeta(nb, nxt, depth - 1, -beta, -alpha, startTime, timeLimit);
		if (sc > alpha) alpha = sc;
		if (alpha >= beta) break;
	}
	return alpha;
}

function iterativeDeepening(bd: (Piece | null)[][], turn: string, timeLimit: number, maxDepth: number): Move | null {
	const start = Date.now();
	const moves = getLegalMoves(bd, turn);
	if (moves.length === 0) return null;
	moves.sort((a, b) => orderScore(b, bd) - orderScore(a, bd));
	let bestMove = moves[0];
	for (let d = 1; d <= maxDepth; d++) {
		if (Date.now() - start > timeLimit) break;
		let localBest = -9999999;
		let localMove = bestMove;
		const nxt = turn === "white" ? "black" : "white";
		for (let i = 0; i < moves.length; i++) {
			const m = moves[i];
			const nb = simulateMove(bd, m.from, m.to);
			const sc = -alphabeta(nb, nxt, d - 1, -9999999, -localBest, start, timeLimit);
			if (Date.now() - start > timeLimit) break;
			if (sc > localBest) {
				localBest = sc;
				localMove = m;
				if (i > 0) {
					moves.splice(i, 1);
					moves.unshift(m);
				}
			}
		}
		if (Date.now() - start <= timeLimit) bestMove = localMove;
		if (localBest >= 999990) break;
	}
	return bestMove;
}

// ═════════════════════════════════════════════════════════════════
// MATCHMAKING (Random Match)
// Usa Durable Objects para salas persistentes
// ═════════════════════════════════════════════════════════════════

interface Player {
	id: string;
	deck: string[][];
	ready: boolean;
}

interface GameRoom {
	player1: Player | null;
	player2: Player | null;
	started: boolean;
	board: any;
	turn: string;
}

export class MatchDurableObject {
	state: DurableObjectState;
	players: Map<string, WebSocket>;
	room: GameRoom;

	constructor(state: DurableObjectState) {
		this.state = state;
		this.players = new Map();
		this.room = {
			player1: null,
			player2: null,
			started: false,
			board: null,
			turn: "white"
		};
	}

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		
		if (url.pathname === "/ws") {
			const upgradeHeader = request.headers.get("Upgrade");
			if (upgradeHeader !== "websocket") {
				return new Response("Expected websocket", { status: 400 });
			}
			
			const [client, server] = Object.values(new WebSocketPair());
			await this.handleWebSocket(server);
			
			return new Response(null, {
				status: 101,
				webSocket: client
			});
		}
		
		return new Response("Not found", { status: 404 });
	}

	async handleWebSocket(ws: WebSocket) {
		ws.accept();
		const playerId = crypto.randomUUID();
		this.players.set(playerId, ws);
		
		ws.addEventListener("message", async (msg) => {
			try {
				const data = JSON.parse(msg.data as string);
				await this.handleMessage(playerId, data, ws);
			} catch (e) {
				ws.send(JSON.stringify({ type: "error", message: String(e) }));
			}
		});
		
		ws.addEventListener("close", () => {
			this.players.delete(playerId);
			// Notificar oponente
			for (const [pid, socket] of this.players) {
				if (pid !== playerId) {
					socket.send(JSON.stringify({ type: "opponent_disconnected" }));
				}
			}
		});
	}

	async handleMessage(playerId: string, data: any, ws: WebSocket) {
		switch (data.type) {
			case "join":
				await this.handleJoin(playerId, data, ws);
				break;
			case "deck":
				await this.handleDeck(playerId, data);
				break;
			case "move":
				await this.handleMove(playerId, data);
				break;
			case "resign":
				await this.handleResign(playerId);
				break;
			case "promotion":
				await this.handlePromotion(playerId, data);
				break;
		}
	}

	async handleJoin(playerId: string, data: any, ws: WebSocket) {
		if (!this.room.player1) {
			this.room.player1 = { id: playerId, deck: data.deck, ready: false };
			ws.send(JSON.stringify({ type: "role", role: "waiting" }));
		} else if (!this.room.player2) {
			this.room.player2 = { id: playerId, deck: data.deck, ready: false };
			ws.send(JSON.stringify({ type: "role", role: "client" }));
			// Notificar P1 que P2 entrou
			const p1ws = this.players.get(this.room.player1.id);
			if (p1ws) {
				p1ws.send(JSON.stringify({ type: "role", role: "host" }));
			}
		} else {
			ws.send(JSON.stringify({ type: "error", message: "Room full" }));
		}
	}

	async handleDeck(playerId: string, data: any) {
		const isP1 = this.room.player1?.id === playerId;
		const isP2 = this.room.player2?.id === playerId;
		
		if (isP1) this.room.player1!.deck = data.deck;
		if (isP2) this.room.player2!.deck = data.deck;
		
		// Se ambos enviaram deck, iniciar jogo
		if (this.room.player1?.deck && this.room.player2?.deck && !this.room.started) {
			this.room.started = true;
			const board = this.initializeBoard();
			this.room.board = board;
			
			// Enviar board para ambos
			for (const [pid, ws] of this.players) {
				ws.send(JSON.stringify({ type: "start_game", board, color: pid === this.room.player1!.id ? "white" : "black" }));
			}
		}
	}

	initializeBoard(): any {
		// Board padrão — você pode customizar com os decks
		const board: any = [];
		for (let x = 0; x < 8; x++) {
			board[x] = [];
			for (let y = 0; y < 8; y++) board[x][y] = null;
		}
		
		// Peças pretas (padrão)
		const blackBack = ["rook", "knight", "bishop", "queen", "king", "bishop", "knight", "rook"];
		const blackFront = ["pawn", "pawn", "pawn", "pawn", "pawn", "pawn", "pawn", "pawn"];
		for (let x = 0; x < 8; x++) {
			board[x][0] = "black_" + blackBack[x];
			board[x][1] = "black_" + blackFront[x];
		}
		
		// Peças brancas (padrão)
		const whiteBack = ["rook", "knight", "bishop", "queen", "king", "bishop", "knight", "rook"];
		const whiteFront = ["pawn", "pawn", "pawn", "pawn", "pawn", "pawn", "pawn", "pawn"];
		for (let x = 0; x < 8; x++) {
			board[x][6] = "white_" + whiteFront[x];
			board[x][7] = "white_" + whiteBack[x];
		}
		
		return board;
	}

	async handleMove(playerId: string, data: any) {
		// Broadcast para oponente
		for (const [pid, ws] of this.players) {
			if (pid !== playerId) {
				ws.send(JSON.stringify({
					type: "move",
					from: data.from,
					to: data.to,
					color: data.color
				}));
			}
		}
	}

	async handleResign(playerId: string) {
		for (const [pid, ws] of this.players) {
			if (pid !== playerId) {
				ws.send(JSON.stringify({ type: "resign", color: pid === this.room.player1!.id ? "white" : "black" }));
			}
		}
	}

	async handlePromotion(playerId: string, data: any) {
		for (const [pid, ws] of this.players) {
			if (pid !== playerId) {
				ws.send(JSON.stringify({
					type: "promotion",
					color: data.color,
					piece: data.piece,
					pos: data.pos
				}));
			}
		}
	}
}

// ═════════════════════════════════════════════════════════════════
// ROUTER PRINCIPAL
// ═════════════════════════════════════════════════════════════════

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);
		const corsHeaders = {
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "POST, GET, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type",
		};

		if (request.method === "OPTIONS") {
			return new Response(null, { headers: corsHeaders });
		}

		// ── BOT ENDPOINT ──
		if (url.pathname === "/bot" || url.pathname === "/") {
			if (request.method !== "POST") {
				return new Response(JSON.stringify({ error: "Use POST" }), {
					status: 405,
					headers: { ...corsHeaders, "Content-Type": "application/json" }
				});
			}

			try {
				const body = await request.json() as any;
				const { fen, rating = 1500, time_ms = 200 } = body;

				if (!fen) {
					return new Response(JSON.stringify({ error: "FEN required" }), {
						status: 400,
						headers: { ...corsHeaders, "Content-Type": "application/json" }
					});
				}

				const { board, turn } = fenToBoard(fen);
				const maxDepth = rating <= 250 ? 1 : rating <= 800 ? 2 : rating <= 1500 ? 3 : 4;
				const actualTime = Math.min(time_ms, rating <= 250 ? 60 : rating <= 800 ? 120 : rating <= 1500 ? 200 : 350);

				const bestMove = iterativeDeepening(board, turn, actualTime, maxDepth);

				if (!bestMove) {
					return new Response(JSON.stringify({ error: "No legal moves" }), {
						status: 400,
						headers: { ...corsHeaders, "Content-Type": "application/json" }
					});
				}

				const result = {
					from: String.fromCharCode(97 + bestMove.from.x) + (8 - bestMove.from.y),
					to: String.fromCharCode(97 + bestMove.to.x) + (8 - bestMove.to.y),
					fen: boardToFen(simulateMove(board, bestMove.from, bestMove.to), turn === "white" ? "black" : "white"),
					eval: evaluate(board, turn)
				};

				return new Response(JSON.stringify(result), {
					headers: { ...corsHeaders, "Content-Type": "application/json" }
				});

			} catch (e) {
				return new Response(JSON.stringify({ error: String(e) }), {
					status: 500,
					headers: { ...corsHeaders, "Content-Type": "application/json" }
				});
			}
		}

		// ── MATCHMAKING ENDPOINT ──
		if (url.pathname === "/match") {
			// Cria ou conecta a uma sala
			const roomId = url.searchParams.get("room") || "default";
			const id = env.MATCHES.idFromName(roomId);
			const room = env.MATCHES.get(id);
			return room.fetch(request);
		}

		// ── STATUS ──
		if (url.pathname === "/status") {
			return new Response(JSON.stringify({ status: "online", version: "1.0.0" }), {
				headers: { ...corsHeaders, "Content-Type": "application/json" }
			});
		}

		return new Response("Not found", { status: 404 });
	},
};
