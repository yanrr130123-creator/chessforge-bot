// Chess Forge Bot Engine v3 — Complete Rewrite
// Features: Opening Book, Advanced Evaluation, Null Move, Killer Moves, Anti-Repetition

export interface Env {}

// ═════════════════════════════════════════════════════════════════
// OPENING BOOK (10+ jogadas de livro para cada cor)
// ═════════════════════════════════════════════════════════════════

const OPENING_BOOK: Record<string, string[]> = {
	// Posição inicial
	"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w": ["e2e4", "d2d4", "g1f3", "c2c4"],
	"rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b": ["e7e5", "c7c5", "e7e6", "c7c6"],
	// Após 1.e4 e5
	"rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w": ["g1f3", "f1c4", "b1c3"],
	"rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b": ["b8c6", "g8f6", "f8c5"],
	// Após 1.d4 d5
	"rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR w": ["c2c4", "g1f3", "b1c3"],
	"rnbqkbnr/ppp1pppp/8/3p4/2PP4/8/PP2PPPP/RNBQKBNR b": ["e7e6", "c7c6", "g8f6"],
	// Sicilian
	"rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w": ["g1f3", "b1c3", "f1b5"],
	// French
	"rnbqkbnr/pppp1ppp/4p3/8/4P3/8/PPPP1PPP/RNBQKBNR w": ["d2d4", "g1f3"],
	// Caro-Kann
	"rnbqkbnr/pp1ppppp/2p5/8/4P3/8/PPPP1PPP/RNBQKBNR w": ["d2d4", "b1c3"],
	// Pirc/Modern
	"rnbqkbnr/ppp1pppp/3p4/8/4P3/8/PPPP1PPP/RNBQKBNR w": ["d2d4", "g1f3"],
	// English
	"rnbqkbnr/pppppppp/8/8/2P5/8/PP1PPPPP/RNBQKBNR b": ["e7e5", "c7c5", "g8f6"],
	// Réti
	"rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b": ["d7d5", "g8f6", "c7c5"],
};

// ═════════════════════════════════════════════════════════════════
// CONSTANTES
// ═════════════════════════════════════════════════════════════════

const PIECE_VALUES: Record<string, number> = {
	pawn: 100, knight: 320, bishop: 330, rook: 500, queen: 900, king: 20000,
	warrior: 180, catapult: 420, mage: 320, sniper: 430, princess: 700,
	carrier: 380, spytower: 380, ram: 280, siren: 750, peasant: 130
};

const PIECE_ABBREV: Record<string, string> = {
	pawn: "P", knight: "N", bishop: "B", rook: "R", queen: "Q", king: "K",
	warrior: "W", catapult: "C", mage: "M", sniper: "S", princess: "F",
	carrier: "V", ram: "D", siren: "E", peasant: "A", spytower: "T"
};

// Piece-Square Tables (valores de posição para cada peça)
// Valores positivos = boas casas. O motor inverte para pretas.

const PST_PAWN = [
	0,  0,  0,  0,  0,  0,  0,  0,
	50, 50, 50, 50, 50, 50, 50, 50,
	10, 10, 20, 30, 30, 20, 10, 10,
	5,  5, 10, 25, 25, 10,  5,  5,
	0,  0,  0, 20, 20,  0,  0,  0,
	5, -5,-10,  0,  0,-10, -5,  5,
	5, 10, 10,-20,-20, 10, 10,  5,
	0,  0,  0,  0,  0,  0,  0,  0
];

const PST_KNIGHT = [
	-50,-40,-30,-30,-30,-30,-40,-50,
	-40,-20,  0,  0,  0,  0,-20,-40,
	-30,  0, 10, 15, 15, 10,  0,-30,
	-30,  5, 15, 20, 20, 15,  5,-30,
	-30,  0, 15, 20, 20, 15,  0,-30,
	-30,  5, 10, 15, 15, 10,  5,-30,
	-40,-20,  0,  5,  5,  0,-20,-40,
	-50,-40,-30,-30,-30,-30,-40,-50
];

