export type Color = "red" | "black";
export type PieceType = "rook" | "horse" | "elephant" | "advisor" | "king" | "cannon" | "pawn";

export type Piece = {
  id: string;
  color: Color;
  type: PieceType;
};

export type Board = Array<Array<Piece | null>>;

export type Move = {
  from: [number, number];
  to: [number, number];
  piece: Piece;
  captured: Piece | null;
};

export type OpeningPlan = "screen-horses" | "central-cannon" | "steady-horses" | "flying-elephant";

const VALUES: Record<PieceType, number> = {
  king: 10_000,
  rook: 900,
  cannon: 480,
  horse: 430,
  elephant: 220,
  advisor: 220,
  pawn: 120,
};

export const pieceNames: Record<Color, Record<PieceType, string>> = {
  red: {
    rook: "车",
    horse: "马",
    elephant: "相",
    advisor: "仕",
    king: "帅",
    cannon: "炮",
    pawn: "兵",
  },
  black: {
    rook: "車",
    horse: "馬",
    elephant: "象",
    advisor: "士",
    king: "將",
    cannon: "砲",
    pawn: "卒",
  },
};

const opposite = (color: Color): Color => (color === "red" ? "black" : "red");
const inside = (row: number, col: number) => row >= 0 && row < 10 && col >= 0 && col < 9;

export function createInitialBoard(): Board {
  const board: Board = Array.from({ length: 10 }, () => Array<Piece | null>(9).fill(null));
  let id = 0;
  const add = (row: number, col: number, color: Color, type: PieceType) => {
    board[row][col] = { id: `${color}-${type}-${id++}`, color, type };
  };

  const backRank: PieceType[] = [
    "rook", "horse", "elephant", "advisor", "king", "advisor", "elephant", "horse", "rook",
  ];
  backRank.forEach((type, col) => {
    add(0, col, "black", type);
    add(9, col, "red", type);
  });
  [1, 7].forEach((col) => {
    add(2, col, "black", "cannon");
    add(7, col, "red", "cannon");
  });
  [0, 2, 4, 6, 8].forEach((col) => {
    add(3, col, "black", "pawn");
    add(6, col, "red", "pawn");
  });
  return board;
}

export function cloneBoard(board: Board): Board {
  return board.map((row) => row.map((piece) => (piece ? { ...piece } : null)));
}

function clearBetween(board: Board, from: [number, number], to: [number, number]) {
  const [fromRow, fromCol] = from;
  const [toRow, toCol] = to;
  if (fromRow !== toRow && fromCol !== toCol) return -1;
  const rowStep = Math.sign(toRow - fromRow);
  const colStep = Math.sign(toCol - fromCol);
  let row = fromRow + rowStep;
  let col = fromCol + colStep;
  let count = 0;
  while (row !== toRow || col !== toCol) {
    if (board[row][col]) count += 1;
    row += rowStep;
    col += colStep;
  }
  return count;
}

function inPalace(color: Color, row: number, col: number) {
  return col >= 3 && col <= 5 && (color === "red" ? row >= 7 && row <= 9 : row >= 0 && row <= 2);
}

function attacksByRule(
  board: Board,
  piece: Piece,
  from: [number, number],
  to: [number, number],
  target: Piece | null,
) {
  const [fromRow, fromCol] = from;
  const [toRow, toCol] = to;
  const rowDelta = toRow - fromRow;
  const colDelta = toCol - fromCol;
  const absRow = Math.abs(rowDelta);
  const absCol = Math.abs(colDelta);

  switch (piece.type) {
    case "rook":
      return (rowDelta === 0 || colDelta === 0) && clearBetween(board, from, to) === 0;
    case "horse": {
      if (!((absRow === 2 && absCol === 1) || (absRow === 1 && absCol === 2))) return false;
      const legRow = fromRow + (absRow === 2 ? Math.sign(rowDelta) : 0);
      const legCol = fromCol + (absCol === 2 ? Math.sign(colDelta) : 0);
      return !board[legRow][legCol];
    }
    case "elephant": {
      if (absRow !== 2 || absCol !== 2) return false;
      if (piece.color === "red" ? toRow < 5 : toRow > 4) return false;
      return !board[fromRow + rowDelta / 2][fromCol + colDelta / 2];
    }
    case "advisor":
      return absRow === 1 && absCol === 1 && inPalace(piece.color, toRow, toCol);
    case "king": {
      if (target?.type === "king" && fromCol === toCol && clearBetween(board, from, to) === 0) return true;
      return absRow + absCol === 1 && inPalace(piece.color, toRow, toCol);
    }
    case "cannon": {
      if (rowDelta !== 0 && colDelta !== 0) return false;
      const screens = clearBetween(board, from, to);
      return target ? screens === 1 : screens === 0;
    }
    case "pawn": {
      const forward = piece.color === "red" ? -1 : 1;
      if (rowDelta === forward && colDelta === 0) return true;
      const crossedRiver = piece.color === "red" ? fromRow <= 4 : fromRow >= 5;
      return crossedRiver && rowDelta === 0 && absCol === 1;
    }
  }
}

