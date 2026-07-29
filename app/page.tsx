"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  applyMove,
  chooseComputerMove,
  createInitialBoard,
  dangerAfterMove,
  describeMove,
  findGentleHint,
  getLegalMoves,
  isInCheck,
  pieceNames,
  positionKey,
  type Board,
  type Color,
  type Move,
} from "./xiangqi";

type Result = {
  winner: Color;
  reason: "checkmate" | "no-moves";
};

type Snapshot = {
  board: Board;
  turn: Color;
  lastMove: Move | null;
  result: Result | null;
};

const STORAGE_KEY = "kids-xiangqi-v1";
const intersections = Array.from({ length: 90 }, (_, index) => [Math.floor(index / 9), index % 9] as const);

function newGame(): Snapshot[] {
  return [{ board: createInitialBoard(), turn: "red", lastMove: null, result: null }];
}

function resultAfter(board: Board, nextTurn: Color): Result | null {
  const legal = getLegalMoves(board, nextTurn);
  if (legal.length) return null;
  return {
    winner: nextTurn === "red" ? "black" : "red",
    reason: isInCheck(board, nextTurn) ? "checkmate" : "no-moves",
  };
}

function sameSquare(a: readonly number[] | null, row: number, col: number) {
  return !!a && a[0] === row && a[1] === col;
}

function vibrate() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(18);
}

