"use strict";
var Xiangqi = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // app/xiangqi.ts
  var xiangqi_exports = {};
  __export(xiangqi_exports, {
    applyMove: () => applyMove,
    chooseComputerMove: () => chooseComputerMove,
    chooseOpeningPlan: () => chooseOpeningPlan,
    cloneBoard: () => cloneBoard,
    createInitialBoard: () => createInitialBoard,
    dangerAfterMove: () => dangerAfterMove,
    describeMove: () => describeMove,
    describeOpening: () => describeOpening,
    findGentleHint: () => findGentleHint,
    getLegalMoves: () => getLegalMoves,
    getMovesFrom: () => getMovesFrom,
    isInCheck: () => isInCheck,
    isSquareAttacked: () => isSquareAttacked,
    pieceNames: () => pieceNames,
    positionKey: () => positionKey
  });
  var VALUES = {
    king: 1e4,
    rook: 900,
    cannon: 480,
    horse: 430,
    elephant: 220,
    advisor: 220,
    pawn: 120
  };
  var pieceNames = {
    red: {
      rook: "\u8F66",
      horse: "\u9A6C",
      elephant: "\u76F8",
      advisor: "\u4ED5",
      king: "\u5E05",
      cannon: "\u70AE",
      pawn: "\u5175"
    },
    black: {
      rook: "\u8ECA",
      horse: "\u99AC",
      elephant: "\u8C61",
      advisor: "\u58EB",
      king: "\u5C07",
      cannon: "\u7832",
      pawn: "\u5352"
    }
  };
  var opposite = (color) => color === "red" ? "black" : "red";
  function createInitialBoard() {
    const board = Array.from({ length: 10 }, () => Array(9).fill(null));
    let id = 0;
    const add = (row, col, color, type) => {
      board[row][col] = { id: `${color}-${type}-${id++}`, color, type };
    };
    const backRank = [
      "rook",
      "horse",
      "elephant",
      "advisor",
      "king",
      "advisor",
      "elephant",
      "horse",
      "rook"
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
  function cloneBoard(board) {
    return board.map((row) => row.map((piece) => piece ? { ...piece } : null));
  }
  function clearBetween(board, from, to) {
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
  function inPalace(color, row, col) {
    return col >= 3 && col <= 5 && (color === "red" ? row >= 7 && row <= 9 : row >= 0 && row <= 2);
  }
  function attacksByRule(board, piece, from, to, target) {
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
        if (!(absRow === 2 && absCol === 1 || absRow === 1 && absCol === 2)) return false;
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
  function findKing(board, color) {
    for (let row = 0; row < 10; row += 1) {
      for (let col = 0; col < 9; col += 1) {
        const piece = board[row][col];
        if (piece?.color === color && piece.type === "king") return [row, col];
      }
    }
    return null;
  }
  function isSquareAttacked(board, row, col, byColor) {
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
  function isInCheck(board, color) {
    const king = findKing(board, color);
    return !king || isSquareAttacked(board, king[0], king[1], opposite(color));
  }
  function applyMove(board, move) {
    const next = cloneBoard(board);
    next[move.to[0]][move.to[1]] = next[move.from[0]][move.from[1]];
    next[move.from[0]][move.from[1]] = null;
    return next;
  }
  function getLegalMoves(board, color) {
    const moves = [];
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
            const move = {
              from: [fromRow, fromCol],
              to: [toRow, toCol],
              piece,
              captured: target
            };
            if (!isInCheck(applyMove(board, move), color)) moves.push(move);
          }
        }
      }
    }
    return moves;
  }
  function getMovesFrom(board, color, row, col) {
    return getLegalMoves(board, color).filter((move) => move.from[0] === row && move.from[1] === col);
  }
  function positionKey(board, turn) {
    const rows = board.map(
      (row) => row.map((piece) => piece ? `${piece.color[0]}${piece.type[0]}` : "__").join("")
    );
    return `${rows.join("/")}${turn ? `:${turn}` : ""}`;
  }
  function materialScore(board, color) {
    let score = 0;
    board.forEach(
      (row) => row.forEach((piece) => {
        if (!piece || piece.type === "king") return;
        const value = VALUES[piece.type];
        const position = piecePosition(board, piece);
        const advancedPawn = piece.type === "pawn" && !!position && (piece.color === "red" ? position[0] <= 4 : position[0] >= 5);
        score += (piece.color === color ? 1 : -1) * (value + (advancedPawn ? 25 : 0));
      })
    );
    return score;
  }
  function piecePosition(board, wanted) {
    for (let row = 0; row < 10; row += 1) {
      for (let col = 0; col < 9; col += 1) {
        if (board[row][col]?.id === wanted.id) return [row, col];
      }
    }
    return null;
  }
  function bestImmediateCapture(board, color) {
    let best = 0;
    for (const move of getLegalMoves(board, color)) {
      if (move.captured) best = Math.max(best, VALUES[move.captured.type]);
    }
    return best;
  }
  function chooseOpeningPlan(board, difficulty) {
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
  function describeOpening(plan, continuing = false) {
    const prefix = continuing ? "\u5C0F\u6728\u7EE7\u7EED\u5E03\u7F6E" : "\u5C0F\u6728\u5728\u5C1D\u8BD5";
    switch (plan) {
      case "screen-horses":
        return `${prefix}\u201C\u5C4F\u98CE\u9A6C\u201D\uFF1A\u8BA9\u4E24\u5339\u9A6C\u4E00\u8D77\u5B88\u4F4F\u4E2D\u95F4\u3002`;
      case "central-cannon":
        return `${prefix}\u201C\u4E2D\u70AE\u5E03\u9635\u201D\uFF1A\u628A\u70AE\u6446\u5230\u4E2D\u8DEF\uFF0C\u518D\u8BF7\u9A6C\u6765\u5E2E\u5FD9\u3002`;
      case "steady-horses":
        return `${prefix}\u201C\u8D77\u9A6C\u5E03\u9635\u201D\uFF1A\u5148\u628A\u9A6C\u8DF3\u51FA\u6765\uFF0C\u518D\u6162\u6162\u6253\u5F00\u8F66\u8DEF\u3002`;
      case "flying-elephant":
        return `${prefix}\u201C\u98DE\u8C61\u5E03\u9635\u201D\uFF1A\u5148\u62A4\u4F4F\u4E2D\u95F4\uFF0C\u518D\u628A\u9A6C\u8DF3\u51FA\u6765\u3002`;
    }
  }
  function sameMove(move, from, to) {
    return move.from[0] === from[0] && move.from[1] === from[1] && move.to[0] === to[0] && move.to[1] === to[1];
  }
  function openingScore(move, plan, computerMovesPlayed) {
    if (!plan || computerMovesPlayed >= 5) return 0;
    const developsLeftHorse = sameMove(move, [0, 1], [2, 2]);
    const developsRightHorse = sameMove(move, [0, 7], [2, 6]);
    const developsHorse = developsLeftHorse || developsRightHorse;
    const movesCannonToCenter = sameMove(move, [2, 1], [2, 4]) || sameMove(move, [2, 7], [2, 4]);
    const fliesElephant = sameMove(move, [0, 2], [2, 4]) || sameMove(move, [0, 6], [2, 4]);
    const advancesUsefulPawn = move.piece.type === "pawn" && move.from[0] === 3 && move.to[0] === 4 && (move.from[1] === 2 || move.from[1] === 6);
    let score = 0;
    if (developsHorse) score += 95;
    if (advancesUsefulPawn) score += 40;
    if (!move.captured && (move.piece.type === "horse" && move.from[0] !== 0 || move.piece.type === "cannon" && move.from[0] !== 2)) {
      score -= 75;
    }
    if (!move.captured && (move.piece.type === "king" || move.piece.type === "advisor")) score -= 70;
    if (move.piece.type === "pawn" && move.from[0] === 3 && (move.from[1] === 0 || move.from[1] === 8)) {
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
  function chooseComputerMove(board, difficulty, previousKeys, openingPlan = null) {
    const moves = getLegalMoves(board, "black");
    if (!moves.length) return null;
    const repetitionCounts = /* @__PURE__ */ new Map();
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
      const hangingPenalty = movedPieceAttacked ? VALUES[move.piece.type] * (movedPieceDefended ? 0.28 : 0.58) : 0;
      const repeatPenalty = (repetitionCounts.get(positionKey(next, "red")) ?? 0) >= 2 ? 1800 : 0;
      const centerBonus = 4 - Math.abs(4 - move.to[1]);
      const logic = materialScore(next, "black") * 0.3 + capture * 1.05 + (check ? 115 : 0) + centerBonus * 3 - responseDanger * (difficulty === 3 ? 0.72 : 0.42) - hangingPenalty - repeatPenalty + openingScore(move, openingPlan, computerMovesPlayed) * openingStrength + (winsNow ? 1e5 : 0);
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
  function findGentleHint(board) {
    const legal = getLegalMoves(board, "red");
    if (!legal.length) return null;
    const captures = legal.filter((move) => move.captured).sort((a, b) => VALUES[b.captured.type] - VALUES[a.captured.type]);
    if (captures.length) {
      return {
        at: captures[0].from,
        text: "\u597D\u50CF\u6709\u4E00\u679A\u9ED1\u68CB\u6CA1\u85CF\u597D\u3002\u770B\u770B\u54EA\u679A\u7EA2\u68CB\u80FD\u78B0\u5230\u5B83\uFF1F"
      };
    }
    const threatened = [];
    board.forEach(
      (row, rowIndex) => row.forEach((piece, colIndex) => {
        if (piece?.color === "red" && piece.type !== "king" && isSquareAttacked(board, rowIndex, colIndex, "black")) {
          threatened.push({
            at: [rowIndex, colIndex],
            value: VALUES[piece.type],
            name: pieceNames.red[piece.type]
          });
        }
      })
    );
    threatened.sort((a, b) => b.value - a.value);
    if (threatened[0]) {
      return {
        at: threatened[0].at,
        text: `\u4F60\u7684${threatened[0].name}\u6B63\u88AB\u76EF\u7740\uFF0C\u518D\u770B\u770B\u80FD\u4E0D\u80FD\u7167\u987E\u5B83\u3002`
      };
    }
    const central = [...legal].sort(
      (a, b) => Math.abs(4 - a.to[1]) - Math.abs(4 - b.to[1]) + (a.to[0] - b.to[0]) * 0.1
    )[0];
    return {
      at: central.from,
      text: "\u5148\u770B\u770B\u4E2D\u95F4\uFF1A\u6709\u6CA1\u6709\u68CB\u5B50\u53EF\u4EE5\u5F80\u524D\u5E2E\u5FD9\uFF1F"
    };
  }
  function dangerAfterMove(board) {
    const captures = getLegalMoves(board, "black").filter((move) => move.captured?.color === "red" && move.captured.type !== "pawn").sort((a, b) => VALUES[b.captured.type] - VALUES[a.captured.type]);
    if (!captures.length) return "";
    const piece = captures[0].captured;
    if (VALUES[piece.type] < VALUES.horse) return "";
    return `\u518D\u770B\u770B\uFF1A\u8FD9\u4E00\u6B65\u4EE5\u540E\uFF0C\u4F60\u7684${pieceNames.red[piece.type]}\u53EF\u80FD\u6709\u5371\u9669\u3002`;
  }
  function describeMove(move) {
    if (move.captured) return `\u5C0F\u6728\u5403\u6389\u4E86\u4E00\u4E2A${pieceNames.red[move.captured.type]}\u3002\u8F6E\u5230\u4F60\u5566\u3002`;
    return "\u5C0F\u6728\u8D70\u597D\u5566\uFF0C\u8F6E\u5230\u4F60\u3002";
  }
  return __toCommonJS(xiangqi_exports);
})();
