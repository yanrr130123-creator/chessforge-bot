
// Chess Forge Bot Engine - Cloudflare Worker
// Port do minimax GDScript para TypeScript

export interface Env {}

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

function getPieceColor(type: string | null): string {
	if (!type) return "";
	if (type.startsWith("white")) return "white";
	if (type.startsWith("black")) return "black";
	return "";
}

function rawName(type: string | null): string {
	if (!type) return "";
	const parts = type.split("_");
	return parts.length > 1 ? parts[1] : type;
}

function inBounds(v: Vec2): boolean {
	return v.x >= 0 && v.x < 8 && v.y >= 0 && v.y < 8;
}

// ═════════════════════════════════════════════════════════════════
// FEN CUSTOM
// ═════════════════════════════════════════════════════════════════

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

// ═════════════════════════════════════════════════════════════════
// GERAÇÃO DE MOVIMENTOS
// ═════════════════════════════════════════════════════════════════

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
			
			// Peasant: target squares específicos
			if (raw === "peasant") {
				const targetRank = color === "white" ? 2 : 5;
				for (let tx = 0; tx < 8; tx++) {
					const to = Vec2(tx, targetRank);
					if (isValidMove(bd, from, to, color)) moves.push({ from, to });
				}
				// Capturas
				const dir = color === "white" ? -1 : 1;
				for (const dx of [-1, 0, 1]) {
					const to = Vec2(from.x + dx, from.y + dir);
					if (!inBounds(to)) continue;
					const t = bd[to.x][to.y];
					if (t && t.color !== color) moves.push({ from, to });
				}
				continue;
			}
			
			// Spy Tower: não se move
			if (raw === "spytower") continue;
			
			// Ram: qualquer casa ocupada por inimigo
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
			
			// Direções normais
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
			
			// Ranged captures
			if (raw === "sniper") {
				for (const dir of [Vec2(3, 3), Vec2(3, -3), Vec2(-3, 3), Vec2(-3, -3)]) {
					const to = Vec2(from.x + dir.x, from.y + dir.y);
					if (!inBounds(to)) continue;
					const t = bd[to.x][to.y];
					if (t && t.color !== color) moves.push({ from, to });
				}
			}
			
			if (raw === "spytower") {
				const dir = color === "white" ? -1 : 1;
				for (const d of [Vec2(0, dir * 3), Vec2(1, dir * 2), Vec2(-1, dir * 2)]) {
					const to = Vec2(from.x + d.x, from.y + d.y);
					if (!inBounds(to)) continue;
					const t = bd[to.x][to.y];
					if (t && t.color !== color) moves.push({ from, to });
				}
			}
		}
	}
	
	return moves;
}

function isValidMove(bd: (Piece | null)[][], from: Vec2, to: Vec2, color: string): boolean {
	const target = bd[to.x][to.y];
	if (target && target.color === color) return false;
	return true;
}

// ═════════════════════════════════════════════════════════════════
// SIMULAÇÃO COM EFEITOS
// ═════════════════════════════════════════════════════════════════

function simulateMove(bd: (Piece | null)[][], from: Vec2, to: Vec2): (Piece | null)[][] {
	const sim = cloneBoard(bd);
	const moving = sim[from.x][from.y];
	if (!moving) return sim;
	
	const raw = moving.raw;
	const color = moving.color;
	const target = sim[to.x][to.y];
	
	// Ram: push
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
	
	// Siren: pull
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
	
	// Movimento normal
	sim[to.x][to.y] = moving;
	sim[from.x][from.y] = null;
	
	return sim;
}

// ═════════════════════════════════════════════════════════════════
// AVALIAÇÃO
// ═════════════════════════════════════════════════════════════════