export default function Home() {
  const [history, setHistory] = useState<Snapshot[]>(newGame);
  const [difficulty, setDifficulty] = useState<1 | 2 | 3>(2);
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [hinted, setHinted] = useState<[number, number] | null>(null);
  const [message, setMessage] = useState("你执红棋，先走。慢慢想，不着急。");
  const [thinking, setThinking] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const snapshot = history[history.length - 1];
  const board = snapshot.board;
  const allRedMoves = useMemo(
    () => (snapshot.turn === "red" && !snapshot.result ? getLegalMoves(board, "red") : []),
    [board, snapshot.result, snapshot.turn],
  );
  const selectedMoves = useMemo(
    () =>
      selected
        ? allRedMoves.filter((move) => move.from[0] === selected[0] && move.from[1] === selected[1])
        : [],
    [allRedMoves, selected],
  );

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as { history?: Snapshot[]; difficulty?: 1 | 2 | 3 };
        if (
          Array.isArray(parsed.history) &&
          parsed.history.length &&
          Array.isArray(parsed.history.at(-1)?.board) &&
          [1, 2, 3].includes(parsed.difficulty ?? 0)
        ) {
          setHistory(parsed.history);
          setDifficulty(parsed.difficulty!);
          setMessage("接着上次这盘下。棋盘一直帮你留着呢。");
        }
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    } finally {
      setLoaded(true);
    }

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    if (!loaded) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ history, difficulty }));
  }, [difficulty, history, loaded]);

  useEffect(() => {
    if (snapshot.turn !== "black" || snapshot.result) {
      setThinking(false);
      return;
    }
    setThinking(true);
    setSelected(null);
    setHinted(null);
    setMessage("小木正在认真想一想…");
    const timer = window.setTimeout(() => {
      const move = chooseComputerMove(
        snapshot.board,
        difficulty,
        history.map((item) => positionKey(item.board, item.turn)),
      );
      if (!move) {
        setThinking(false);
        return;
      }
      const nextBoard = applyMove(snapshot.board, move);
      const result = resultAfter(nextBoard, "red");
      setHistory((current) => [
        ...current,
        { board: nextBoard, turn: "red", lastMove: move, result },
      ]);
      setThinking(false);
      if (result?.winner === "black") {
        setMessage("这盘小木赢了。没关系，悔一步或者再来一盘都可以。");
      } else if (isInCheck(nextBoard, "red")) {
        setMessage("现在被将军了。先找找怎么保护帅。");
      } else {
        setMessage(describeMove(move));
      }
    }, 520 + Math.random() * 380);
    return () => window.clearTimeout(timer);
  }, [difficulty, history, snapshot]);

  useEffect(() => {
    if (!confirmReset) return;
    const timer = window.setTimeout(() => setConfirmReset(false), 3200);
    return () => window.clearTimeout(timer);
  }, [confirmReset]);

  const moveChild = useCallback(
    (move: Move) => {
      const nextBoard = applyMove(board, move);
      const result = resultAfter(nextBoard, "black");
      setHistory((current) => [
        ...current,
        { board: nextBoard, turn: "black", lastMove: move, result },
      ]);
      setSelected(null);
      setHinted(null);
      vibrate();
      if (result?.winner === "red") {
        setMessage("将死！这一盘你赢啦。你认真想出来的！");
      } else if (isInCheck(nextBoard, "black")) {
        setMessage("将军！这一步很有力量。");
      } else {
        setMessage(dangerAfterMove(nextBoard) || "走得好。现在轮到小木想一想。");
      }
    },
    [board],
  );

  const handleSquare = useCallback(
    (row: number, col: number) => {
      if (thinking || snapshot.result || snapshot.turn !== "red") return;
      const piece = board[row][col];
      if (piece?.color === "red") {
        setSelected([row, col]);
        setHinted(null);
        const count = allRedMoves.filter((move) => move.from[0] === row && move.from[1] === col).length;
        setMessage(count ? `选中了${pieceNames.red[piece.type]}。再点它要去的位置。` : "这枚棋子现在动不了，再看看别的。");
        vibrate();
        return;
      }
      if (!selected) {
        setMessage(piece ? "这是小木的棋。先选一枚红棋吧。" : "先点一枚红棋，再点要走的位置。");
        return;
      }
      const move = selectedMoves.find((item) => item.to[0] === row && item.to[1] === col);
      if (!move) {
        setMessage(isInCheck(board, "red") ? "现在被将军了，这样走还保护不了帅。" : "这里不能走。换个位置再看看。");
        vibrate();
        return;
      }
      moveChild(move);
    },
    [allRedMoves, board, moveChild, selected, selectedMoves, snapshot.result, snapshot.turn, thinking],
  );

  const undo = () => {
    if (history.length === 1) {
      setMessage("这盘还没走呢。");
      return;
    }
    let index = history.length - 2;
    while (index >= 0 && history[index].turn !== "red") index -= 1;
    if (index < 0) index = 0;
    setHistory(history.slice(0, index + 1));
    setSelected(null);
    setHinted(null);
    setConfirmReset(false);
    setMessage("悔好啦。再想一次，想多久都可以。");
    vibrate();
  };

  const hint = () => {
    if (snapshot.result) {
      setMessage(snapshot.result.winner === "red" ? "你已经赢啦！可以开始新的一盘。" : "可以悔一步，再试试看。");
      return;
    }
    if (snapshot.turn === "black") {
      setMessage("先等小木走好这一步。");
      return;
    }
    if (isInCheck(board, "red")) {
      setHinted(null);
      setMessage("现在被将军了。看看帅能不能躲开，或者谁能来帮忙？");
      return;
    }
    const gentleHint = findGentleHint(board);
    if (gentleHint) {
      setHinted(gentleHint.at);
      setSelected(null);
      setMessage(gentleHint.text);
    }
  };

  const reset = () => {
    if (!confirmReset) {
      setConfirmReset(true);
      setMessage("再点一次“确定重来”，棋子就会重新摆好。");
      return;
    }
    setHistory(newGame());
    setSelected(null);
    setHinted(null);
    setConfirmReset(false);
    setThinking(false);
    setMessage("新的一盘开始啦。你执红棋，先走。");
  };

  const statusTitle = snapshot.result
    ? snapshot.result.winner === "red"
      ? "你赢啦！"
      : "这一盘结束啦"
    : thinking
      ? "小木在想"
      : isInCheck(board, "red")
        ? "你的帅被将军"
        : "轮到你啦";

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">象</span>
          <div>
            <h1>儿童象棋</h1>
            <p>认真陪你下好每一步</p>
          </div>
        </div>
        <label className="difficulty">
          <span>难度</span>
          <select
            aria-label="选择电脑难度"
            value={difficulty}
            onChange={(event) => {
              const next = Number(event.target.value) as 1 | 2 | 3;
              setDifficulty(next);
              setMessage(`难度调到${["", "一级 · 轻松", "二级 · 刚好", "三级 · 认真"][next]}。`);
            }}
          >
            <option value={1}>一级 · 轻松</option>
            <option value={2}>二级 · 刚好</option>
            <option value={3}>三级 · 认真</option>
          </select>
        </label>
      </header>

      <section className="game-layout" aria-label="儿童象棋对局">
        <div className="board-column">
          <div className="player-strip black-player">
            <div className="player-avatar wood-avatar" aria-hidden="true">木</div>
            <div>
              <strong>小木</strong>
              <span>{thinking ? "正在想…" : "电脑朋友 · 黑方"}</span>
            </div>
            <span className={`turn-dot ${snapshot.turn === "black" && !snapshot.result ? "active" : ""}`} />
          </div>

          <div className="board-frame">
            <div className="xiangqi-board" aria-label="中国象棋棋盘">
              {Array.from({ length: 10 }, (_, index) => (
                <span key={`h-${index}`} className="board-line horizontal" style={{ top: `${5 + index * 10}%` }} />
              ))}
              {Array.from({ length: 9 }, (_, index) => (
                <span
                  key={`v-${index}`}
                  className={`board-line vertical ${index > 0 && index < 8 ? "river-gap" : ""}`}
                  style={{ left: `${5.556 + index * 11.111}%` }}
                />
              ))}
              <span className="palace-line palace-top-one" />
              <span className="palace-line palace-top-two" />
              <span className="palace-line palace-bottom-one" />
              <span className="palace-line palace-bottom-two" />
              <div className="river-label" aria-hidden="true">
                <span>楚 河</span>
                <span>漢 界</span>
              </div>

              {intersections.map(([row, col]) => {
                const isTarget = selectedMoves.some((move) => move.to[0] === row && move.to[1] === col);
                const captures = isTarget && !!board[row][col];
                return (
                  <button
                    key={`square-${row}-${col}`}
                    type="button"
                    className={`intersection ${isTarget ? "legal-target" : ""} ${captures ? "capture-target" : ""}`}
                    style={{ left: `${5.556 + col * 11.111}%`, top: `${5 + row * 10}%` }}
                    onClick={() => handleSquare(row, col)}
                    aria-label={`${row + 1}行${col + 1}列${isTarget ? "，可以走到这里" : ""}`}
                    tabIndex={isTarget ? 0 : -1}
                  />
                );
              })}

              {board.map((row, rowIndex) =>
                row.map((piece, colIndex) => {
                  if (!piece) return null;
                  const wasFrom = sameSquare(snapshot.lastMove?.from ?? null, rowIndex, colIndex);
                  const wasTo = sameSquare(snapshot.lastMove?.to ?? null, rowIndex, colIndex);
                  const isSelected = sameSquare(selected, rowIndex, colIndex);
                  const isHinted = sameSquare(hinted, rowIndex, colIndex);
                  return (
                    <button
                      key={piece.id}
                      type="button"
                      className={`piece ${piece.color} ${isSelected ? "selected" : ""} ${isHinted ? "hinted" : ""} ${wasFrom || wasTo ? "last-move" : ""}`}
                      style={{ left: `${5.556 + colIndex * 11.111}%`, top: `${5 + rowIndex * 10}%` }}
                      onClick={() => handleSquare(rowIndex, colIndex)}
                      aria-label={`${piece.color === "red" ? "红方" : "黑方"}${pieceNames[piece.color][piece.type]}，${rowIndex + 1}行${colIndex + 1}列`}
                    >
                      {pieceNames[piece.color][piece.type]}
                    </button>
                  );
                }),
              )}
            </div>
          </div>

          <div className="player-strip red-player">
            <div className="player-avatar child-avatar" aria-hidden="true">你</div>
            <div>
              <strong>你</strong>
              <span>红方 · 先走</span>
            </div>
            <span className={`turn-dot ${snapshot.turn === "red" && !snapshot.result ? "active" : ""}`} />
          </div>
        </div>

        <aside className="side-panel">
          <div className="status-card" role="status" aria-live="polite">
            <div className={`companion-face ${thinking ? "thinking" : ""}`} aria-hidden="true">
              <i />
              <i />
              <b />
            </div>
            <div>
              <span className="status-kicker">{statusTitle}</span>
              <p>{message}</p>
            </div>
          </div>

          <div className="controls" aria-label="对局操作">
            <button type="button" onClick={undo} disabled={history.length === 1}>
              <span aria-hidden="true">↶</span>
              <strong>悔棋</strong>
              <small>想多久都可以</small>
            </button>
            <button type="button" onClick={hint}>
              <span aria-hidden="true">✦</span>
              <strong>提示一下</strong>
              <small>只给一点点线索</small>
            </button>
            <button type="button" className={confirmReset ? "confirm" : ""} onClick={reset}>
              <span aria-hidden="true">↻</span>
              <strong>{confirmReset ? "确定重来" : "重新开始"}</strong>
              <small>{confirmReset ? "再点一次就重摆" : "换一盘也没关系"}</small>
            </button>
          </div>

          <p className="save-note">
            <span aria-hidden="true">✓</span>
            这盘棋会自动留在这里
          </p>
        </aside>
      </section>
    </main>
  );
}