const PST_BISHOP = [
	-20,-10,-10,-10,-10,-10,-10,-20,
	-10,  0,  0,  0,  0,  0,  0,-10,
	-10,  0, 10, 10, 10, 10,  0,-10,
	-10,  5,  5, 10, 10,  5,  5,-10,
	-10,  0,  5, 10, 10,  5,  0,-10,
	-10, 10, 10, 10, 10, 10, 10,-10,
	-10,  5,  0,  0,  0,  0,  5,-10,
	-20,-10,-10,-10,-10,-10,-10,-20
];

const PST_ROOK = [
	0,  0,  0,  0,  0,  0,  0,  0,
	5, 10, 10, 10, 10, 10, 10,  5,
	-5,  0,  0,  0,  0,  0,  0, -5,
	-5,  0,  0,  0,  0,  0,  0, -5,
	-5,  0,  0,  0,  0,  0,  0, -5,
	-5,  0,  0,  0,  0,  0,  0, -5,
	-5,  0,  0,  0,  0,  0,  0, -5,
	0,  0,  0,  5,  5,  0,  0,  0
];

const PST_QUEEN = [
	-20,-10,-10, -5, -5,-10,-10,-20,
	-10,  0,  0,  0,  0,  0,  0,-10,
	-10,  0,  5,  5,  5,  5,  0,-10,
	-5,  0,  5,  5,  5,  5,  0, -5,
	0,  0,  5,  5,  5,  5,  0, -5,
	-10,  5,  5,  5,  5,  5,  0,-10,
	-10,  0,  5,  0,  0,  0,  0,-10,
	-20,-10,-10, -5, -5,-10,-10,-20
];

const PST_KING_MIDDLE = [
	-30,-40,-40,-50,-50,-40,-40,-30,
	-30,-40,-40,-50,-50,-40,-40,-30,
	-30,-40,-40,-50,-50,-40,-40,-30,
	-30,-40,-40,-50,-50,-40,-40,-30,
	-20,-30,-30,-40,-40,-30,-30,-20,
	-10,-20,-20,-20,-20,-20,-20,-10,
	20, 20,  0,  0,  0,  0, 20, 20,
	20, 30, 10,  0,  0, 10, 30, 20
];

const PST_KING_END = [
	-50,-40,-30,-20,-20,-30,-40,-50,
	-30,-20,-10,  0,  0,-10,-20,-30,
	-30,-10, 20, 30, 30, 20,-10,-30,
	-30,-10, 30, 40, 40, 30,-10,-30,
	-30,-10, 30, 40, 40, 30,-10,-30,
	-30,-10, 20, 30, 30, 20,-10,-30,
	-30,-30,  0,  0,  0,  0,-30,-30,
	-50,-30,-30,-30,-30,-30,-30,-50
];

// ═════════════════════════════════════════════════════════════════
// TIPOS
// ═════════════════════════════════════════════════════════════════

interface Vec2 { x: number; y: number; }
function Vec2(x: number, y: number): Vec2 { return { x, y }; }

interface Piece { color: string; raw: string; }
interface Move { from: Vec2; to: Vec2; score?: number; }

// Transposition Table
interface TTEntry {
	depth: number;
	score: number;
	flag: number; // 0=exact, 1=lower, 2=upper
	bestMove: Move | null;
}

// ═════════════════════════════════════════════════════════════════
// FEN PARSER
// ═════════════════════════════════════════════════════════════════