function findKing(board: Board, color: Color): [number, number] | null {
  for (let row = 0; row < 10; row += 1) {
    for (let col = 0; col < 9; col += 1) {
      const piece = board[row][col];
      if (piece?.color === color && piece.type === "king") return [row, col];
    }
  }
  return null;
}

export function isSquareAttacked(board: Board, row: number, col: number, byColor: Color) {
  const target = board[row][col];
  for (let fromRow = 0; fromRow < 10; fromRow += 1) {
    for (let fromCol = 0; fromCol < 9; fromCol += 1) {
      const piece = board[fromRow][fromCol];
      if (fromRow === row && fromCol === col) continue;
      if (piece?.color === byColor && attacksByRule(board, piece, [fromRow, fromCol], [row, col], target)) {
        return true;
      }
    }
  }
  return false;
}

export function isInCheck(board: Board, color: Color) {
  const king = findKing(board, color);
  return !king || isSquareAttacked(board, king[0], king[1], opposite(color));
}

export function applyMove(board: Board, move: Move): Board {
  const next = cloneBoard(board);
  next[move.to[0]][move.to[1]] = next[move.from[0]][move.from[1]];
  next[move.from[0]][move.from[1]] = null;
  return next;
}

export function getLegalMoves(board: Board, color: Color): Move[] {
  const moves: Move[] = [];
  for (let fromRow = 0; fromRow < 10; fromRow += 1) {
    for (let fromCol = 0; fromCol < 9; fromCol += 1) {
      const piece = board[fromRow][fromCol];
      if (!piece || piece.color !== color) continue;
      for (let toRow = 0; toRow < 10; toRow += 1) {
        for (let toCol = 0; toCol < 9; toCol += 1) {
          if (fromRow === toRow && fromCol === toCol) continue;
          const target = board[toRow][toCol];
          if (target?.color === color || target?.type === "king") continue;
          if (!attacksByRule(board, piece, [fromRow, fromCol], [toRow, toCol], target)) continue;
          const move: Move = {
            from: [fromRow, fromCol],
            to: [toRow, toCol],
            piece,
            captured: target,
          };
          if (!isInCheck(applyMove(board, move), color)) moves.push(move);
        }
      }
    }
  }
  return moves;
}

export function getMovesFrom(board: Board, color: Color, row: number, col: number) {
  return getLegalMoves(board, color).filter((move) => move.from[0] === row && move.from[1] === col);
}

export function positionKey(board: Board, turn?: Color) {
  const rows = board.map((row) =>
    row.map((piece) => (piece ? `${piece.color[0]}${piece.type[0]}` : "__")).join(""),
  );
  return `${rows.join("/")}${turn ? `:${turn}` : ""}`;
}

function materialScore(board: Board, color: Color) {
  let score = 0;
  board.forEach((row) =>
    row.forEach((piece) => {
      if (!piece || piece.type === "king") return;
      const value = VALUES[piece.type];
      const position = piecePosition(board, piece);
      const advancedPawn =
        piece.type === "pawn" &&
        !!position &&
        (piece.color === "red" ? position[0] <= 4 : position[0] >= 5);
      score += (piece.color === color ? 1 : -1) * (value + (advancedPawn ? 25 : 0));
    }),
  );
  return score;
}

function piecePosition(board: Board, wanted: Piece): [number, number] | null {
  for (let row = 0; row < 10; row += 1) {
    for (let col = 0; col < 9; col += 1) {
      if (board[row][col]?.id === wanted.id) return [row, col];
    }
  }
  return null;
}

function bestImmediateCapture(board: Board, color: Color) {
  let best = 0;
  for (const move of getLegalMoves(board, color)) {
    if (move.captured) best = Math.max(best, VALUES[move.captured.type]);
  }
  return best;
}

