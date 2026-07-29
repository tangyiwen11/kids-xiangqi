(() => {
  "use strict";

  const {
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
  } = Xiangqi;

  const STORAGE_KEY = "kids-xiangqi-pages-v1";
  const boardElement = document.querySelector("#board");
  const messageElement = document.querySelector("#message");
  const statusTitleElement = document.querySelector("#status-title");
  const difficultyElement = document.querySelector("#difficulty");
  const undoButton = document.querySelector("#undo");
  const hintButton = document.querySelector("#hint");
  const resetButton = document.querySelector("#reset");
  const faceElement = document.querySelector("#face");
  const blackLabelElement = document.querySelector("#black-label");
  const blackTurnElement = document.querySelector("#black-turn");
  const redTurnElement = document.querySelector("#red-turn");

  let history = newGame();
  let difficulty = 2;
  let selected = null;
  let hinted = null;
  let message = "你执红棋，先走。慢慢想，不着急。";
  let thinking = false;
  let confirmReset = false;
  let aiTimer = null;
  let resetTimer = null;

  function newGame() {
    return [{ board: createInitialBoard(), turn: "red", lastMove: null, result: null }];
  }

  function snapshot() {
    return history[history.length - 1];
  }

  function resultAfter(board, nextTurn) {
    const legal = getLegalMoves(board, nextTurn);
    if (legal.length) return null;
    return {
      winner: nextTurn === "red" ? "black" : "red",
      reason: isInCheck(board, nextTurn) ? "checkmate" : "no-moves",
    };
  }

  function sameSquare(square, row, col) {
    return Boolean(square && square[0] === row && square[1] === col);
  }

  function vibrate() {
    if ("vibrate" in navigator) navigator.vibrate(18);
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ history, difficulty }));
  }

  function load() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved);
      const last = parsed.history && parsed.history[parsed.history.length - 1];
      if (
        Array.isArray(parsed.history) &&
        parsed.history.length &&
        Array.isArray(last && last.board) &&
        [1, 2, 3].includes(Number(parsed.difficulty))
      ) {
        history = parsed.history;
        difficulty = Number(parsed.difficulty);
        difficultyElement.value = String(difficulty);
        message = "接着上次这盘下。棋盘一直帮你留着呢。";
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  function statusTitle(current) {
    if (current.result) return current.result.winner === "red" ? "你赢啦！" : "这一盘结束啦";
    if (thinking) return "小木在想";
    if (isInCheck(current.board, "red")) return "你的帅被将军";
    return "轮到你啦";
  }

  function boardDecoration() {
    let html = "";
    for (let index = 0; index < 10; index += 1) {
      html += `<span class="board-line horizontal" style="top:${5 + index * 10}%"></span>`;
    }
    for (let index = 0; index < 9; index += 1) {
      const river = index > 0 && index < 8 ? " river-gap" : "";
      html += `<span class="board-line vertical${river}" style="left:${5.556 + index * 11.111}%"></span>`;
    }
    html += `
      <span class="palace-line palace-top-one"></span>
      <span class="palace-line palace-top-two"></span>
      <span class="palace-line palace-bottom-one"></span>
      <span class="palace-line palace-bottom-two"></span>
      <div class="river-label" aria-hidden="true"><span>楚 河</span><span>漢 界</span></div>
    `;
    return html;
  }

  function render() {
    const current = snapshot();
    const board = current.board;
    const redMoves = current.turn === "red" && !current.result ? getLegalMoves(board, "red") : [];
    const selectedMoves = selected
      ? redMoves.filter((move) => move.from[0] === selected[0] && move.from[1] === selected[1])
      : [];

    boardElement.innerHTML = boardDecoration();

    for (let row = 0; row < 10; row += 1) {
      for (let col = 0; col < 9; col += 1) {
        const targetMove = selectedMoves.find((move) => move.to[0] === row && move.to[1] === col);
        const target = document.createElement("button");
        target.type = "button";
        target.className = `intersection${targetMove ? " legal-target" : ""}${targetMove && board[row][col] ? " capture-target" : ""}`;
        target.style.left = `${5.556 + col * 11.111}%`;
        target.style.top = `${5 + row * 10}%`;
        target.tabIndex = targetMove ? 0 : -1;
        target.setAttribute("aria-label", `${row + 1}行${col + 1}列${targetMove ? "，可以走到这里" : ""}`);
        target.addEventListener("click", () => handleSquare(row, col));
        boardElement.appendChild(target);
      }
    }

    board.forEach((boardRow, row) => {
      boardRow.forEach((piece, col) => {
        if (!piece) return;
        const pieceButton = document.createElement("button");
        const wasFrom = sameSquare(current.lastMove && current.lastMove.from, row, col);
        const wasTo = sameSquare(current.lastMove && current.lastMove.to, row, col);
        pieceButton.type = "button";
        pieceButton.className = [
          "piece",
          piece.color,
          sameSquare(selected, row, col) ? "selected" : "",
          sameSquare(hinted, row, col) ? "hinted" : "",
          wasFrom || wasTo ? "last-move" : "",
        ].filter(Boolean).join(" ");
        pieceButton.style.left = `${5.556 + col * 11.111}%`;
        pieceButton.style.top = `${5 + row * 10}%`;
        pieceButton.textContent = pieceNames[piece.color][piece.type];
        pieceButton.setAttribute(
          "aria-label",
          `${piece.color === "red" ? "红方" : "黑方"}${pieceNames[piece.color][piece.type]}，${row + 1}行${col + 1}列`,
        );
        pieceButton.addEventListener("click", () => handleSquare(row, col));
        boardElement.appendChild(pieceButton);
      });
    });

    statusTitleElement.textContent = statusTitle(current);
    messageElement.textContent = message;
    faceElement.classList.toggle("thinking", thinking);
    blackLabelElement.textContent = thinking ? "正在想…" : "电脑朋友 · 黑方";
    blackTurnElement.classList.toggle("active", current.turn === "black" && !current.result);
    redTurnElement.classList.toggle("active", current.turn === "red" && !current.result);
    undoButton.disabled = history.length === 1;
    resetButton.classList.toggle("confirm", confirmReset);
    resetButton.querySelector("strong").textContent = confirmReset ? "确定重来" : "重新开始";
    resetButton.querySelector("small").textContent = confirmReset ? "再点一次就重摆" : "换一盘也没关系";
  }

  function handleSquare(row, col) {
    const current = snapshot();
    if (thinking || current.result || current.turn !== "red") return;
    const piece = current.board[row][col];
    const redMoves = getLegalMoves(current.board, "red");

    if (piece && piece.color === "red") {
      selected = [row, col];
      hinted = null;
      const count = redMoves.filter((move) => move.from[0] === row && move.from[1] === col).length;
      message = count
        ? `选中了${pieceNames.red[piece.type]}。再点它要去的位置。`
        : "这枚棋子现在动不了，再看看别的。";
      vibrate();
      render();
      return;
    }

    if (!selected) {
      message = piece ? "这是小木的棋。先选一枚红棋吧。" : "先点一枚红棋，再点要走的位置。";
      render();
      return;
    }

    const move = redMoves.find(
      (item) =>
        item.from[0] === selected[0] &&
        item.from[1] === selected[1] &&
        item.to[0] === row &&
        item.to[1] === col,
    );
    if (!move) {
      message = isInCheck(current.board, "red")
        ? "现在被将军了，这样走还保护不了帅。"
        : "这里不能走。换个位置再看看。";
      vibrate();
      render();
      return;
    }
    moveChild(move);
  }

  function moveChild(move) {
    const current = snapshot();
    const nextBoard = applyMove(current.board, move);
    const result = resultAfter(nextBoard, "black");
    history.push({ board: nextBoard, turn: "black", lastMove: move, result });
    selected = null;
    hinted = null;
    vibrate();

    if (result && result.winner === "red") {
      message = "将死！这一盘你赢啦。你认真想出来的！";
    } else if (isInCheck(nextBoard, "black")) {
      message = "将军！这一步很有力量。";
    } else {
      message = dangerAfterMove(nextBoard) || "走得好。现在轮到小木想一想。";
    }
    save();
    render();
    if (!result) scheduleComputer();
  }

  function scheduleComputer() {
    const current = snapshot();
    if (current.turn !== "black" || current.result) return;
    if (aiTimer) clearTimeout(aiTimer);
    thinking = true;
    selected = null;
    hinted = null;
    message = "小木正在认真想一想…";
    render();

    aiTimer = setTimeout(() => {
      const latest = snapshot();
      if (latest.turn !== "black" || latest.result) return;
      const move = chooseComputerMove(
        latest.board,
        difficulty,
        history.map((item) => positionKey(item.board, item.turn)),
      );
      if (!move) {
        thinking = false;
        render();
        return;
      }
      const nextBoard = applyMove(latest.board, move);
      const result = resultAfter(nextBoard, "red");
      history.push({ board: nextBoard, turn: "red", lastMove: move, result });
      thinking = false;
      aiTimer = null;
      if (result && result.winner === "black") {
        message = "这盘小木赢了。没关系，悔一步或者再来一盘都可以。";
      } else if (isInCheck(nextBoard, "red")) {
        message = "现在被将军了。先找找怎么保护帅。";
      } else {
        message = describeMove(move);
      }
      save();
      render();
    }, 520 + Math.random() * 380);
  }

  function undo() {
    if (history.length === 1) {
      message = "这盘还没走呢。";
      render();
      return;
    }
    if (aiTimer) {
      clearTimeout(aiTimer);
      aiTimer = null;
    }
    thinking = false;
    let index = history.length - 2;
    while (index >= 0 && history[index].turn !== "red") index -= 1;
    history = history.slice(0, Math.max(0, index) + 1);
    selected = null;
    hinted = null;
    confirmReset = false;
    message = "悔好啦。再想一次，想多久都可以。";
    vibrate();
    save();
    render();
  }

  function hint() {
    const current = snapshot();
    if (current.result) {
      message = current.result.winner === "red" ? "你已经赢啦！可以开始新的一盘。" : "可以悔一步，再试试看。";
    } else if (current.turn === "black") {
      message = "先等小木走好这一步。";
    } else if (isInCheck(current.board, "red")) {
      hinted = null;
      message = "现在被将军了。看看帅能不能躲开，或者谁能来帮忙？";
    } else {
      const gentleHint = findGentleHint(current.board);
      if (gentleHint) {
        hinted = gentleHint.at;
        selected = null;
        message = gentleHint.text;
      }
    }
    render();
  }

  function reset() {
    if (!confirmReset) {
      confirmReset = true;
      message = "再点一次“确定重来”，棋子就会重新摆好。";
      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => {
        confirmReset = false;
        render();
      }, 3200);
      render();
      return;
    }
    if (aiTimer) clearTimeout(aiTimer);
    history = newGame();
    selected = null;
    hinted = null;
    thinking = false;
    confirmReset = false;
    message = "新的一盘开始啦。你执红棋，先走。";
    save();
    render();
  }

  difficultyElement.addEventListener("change", () => {
    difficulty = Number(difficultyElement.value);
    message = `难度调到${["", "一级 · 轻松", "二级 · 刚好", "三级 · 认真"][difficulty]}。`;
    save();
    render();
  });
  undoButton.addEventListener("click", undo);
  hintButton.addEventListener("click", hint);
  resetButton.addEventListener("click", reset);

  load();
  render();
  if (snapshot().turn === "black" && !snapshot().result) scheduleComputer();
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => undefined);
  }
})();