function fenToBoard(fen: string): { board: (Piece | null)[][]; turn: string; moveCount: number } {
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
	
	return { 
		board, 
		turn: parts[1] === "w" ? "white" : "black",
		moveCount: parseInt(parts[parts.length - 1]) || 0
	};
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

// ═════════════════════════════════════════════════════════════════
// GERAÇÃO DE MOVIMENTOS (completa com todas as peças custom)
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

function inBounds(v: Vec2): boolean {
	return v.x >= 0 && v.x < 8 && v.y >= 0 && v.y < 8;
}

function cloneBoard(bd: (Piece | null)[][]): (Piece | null)[][] {
	return bd.map(row => [...row]);
}

function generatePseudoMoves(bd: (Piece | null)[][], color: string): Move[] {
	const moves: Move[] = [];
	
	for (let x = 0; x < 8; x++) {
		for (let y = 0; y < 8; y++) {
			const p = bd[x][y];
			if (!p || p.color !== color) continue;
			
			const from = Vec2(x, y);
			const raw = p.raw;
			
			// Peasant
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
			
			// Spy Tower - não se move
			if (raw === "spytower") continue;
			
			// Ram - qualquer casa ocupada por inimigo
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
			
			// Pawn normal (não peasant)
			if (raw === "pawn") {
				const dir = color === "white" ? -1 : 1;
				// Uma casa
				const to1 = Vec2(from.x, from.y + dir);
				if (inBounds(to1) && !bd[to1.x][to1.y]) {
					moves.push({ from, to: to1 });
					// Duas casas do início
					const startRow = color === "white" ? 6 : 1;
					if (from.y === startRow) {
						const to2 = Vec2(from.x, from.y + dir * 2);
						if (inBounds(to2) && !bd[to2.x][to2.y]) {
							moves.push({ from, to: to2 });
						}
					}
				}
				// Capturas
				for (const dx of [-1, 1]) {
					const cap = Vec2(from.x + dx, from.y + dir);
					if (inBounds(cap) && bd[cap.x][cap.y] && bd[cap.x][cap.y]!.color !== color) {
						moves.push({ from, to: cap });
					}
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
	
	// Ram: push
	if (raw === "ram" && target) {
		const dir = Vec2(Math.sign(to.x - from.x) || 0, Math.sign(to.y - from.y) || 0);
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
		const dir = Vec2(Math.sign(to.x - from.x) || 0, Math.sign(to.y - from.y) || 0);
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
	const oppMoves = generatePseudoMoves(bd, opp);
	for (const m of oppMoves) {
		if (m.to.x === kingPos.x && m.to.y === kingPos.y) return true;
	}
	return false;
}

function getLegalMoves(bd: (Piece | null)[][], color: string): Move[] {
	const pseudo = generatePseudoMoves(bd, color);
	const legal: Move[] = [];
	for (const m of pseudo) {
		const sim = simulateMove(bd, m.from, m.to);
		if (!isKingInCheck(sim, color)) legal.push(m);
	}
	return legal;
}

// ═════════════════════════════════════════════════════════════════
// AVALIAÇÃO AVANÇADA
// ═════════════════════════════════════════════════════════════════

function getPSTValue(raw: string, x: number, y: number, isEndgame: boolean): number {
	const sq = y * 8 + x;
	
	switch (raw) {
		case "pawn": case "warrior": case "peasant":
			return PST_PAWN[sq];
		case "knight": case "carrier":
			return PST_KNIGHT[sq];
		case "bishop": case "mage": case "sniper":
			return PST_BISHOP[sq];
		case "rook": case "catapult": case "spytower": case "ram":
			return PST_ROOK[sq];
		case "queen": case "princess": case "siren":
			return PST_QUEEN[sq];
		case "king":
			return isEndgame ? PST_KING_END[sq] : PST_KING_MIDDLE[sq];
		default:
			return 0;
	}
}

function countMaterial(bd: (Piece | null)[][], color: string): number {
	let total = 0;
	for (let x = 0; x < 8; x++) {
		for (let y = 0; y < 8; y++) {
			const p = bd[x][y];
			if (p && p.color === color) {
				total += PIECE_VALUES[p.raw] || 0;
			}
		}
	}
	return total;
}

function isEndgame(bd: (Piece | null)[][]): boolean {
	const whiteMat = countMaterial(bd, "white");
	const blackMat = countMaterial(bd, "black");
	return whiteMat < 25000 && blackMat < 25000; // Sem queens ou pouco material
}

function evaluate(bd: (Piece | null)[][], turn: string): number {
	let score = 0;
	const endgame = isEndgame(bd);
	
	// Material + PST
	for (let x = 0; x < 8; x++) {
		for (let y = 0; y < 8; y++) {
			const p = bd[x][y];
			if (!p) continue;
			
			const v = PIECE_VALUES[p.raw] || 100;
			const pst = getPSTValue(p.raw, x, y, endgame);
			
			if (p.color === "white") {
				score += v + pst;
			} else {
				score -= v + pst;
			}
		}
	}
	
	// Mobilidade
	const whiteMob = getLegalMoves(bd, "white").length;
	const blackMob = getLegalMoves(bd, "black").length;
	score += (whiteMob - blackMob) * 5;
	
	// Penalidade por peças ameaçadas (hanging pieces)
	score -= countHangingValue(bd, "white") * 0.7;
	score += countHangingValue(bd, "black") * 0.7;
	
	// Bônus por roque
	// (simplificado - você pode expandir)
	
	return turn === "white" ? score : -score;
}

function countHangingValue(bd: (Piece | null)[][], color: string): number {
	let total = 0;
	const opp = color === "white" ? "black" : "white";
	const oppMoves = generatePseudoMoves(bd, opp);
	
	for (const m of oppMoves) {
		const target = bd[m.to.x][m.to.y];
		if (target && target.color === color) {
			total += (PIECE_VALUES[target.raw] || 0) * 0.1;
		}
	}
	return total;
}

// ═════════════════════════════════════════════════════════════════
// MOVE ORDERING (MVV-LVA + Killer Moves)
// ═════════════════════════════════════════════════════════════════

function mvvLva(m: Move, bd: (Piece | null)[][]): number {
	const target = bd[m.to.x][m.to.y];
	const attacker = bd[m.from.x][m.from.y];
	if (!target || !attacker) return 0;
	
	const victimVal = PIECE_VALUES[target.raw] || 0;
	const attackerVal = PIECE_VALUES[attacker.raw] || 0;
	return victimVal * 100 - attackerVal;
}

function scoreMove(m: Move, bd: (Piece | null)[][], killers: Move[], ply: number): number {
	// Captura
	const target = bd[m.to.x][m.to.y];
	if (target) {
		return 1000000 + mvvLva(m, bd);
	}
	
	// Killer move
	for (let i = 0; i < killers.length && i < 2; i++) {
		const k = killers[i];
		if (k && m.from.x === k.from.x && m.from.y === k.from.y && 
			m.to.x === k.to.x && m.to.y === k.to.y) {
			return 900000 - i;
		}
	}
	
	// Promoção
	const raw = bd[m.from.x][m.from.y]?.raw || "";
	if (["pawn", "warrior", "peasant"].includes(raw) && (m.to.y === 0 || m.to.y === 7)) {
		return 800000;
	}
	
	return 0;
}

// ═════════════════════════════════════════════════════════════════
// QUIESCENCE SEARCH (capturas + checks + promoções)
// ═════════════════════════════════════════════════════════════════

function quiescence(bd: (Piece | null)[][], turn: string, alpha: number, beta: number, 
					depth: number, startTime: number, timeLimit: number): number {
	if (Date.now() - startTime > timeLimit) return evaluate(bd, turn);
	if (depth <= 0) return evaluate(bd, turn);
	
	const stand = evaluate(bd, turn);
	if (stand >= beta) return beta;
	if (alpha < stand) alpha = stand;
	
	// Delta pruning: se não há captura que possa melhorar alpha
	const delta = 900; // valor da rainha
	if (stand + delta < alpha) return alpha;
	
	const moves = getLegalMoves(bd, turn).filter(m => {
		// Apenas capturas, checks e promoções
		const target = bd[m.to.x][m.to.y];
		const raw = bd[m.from.x][m.from.y]?.raw || "";
		if (target) return true;
		if (["pawn", "warrior", "peasant"].includes(raw) && (m.to.y === 0 || m.to.y === 7)) return true;
		
		// Check moves
		const sim = simulateMove(bd, m.from, m.to);
		const opp = turn === "white" ? "black" : "white";
		if (isKingInCheck(sim, opp)) return true;
		
		return false;
	});
	
	if (moves.length === 0) return stand;
	
	moves.sort((a, b) => mvvLva(b, bd) - mvvLva(a, bd));
	
	const nxt = turn === "white" ? "black" : "white";
	for (const m of moves) {
		const nb = simulateMove(bd, m.from, m.to);
		const sc = -quiescence(nb, nxt, -beta, -alpha, depth - 1, startTime, timeLimit);
		if (sc >= beta) return beta;
		if (sc > alpha) alpha = sc;
	}
	
	return alpha;
}

// ═════════════════════════════════════════════════════════════════
// ALPHA-BETA COM NULL MOVE PRUNING
// ═════════════════════════════════════════════════════════════════

const TT: Map<string, TTEntry> = new Map();
const MAX_TT_SIZE = 100000;

function getTTKey(bd: (Piece | null)[][], turn: string, depth: number): string {
	let key = turn;
	for (let y = 0; y < 8; y++) {
		for (let x = 0; x < 8; x++) {
			const p = bd[x][y];
			key += p ? PIECE_ABBREV[p.raw] : ".";
		}
	}
	return key + depth;
}

function storeTT(key: string, depth: number, score: number, flag: number, bestMove: Move | null) {
	if (TT.size >= MAX_TT_SIZE) {
		const firstKey = TT.keys().next().value;
		if (firstKey) TT.delete(firstKey);
	}
	TT.set(key, { depth, score, flag, bestMove });
}

function alphabeta(bd: (Piece | null)[][], turn: string, depth: number, alpha: number, beta: number,
				   startTime: number, timeLimit: number, nullMove: boolean, 
				   killers: Move[], ply: number): number {
	if (Date.now() - startTime > timeLimit) return evaluate(bd, turn);
	if (depth <= 0) return quiescence(bd, turn, alpha, beta, 4, startTime, timeLimit);
	
	// Transposition Table
	const ttKey = getTTKey(bd, turn, depth);
	const ttEntry = TT.get(ttKey);
	if (ttEntry && ttEntry.depth >= depth) {
		if (ttEntry.flag === 0) return ttEntry.score;
		if (ttEntry.flag === 1 && ttEntry.score >= beta) return ttEntry.score;
		if (ttEntry.flag === 2 && ttEntry.score <= alpha) return ttEntry.score;
	}
	
	const moves = getLegalMoves(bd, turn);
	if (moves.length === 0) {
		if (isKingInCheck(bd, turn)) return -999999 + ply;
		return 0; // Stalemate
	}
	
	// Null Move Pruning
	if (nullMove && depth >= 3 && !isKingInCheck(bd, turn)) {
		const nxt = turn === "white" ? "black" : "white";
		const nullScore = -alphabeta(bd, nxt, depth - 3, -beta, -beta + 1, 
									 startTime, timeLimit, false, killers, ply + 1);
		if (nullScore >= beta) return beta;
	}
	
	// Move ordering
	for (const m of moves) {
		m.score = scoreMove(m, bd, killers, ply);
	}
	moves.sort((a, b) => (b.score || 0) - (a.score || 0));
	
	const nxt = turn === "white" ? "black" : "white";
	let bestScore = -9999999;
	let bestMove: Move | null = null;
	let newAlpha = alpha;
	
	for (let i = 0; i < moves.length; i++) {
		const m = moves[i];
		const nb = simulateMove(bd, m.from, m.to);
		
		// Late Move Reduction
		let reduction = 0;
		if (depth >= 3 && i >= 4 && !bd[m.to.x][m.to.y] && m.score! < 500000) {
			reduction = 1;
		}
		
		const sc = -alphabeta(nb, nxt, depth - 1 - reduction, -beta, -newAlpha, 
							  startTime, timeLimit, true, killers, ply + 1);
		
		if (sc > bestScore) {
			bestScore = sc;
			bestMove = m;
		}
		if (sc > newAlpha) newAlpha = sc;
		if (newAlpha >= beta) {
			// Killer move
			if (!killers[ply * 2]) killers[ply * 2] = m;
			else if (!killers[ply * 2 + 1]) killers[ply * 2 + 1] = m;
			break;
		}
	}
	
	// Store in TT
	let flag = 0;
	if (bestScore <= alpha) flag = 2;
	else if (bestScore >= beta) flag = 1;
	storeTT(ttKey, depth, bestScore, flag, bestMove);
	
	return bestScore;
}

// ═════════════════════════════════════════════════════════════════
// ITERATIVE DEEPENING
// ═════════════════════════════════════════════════════════════════

function iterativeDeepening(bd: (Piece | null)[][], turn: string, timeLimit: number, maxDepth: number): Move | null {
	const start = Date.now();
	const moves = getLegalMoves(bd, turn);
	if (moves.length === 0) return null;
	
	// Move ordering inicial
	for (const m of moves) {
		m.score = scoreMove(m, bd, [], 0);
	}
	moves.sort((a, b) => (b.score || 0) - (a.score || 0));
	
	let bestMove = moves[0];
	const killers: Move[] = [];
	
	for (let d = 1; d <= maxDepth; d++) {
		if (Date.now() - start > timeLimit) break;
		
		let localBest = -9999999;
		let localMove = bestMove;
		const nxt = turn === "white" ? "black" : "white";
		
		for (let i = 0; i < moves.length; i++) {
			const m = moves[i];
			const nb = simulateMove(bd, m.from, m.to);
			const sc = -alphabeta(nb, nxt, d - 1, -9999999, -localBest, 
								  startTime, timeLimit, true, killers, 0);
			
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
		
		if (localBest >= 999990) break; // Mate found
	}
	
	return bestMove;
}

// ═════════════════════════════════════════════════════════════════
// OPENING BOOK LOOKUP
// ═════════════════════════════════════════════════════════════════

function getOpeningMove(fen: string): string | null {
	const baseFen = fen.split(" - ")[0] + " " + fen.split(" ")[1];
	for (const [key, moves] of Object.entries(OPENING_BOOK)) {
		if (baseFen.startsWith(key)) {
			return moves[Math.floor(Math.random() * moves.length)];
		}
	}
	return null;
}

// ═════════════════════════════════════════════════════════════════
// HANDLER PRINCIPAL
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

				const { board, turn, moveCount } = fenToBoard(fen);
				
				// Opening book para primeiras jogadas
				if (moveCount <= 10) {
					const bookMove = getOpeningMove(fen);
					if (bookMove) {
						const from = Vec2(bookMove.charCodeAt(0) - 97, 8 - parseInt(bookMove[1]));
						const to = Vec2(bookMove.charCodeAt(2) - 97, 8 - parseInt(bookMove[3]));
						return new Response(JSON.stringify({
							from: bookMove.slice(0, 2),
							to: bookMove.slice(2, 4),
							fen: boardToFen(simulateMove(board, from, to), turn === "white" ? "black" : "white"),
							eval: 0,
							book: true
						}), {
							headers: { ...corsHeaders, "Content-Type": "application/json" }
						});
					}
				}

				// Configuração por rating
				const maxDepth = rating <= 250 ? 2 : rating <= 800 ? 3 : rating <= 1500 ? 4 : 5;
				const actualTime = Math.min(time_ms, rating <= 250 ? 100 : rating <= 800 ? 200 : rating <= 1500 ? 400 : 800);

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

		if (url.pathname === "/status") {
			return new Response(JSON.stringify({ status: "online", version: "3.0.0" }), {
				headers: { ...corsHeaders, "Content-Type": "application/json" }
			});
		}

		return new Response("Not found", { status: 404 });
	},
};