export function chooseOpeningPlan(board: Board, difficulty: 1 | 2 | 3): OpeningPlan {
  const redCenterPiece = board[7][4];
  const redUsesCentralCannon = redCenterPiece?.color === "red" && redCenterPiece.type === "cannon";
  const redUsesFlyingElephant = redCenterPiece?.color === "red" && redCenterPiece.type === "elephant";
  const redAdvancesSidePawn = [2, 6].some((col) => {
    const piece = board[5][col];
    return piece?.color === "red" && piece.type === "pawn";
  });

  if (redUsesCentralCannon) {
    const screenHorseChance = difficulty === 1 ? 0.52 : difficulty === 2 ? 0.72 : 0.82;
    return Math.random() < screenHorseChance ? "screen-horses" : "central-cannon";
  }
  if (redUsesFlyingElephant) {
    return Math.random() < 0.68 ? "steady-horses" : "flying-elephant";
  }
  if (redAdvancesSidePawn) {
    return Math.random() < 0.72 ? "steady-horses" : "flying-elephant";
  }

  const roll = Math.random();
  if (roll < 0.5) return "steady-horses";
  if (roll < 0.78) return "flying-elephant";
  return "central-cannon";
}

export function describeOpening(plan: OpeningPlan, continuing = false) {
  const prefix = continuing ? "小木继续布置" : "小木在尝试";
  switch (plan) {
    case "screen-horses":
      return `${prefix}“屏风马”：让两匹马一起守住中间。`;
    case "central-cannon":
      return `${prefix}“中炮布阵”：把炮摆到中路，再请马来帮忙。`;
    case "steady-horses":
      return `${prefix}“起马布阵”：先把马跳出来，再慢慢打开车路。`;
    case "flying-elephant":
      return `${prefix}“飞象布阵”：先护住中间，再把马跳出来。`;
  }
}

function sameMove(
  move: Move,
  from: readonly [number, number],
  to: readonly [number, number],
) {
  return (
    move.from[0] === from[0] &&
    move.from[1] === from[1] &&
    move.to[0] === to[0] &&
    move.to[1] === to[1]
  );
}

function openingScore(move: Move, plan: OpeningPlan | null, computerMovesPlayed: number) {
  if (!plan || computerMovesPlayed >= 5) return 0;

  const developsLeftHorse = sameMove(move, [0, 1], [2, 2]);
  const developsRightHorse = sameMove(move, [0, 7], [2, 6]);
  const developsHorse = developsLeftHorse || developsRightHorse;
  const movesCannonToCenter =
    sameMove(move, [2, 1], [2, 4]) || sameMove(move, [2, 7], [2, 4]);
  const fliesElephant =
    sameMove(move, [0, 2], [2, 4]) || sameMove(move, [0, 6], [2, 4]);
  const advancesUsefulPawn =
    move.piece.type === "pawn" &&
    move.from[0] === 3 &&
    move.to[0] === 4 &&
    (move.from[1] === 2 || move.from[1] === 6);

  let score = 0;
  if (developsHorse) score += 95;
  if (advancesUsefulPawn) score += 40;
  if (
    !move.captured &&
    ((move.piece.type === "horse" && move.from[0] !== 0) ||
      (move.piece.type === "cannon" && move.from[0] !== 2))
  ) {
    score -= 75;
  }
  if (!move.captured && (move.piece.type === "king" || move.piece.type === "advisor")) score -= 70;
  if (
    move.piece.type === "pawn" &&
    move.from[0] === 3 &&
    (move.from[1] === 0 || move.from[1] === 8)
  ) {
    score -= 45;
  }

  switch (plan) {
    case "screen-horses":
      if (developsHorse) score += 245;
      if (advancesUsefulPawn) score += 90;
      break;
    case "central-cannon":
      if (movesCannonToCenter) score += 310;
      if (developsHorse) score += 155;
      break;
    case "steady-horses":
      if (developsHorse) score += 255;
      if (advancesUsefulPawn) score += 105;
      break;
    case "flying-elephant":
      if (fliesElephant) score += 315;
      if (developsHorse) score += 170;
      break;
  }
  return score;
}