function evaluate(bd: (Piece | null)[][], turn: string): number {
	let score = 0;
	
	for (let x = 0; x < 8; x++) {
		for (let y = 0; y < 8; y++) {
			const p = bd[x][y];
			if (!p) continue;
			
			const v = PIECE_VALUES[p.raw] || 100;
			const pst = getPST(p.raw, x, y, p.color);
			
			if (p.color === "white") {
				score += v + pst;
			} else {
				score -= v + pst;
			}
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
		case "pawn": case "warrior": case "peasant":
			return fy * 10 + center * 0.6;
		case "knight": case "carrier":
			return center * 4.5;
		case "bishop": case "mage": case "sniper":
			return center * 2 + (x > 1 && x < 6 ? 3 : 0);
		case "rook": case "catapult": case "spytower": case "ram":
			return (fy >= 5 ? 8 : fy >= 4 ? 3 : 0) + center * 0.8;
		case "queen": case "princess": case "siren":
			return center * 1.2;
		case "king":
			return center * 2.5;
		default:
			return 0;
	}
}

// ═════════════════════════════════════════════════════════════════
// MINIMAX + ALPHA-BETA
// ═════════════════════════════════════════════════════════════════

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
				kingPos = Vec2(x, y);
				break;
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

function hasLegalMoves(bd: (Piece | null)[][], color: string): boolean {
	const moves = generateMoves(bd, color);
	for (const m of moves) {
		const sim = simulateMove(bd, m.from, m.to);
		if (!isKingInCheck(sim, color)) return true;
	}
	return false;
}

function quiescence(bd: (Piece | null)[][], turn: string, alpha: number, beta: number, depth: number, startTime: number, timeLimit: number): number {
	if (Date.now() - startTime > timeLimit) return evaluate(bd, turn);
	if (depth <= 0) return evaluate(bd, turn);
	
	const stand = evaluate(bd, turn);
	if (stand >= beta) return beta;
	if (alpha < stand) alpha = stand;
	
	const moves = generateMoves(bd, turn).filter(m => bd[m.to.x][m.to.y]);
	if (moves.length === 0) return stand;
	
	moves.sort((a, b) => orderScore(b, bd) - orderScore(a, bd));
	
	const nxt = turn === "white" ? "black" : "white";
	for (const m of moves) {
		const nb = simulateMove(bd, m.from, m.to);
		if (isKingInCheck(nb, turn)) continue;
		const sc = -quiescence(nb, nxt, -beta, -alpha, depth - 1, startTime, timeLimit);
		if (sc >= beta) return beta;
		if (sc > alpha) alpha = sc;
	}
	
	return alpha;
}

function alphabeta(bd: (Piece | null)[][], turn: string, depth: number, alpha: number, beta: number, startTime: number, timeLimit: number): number {
	if (Date.now() - startTime > timeLimit) return evaluate(bd, turn);
	if (depth <= 0) return quiescence(bd, turn, alpha, beta, 2, startTime, timeLimit);
	
	const allMoves = generateMoves(bd, turn);
	const moves: Move[] = [];
	for (const m of allMoves) {
		const sim = simulateMove(bd, m.from, m.to);
		if (!isKingInCheck(sim, turn)) moves.push(m);
	}
	
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
	const allMoves = generateMoves(bd, turn);
	const moves: Move[] = [];
	for (const m of allMoves) {
		const sim = simulateMove(bd, m.from, m.to);
		if (!isKingInCheck(sim, turn)) moves.push(m);
	}
	
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
		
		if (Date.now() - start <= timeLimit) {
			bestMove = localMove;
		}
		
		if (localBest >= 999990) break;
	}
	
	return bestMove;
}

// ═════════════════════════════════════════════════════════════════
// HANDLER
// ═════════════════════════════════════════════════════════════════

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const corsHeaders = {
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "POST, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type",
		};
		
		if (request.method === "OPTIONS") {
			return new Response(null, { headers: corsHeaders });
		}
		
		if (request.method !== "POST") {
			return new Response(JSON.stringify({ error: "Use POST" }), {
				status: 405,
				headers: { ...corsHeaders, "Content-Type": "application/json" }
			});
		}
		
		try {
			const body = await request.json() as {
				fen: string;
				depth?: number;
				time_ms?: number;
				rating?: number;
			};
			
			const { fen, depth = 3, time_ms = 200, rating = 1500 } = body;
			
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
	},
};