export function chooseComputerMove(
  board: Board,
  difficulty: 1 | 2 | 3,
  previousKeys: string[],
  openingPlan: OpeningPlan | null = null,
) {
  const moves = getLegalMoves(board, "black");
  if (!moves.length) return null;
  const repetitionCounts = new Map<string, number>();
  previousKeys.forEach((key) => repetitionCounts.set(key, (repetitionCounts.get(key) ?? 0) + 1));
  const computerMovesPlayed = Math.max(0, Math.floor((previousKeys.length - 1) / 2));
  const openingStrength = difficulty === 1 ? 0.5 : difficulty === 2 ? 0.86 : 1.08;

  const scored = moves.map((move) => {
    const next = applyMove(board, move);
    const replies = getLegalMoves(next, "red");
    const winsNow = replies.length === 0;
    const check = isInCheck(next, "red");
    const responseDanger = difficulty === 1 ? 0 : bestImmediateCapture(next, "red");
    const capture = move.captured ? VALUES[move.captured.type] : 0;
    const movedPieceAttacked = isSquareAttacked(next, move.to[0], move.to[1], "red");
    const movedPieceDefended = isSquareAttacked(next, move.to[0], move.to[1], "black");
    const hangingPenalty = movedPieceAttacked
      ? VALUES[move.piece.type] * (movedPieceDefended ? 0.28 : 0.58)
      : 0;
    const repeatPenalty = (repetitionCounts.get(positionKey(next, "red")) ?? 0) >= 2 ? 1_800 : 0;
    const centerBonus = 4 - Math.abs(4 - move.to[1]);
    const logic =
      materialScore(next, "black") * 0.3 +
      capture * 1.05 +
      (check ? 115 : 0) +
      centerBonus * 3 -
      responseDanger * (difficulty === 3 ? 0.72 : 0.42) -
      hangingPenalty -
      repeatPenalty +
      openingScore(move, openingPlan, computerMovesPlayed) * openingStrength +
      (winsNow ? 100_000 : 0);
    const noise = (Math.random() - 0.5) * (difficulty === 1 ? 620 : difficulty === 2 ? 260 : 95);
    return { move, score: logic + noise, logic };
  });

  scored.sort((a, b) => b.score - a.score);
  const bestLogic = Math.max(...scored.map((item) => item.logic));
  const sensible = scored.filter((item) => item.logic >= bestLogic - (difficulty === 1 ? 700 : difficulty === 2 ? 360 : 190));
  const poolSize = difficulty === 1 ? 6 : difficulty === 2 ? 4 : 3;
  const pool = sensible.slice(0, Math.max(1, poolSize));
  const weights = pool.map((_, index) => pool.length - index);
  let pick = Math.random() * weights.reduce((sum, weight) => sum + weight, 0);
  for (let index = 0; index < pool.length; index += 1) {
    pick -= weights[index];
    if (pick <= 0) return pool[index].move;
  }
  return pool[0].move;
}

export function findGentleHint(board: Board) {
  const legal = getLegalMoves(board, "red");
  if (!legal.length) return null;
  const captures = legal
    .filter((move) => move.captured)
    .sort((a, b) => VALUES[b.captured!.type] - VALUES[a.captured!.type]);
  if (captures.length) {
    return {
      at: captures[0].from,
      text: "好像有一枚黑棋没藏好。看看哪枚红棋能碰到它？",
    };
  }

  const threatened: Array<{ at: [number, number]; value: number; name: string }> = [];
  board.forEach((row, rowIndex) =>
    row.forEach((piece, colIndex) => {
      if (
        piece?.color === "red" &&
        piece.type !== "king" &&
        isSquareAttacked(board, rowIndex, colIndex, "black")
      ) {
        threatened.push({
          at: [rowIndex, colIndex],
          value: VALUES[piece.type],
          name: pieceNames.red[piece.type],
        });
      }
    }),
  );
  threatened.sort((a, b) => b.value - a.value);
  if (threatened[0]) {
    return {
      at: threatened[0].at,
      text: `你的${threatened[0].name}正被盯着，再看看能不能照顾它。`,
    };
  }

  const central = [...legal].sort(
    (a, b) => Math.abs(4 - a.to[1]) - Math.abs(4 - b.to[1]) + (a.to[0] - b.to[0]) * 0.1,
  )[0];
  return {
    at: central.from,
    text: "先看看中间：有没有棋子可以往前帮忙？",
  };
}

export function dangerAfterMove(board: Board) {
  const captures = getLegalMoves(board, "black")
    .filter((move) => move.captured?.color === "red" && move.captured.type !== "pawn")
    .sort((a, b) => VALUES[b.captured!.type] - VALUES[a.captured!.type]);
  if (!captures.length) return "";
  const piece = captures[0].captured!;
  if (VALUES[piece.type] < VALUES.horse) return "";
  return `再看看：这一步以后，你的${pieceNames.red[piece.type]}可能有危险。`;
}

export function describeMove(move: Move) {
  if (move.captured) return `小木吃掉了一个${pieceNames.red[move.captured.type]}。轮到你啦。`;
  return "小木走好啦，轮到你。";
}
