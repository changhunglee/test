import { useState, useRef, useEffect, useCallback } from "react";

const PIECE_UNICODE = {
  K: { w: "♔", b: "♚" }, Q: { w: "♕", b: "♛" }, R: { w: "♖", b: "♜" },
  B: { w: "♗", b: "♝" }, N: { w: "♘", b: "♞" }, P: { w: "♙", b: "♟" },
};

const INIT_BOARD = () => {
  const b = Array(8).fill(null).map(() => Array(8).fill(null));
  const back = ["R","N","B","Q","K","B","N","R"];
  for (let i = 0; i < 8; i++) {
    b[0][i] = { type: back[i], color: "b" };
    b[1][i] = { type: "P", color: "b" };
    b[6][i] = { type: "P", color: "w" };
    b[7][i] = { type: back[i], color: "w" };
  }
  return b;
};

const FILES = "abcdefgh";
const algToCoord = (s) => [8 - parseInt(s[1]), FILES.indexOf(s[0])];
function cloneBoard(b) { return b.map(row => row.map(cell => cell ? { ...cell } : null)); }

function findKing(board, color) {
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++)
    if (board[r][c]?.type === "K" && board[r][c]?.color === color) return [r, c];
  return null;
}

function isSquareAttacked(board, r, c, byColor) {
  const dir = byColor === "w" ? 1 : -1;
  if (r - dir >= 0 && r - dir < 8) {
    if (c - 1 >= 0 && board[r - dir][c - 1]?.type === "P" && board[r - dir][c - 1]?.color === byColor) return true;
    if (c + 1 < 8 && board[r - dir][c + 1]?.type === "P" && board[r - dir][c + 1]?.color === byColor) return true;
  }
  for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
    const nr = r + dr, nc = c + dc;
    if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && board[nr][nc]?.type === "N" && board[nr][nc]?.color === byColor) return true;
  }
  for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]]) {
    for (let i = 1; i < 8; i++) {
      const nr = r + dr * i, nc = c + dc * i;
      if (nr < 0 || nr >= 8 || nc < 0 || nc >= 8) break;
      const p = board[nr][nc];
      if (p) {
        if (p.color === byColor) {
          const isDiag = dr !== 0 && dc !== 0;
          if (isDiag && (p.type === "B" || p.type === "Q")) return true;
          if (!isDiag && (p.type === "R" || p.type === "Q")) return true;
          if (i === 1 && p.type === "K") return true;
        }
        break;
      }
    }
  }
  return false;
}

function isInCheck(board, color) {
  const king = findKing(board, color);
  if (!king) return false;
  return isSquareAttacked(board, king[0], king[1], color === "w" ? "b" : "w");
}

function applyMoveRaw(board, fr, fc, tr, tc, promo) {
  const nb = cloneBoard(board);
  const piece = nb[fr][fc];
  if (!piece) return nb;
  if (piece.type === "K" && Math.abs(tc - fc) === 2) {
    if (tc > fc) { nb[fr][5] = nb[fr][7]; nb[fr][7] = null; }
    else { nb[fr][3] = nb[fr][0]; nb[fr][0] = null; }
  }
  if (piece.type === "P" && tc !== fc && !nb[tr][tc]) nb[fr][tc] = null;
  nb[tr][tc] = { ...piece }; nb[fr][fc] = null;
  if (piece.type === "P" && (tr === 0 || tr === 7)) nb[tr][tc] = { type: promo || "Q", color: piece.color };
  return nb;
}

function getLegalMoves(board, fr, fc, lastMoveData, castleRights) {
  const piece = board[fr][fc]; if (!piece) return [];
  const color = piece.color; const moves = [];
  const tryMove = (tr, tc, promo) => { const nb = applyMoveRaw(board, fr, fc, tr, tc, promo); if (!isInCheck(nb, color)) moves.push({ tr, tc, promo }); };
  if (piece.type === "P") {
    const dir = color === "w" ? -1 : 1, startRow = color === "w" ? 6 : 1, promoRow = color === "w" ? 0 : 7;
    if (fr + dir >= 0 && fr + dir < 8 && !board[fr + dir][fc]) {
      if (fr + dir === promoRow) { for (const p of ["Q","R","B","N"]) tryMove(fr + dir, fc, p); }
      else { tryMove(fr + dir, fc); if (fr === startRow && !board[fr + 2 * dir][fc]) tryMove(fr + 2 * dir, fc); }
    }
    for (const dc of [-1, 1]) {
      const nc = fc + dc; if (nc < 0 || nc > 7) continue;
      const tr = fr + dir; if (tr < 0 || tr > 7) continue;
      if (board[tr][nc] && board[tr][nc].color !== color) { if (tr === promoRow) { for (const p of ["Q","R","B","N"]) tryMove(tr, nc, p); } else tryMove(tr, nc); }
      if (!board[tr][nc] && lastMoveData) { const epRow = color === "w" ? 3 : 4; if (fr === epRow && lastMoveData.piece === "P" && Math.abs(lastMoveData.fr - lastMoveData.tr) === 2 && lastMoveData.tc === nc) tryMove(tr, nc); }
    }
  } else if (piece.type === "N") {
    for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) { const nr = fr + dr, nc = fc + dc; if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && (!board[nr][nc] || board[nr][nc].color !== color)) tryMove(nr, nc); }
  } else if (piece.type === "K") {
    for (const [dr, dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) { const nr = fr + dr, nc = fc + dc; if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && (!board[nr][nc] || board[nr][nc].color !== color)) tryMove(nr, nc); }
    const row = color === "w" ? 7 : 0;
    if (fr === row && fc === 4 && castleRights) {
      const opp = color === "w" ? "b" : "w";
      if (castleRights[color+"K"] && board[row][7]?.type === "R" && board[row][7]?.color === color && !board[row][5] && !board[row][6] && !isSquareAttacked(board, row, 4, opp) && !isSquareAttacked(board, row, 5, opp) && !isSquareAttacked(board, row, 6, opp)) tryMove(row, 6);
      if (castleRights[color+"Q"] && board[row][0]?.type === "R" && board[row][0]?.color === color && !board[row][1] && !board[row][2] && !board[row][3] && !isSquareAttacked(board, row, 4, opp) && !isSquareAttacked(board, row, 3, opp) && !isSquareAttacked(board, row, 2, opp)) tryMove(row, 2);
    }
  } else {
    const isDiag = piece.type === "B" || piece.type === "Q", isStraight = piece.type === "R" || piece.type === "Q", dirs = [];
    if (isDiag) dirs.push([-1,-1],[-1,1],[1,-1],[1,1]); if (isStraight) dirs.push([-1,0],[1,0],[0,-1],[0,1]);
    for (const [dr, dc] of dirs) { for (let i = 1; i < 8; i++) { const nr = fr + dr * i, nc = fc + dc * i; if (nr < 0 || nr >= 8 || nc < 0 || nc >= 8) break; if (board[nr][nc]) { if (board[nr][nc].color !== color) tryMove(nr, nc); break; } tryMove(nr, nc); } }
  }
  return moves;
}

function generateSAN(board, fr, fc, tr, tc, promo, castleRights, lastMoveData) {
  const piece = board[fr][fc]; if (!piece) return "?";
  const color = piece.color;
  if (piece.type === "K" && Math.abs(tc - fc) === 2) return tc > fc ? "O-O" : "O-O-O";
  let san = ""; const isCapture = !!board[tr][tc] || (piece.type === "P" && fc !== tc);
  if (piece.type === "P") { if (isCapture) san += FILES[fc] + "x"; san += FILES[tc] + (8 - tr); if (promo) san += "=" + promo; }
  else {
    san += piece.type; let ambig = [];
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { if (r === fr && c === fc) continue; const p = board[r][c]; if (!p || p.type !== piece.type || p.color !== color) continue; if (getLegalMoves(board, r, c, lastMoveData, castleRights).some(m => m.tr === tr && m.tc === tc)) ambig.push([r, c]); }
    if (ambig.length > 0) { if (ambig.every(([, c]) => c !== fc)) san += FILES[fc]; else if (ambig.every(([r]) => r !== fr)) san += (8 - fr); else san += FILES[fc] + (8 - fr); }
    if (isCapture) san += "x"; san += FILES[tc] + (8 - tr);
  }
  const nb = applyMoveRaw(board, fr, fc, tr, tc, promo); const opp = color === "w" ? "b" : "w";
  if (isInCheck(nb, opp)) { let hasLegal = false; outer: for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { if (nb[r][c]?.color === opp && getLegalMoves(nb, r, c, { piece: piece.type, fr, fc, tr, tc }, castleRights).length > 0) { hasLegal = true; break outer; } } san += hasLegal ? "+" : "#"; }
  return san;
}

function parseMove(board, moveStr, color, lastMove) {
  let m = moveStr.replace(/[+#!?=]/g, "").trim(); if (!m) return null;
  if (m === "0-0" || m === "O-O") { const r = color === "w" ? 7 : 0; return { fr: r, fc: 4, tr: r, tc: 6 }; }
  if (m === "0-0-0" || m === "O-O-O") { const r = color === "w" ? 7 : 0; return { fr: r, fc: 4, tr: r, tc: 2 }; }
  let promo = null; const pm = m.match(/([QRBN])$/);
  if (pm && m.length > 2) { if (m[m.length - 2] >= '1' && m[m.length - 2] <= '8') { promo = pm[1]; m = m.slice(0, -1); } }
  m = m.replace("x", "");
  let pieceType, fileHint = null, rankHint = null, targetSq;
  if (m[0] >= "a" && m[0] <= "h") { pieceType = "P"; if (m.length === 2) targetSq = m; else if (m.length === 3) { fileHint = m[0]; targetSq = m.slice(1); } else if (m.length === 4) { fileHint = m[0]; targetSq = m.slice(2); } }
  else { pieceType = m[0]; if (m.length === 3) targetSq = m.slice(1); else if (m.length === 4) { const h = m[1]; if (h >= "a" && h <= "h") fileHint = h; else if (h >= "1" && h <= "8") rankHint = h; targetSq = m.slice(2); } else if (m.length === 5) { fileHint = m[1]; rankHint = m[2]; targetSq = m.slice(3); } }
  if (!targetSq || targetSq.length !== 2) return null;
  const [tr, tc] = algToCoord(targetSq); if (tr < 0 || tr > 7 || tc < 0 || tc > 7) return null;
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const p = board[r][c]; if (!p || p.color !== color || p.type !== pieceType) continue;
    if (fileHint && FILES[c] !== fileHint) continue; if (rankHint && String(8 - r) !== rankHint) continue;
    if (pieceType === "P") {
      const dir = color === "w" ? -1 : 1;
      if (tc === c) { if (r + dir === tr && !board[tr][tc]) { const nb = applyMoveRaw(board, r, c, tr, tc, promo); if (!isInCheck(nb, color)) return { fr: r, fc: c, tr, tc, promo }; } const sR = color === "w" ? 6 : 1; if (r === sR && r + 2 * dir === tr && !board[r + dir][c] && !board[tr][tc]) { const nb = applyMoveRaw(board, r, c, tr, tc, promo); if (!isInCheck(nb, color)) return { fr: r, fc: c, tr, tc, promo }; } }
      else if (Math.abs(tc - c) === 1 && r + dir === tr) { if (board[tr][tc] && board[tr][tc].color !== color) { const nb = applyMoveRaw(board, r, c, tr, tc, promo); if (!isInCheck(nb, color)) return { fr: r, fc: c, tr, tc, promo }; } if (!board[tr][tc] && lastMove) { const epRow = color === "w" ? 3 : 4; if (r === epRow && lastMove.piece === "P" && Math.abs(lastMove.fr - lastMove.tr) === 2 && lastMove.tc === tc) { const nb = applyMoveRaw(board, r, c, tr, tc, promo); if (!isInCheck(nb, color)) return { fr: r, fc: c, tr, tc, promo }; } } }
    } else if (pieceType === "N") { const dr = Math.abs(tr - r), dc2 = Math.abs(tc - c); if ((dr === 2 && dc2 === 1) || (dr === 1 && dc2 === 2)) { const nb = applyMoveRaw(board, r, c, tr, tc); if (!isInCheck(nb, color)) return { fr: r, fc: c, tr, tc }; } }
    else if (pieceType === "K") { if (Math.abs(tr - r) <= 1 && Math.abs(tc - c) <= 1) { const nb = applyMoveRaw(board, r, c, tr, tc); if (!isInCheck(nb, color)) return { fr: r, fc: c, tr, tc }; } }
    else { const isDiag = pieceType === "B" || pieceType === "Q", isStraight = pieceType === "R" || pieceType === "Q", dirs = []; if (isDiag) dirs.push([-1,-1],[-1,1],[1,-1],[1,1]); if (isStraight) dirs.push([-1,0],[1,0],[0,-1],[0,1]); for (const [dr, dc] of dirs) { let blocked = false; for (let i = 1; i < 8; i++) { const nr = r + dr * i, nc = c + dc * i; if (nr < 0 || nr >= 8 || nc < 0 || nc >= 8) break; if (nr === tr && nc === tc && !blocked) { const nb = applyMoveRaw(board, r, c, tr, tc); if (!isInCheck(nb, color)) return { fr: r, fc: c, tr, tc }; break; } if (board[nr][nc]) blocked = true; } } }
  }
  return null;
}

function buildLines() {
  const cm = "1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.c3 Nf6 5.d4 exd4";
  const lines = [
    { id: "line1", name: "Greco Attack (Main)", color: "#e74c3c", cat: "gp", moves: cm+" 6.cxd4 Bb4+ 7.Bd2 Bxd2+ 8.Nbxd2 d5 9.exd5 Nxd5 10.Qb3 Na5 11.Qa4 Nc6 12.Bb5 Qe7+ 13.Ne5 Bd7" },
    { id: "line2", name: "Kf1 d5", color: "#3498db", cat: "gp", moves: cm+" 6.cxd4 Bb4+ 7.Kf1 d5 8.exd5 Nxd5 9.Nc3 Be6 10.Qe2 Bxc3 11.bxc3 Nxc3 12.Qe1 Nd5 13.Ba3 a6" },
    { id: "line3", name: "Moller: 0-0 Bxc3", color: "#2ecc71", cat: "gp", moves: cm+" 6.cxd4 Bb4+ 7.Nc3 Nxe4 8.0-0 Bxc3 9.d5 Bf6 10.Re1 Ne7 11.Rxe4 d6 12.Bg5 Bxg5 13.Nxg5 h6" },
    { id: "line5", name: "Bd2 Bxd2+ exd5", color: "#9b59b6", cat: "gp", moves: cm+" 6.cxd4 Bb4+ 7.Bd2 Bxd2+ 8.Nbxd2 exd5 9.exd5 Nxd5 10.Qb3 Bg5 11.Bxd5 Nxd5 12.Qxe4 Nxd5 13.Bxe7 Nxe7" },
    { id: "line5r", name: "Bd2 d5 (r)", color: "#9b59b6", cat: "gp", moves: cm+" 6.cxd4 Bb4+ 7.Bd2 d5 8.exd5 Nxd5 9.0-0 Be6 10.Bg5 Be7 11.Bxd5 Bxd5 12.Nxd5 Qxd5 13.Bxe7 Nxe7" },
    { id: "line6", name: "e5 d5 (Bd3)", color: "#1abc9c", cat: "gp", moves: cm+" 6.e5 d5 7.Bb5 Ne4 8.cxd4 Bb6 9.Nc3 0-0 10.Be3 Ne7 11.0-0 Bd3 12.Bd3 Nxc3 13.bxc3 Bf5" },
    { id: "line6w", name: "e5 d5 (c6)", color: "#1abc9c", cat: "gp", moves: cm+" 6.e5 d5 7.Bb5 Ne4 8.cxd4 Bb6 9.Nc3 0-0 10.Be3 Ne7 11.0-0 c6 12.Bd3 Nxc3 13.bxc3 Bf5" },
    { id: "line11o", name: "Greco: Qa4 Nc6", color: "#e67e22", cat: "gp", moves: cm+" 6.cxd4 Bb4+ 7.Bd2 Bxd2+ 8.Nbxd2 d5 9.exd5 Nxd5 10.Qb3 Na5 11.Qa4 Nc6 12.Bb5 Qe7+ 13.Ne5 Bd7" },
  ];
  const c2 = "1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.c3 Nf6";
  lines.push({ id: "t2_col7", name: "d3 Main (a-e)", color: "#ff6b6b", cat: "d3", moves: c2+" 5.d3 a6 6.0-0 Ba7 7.Bb3 0-0 8.h3 d5 9.Nbd2 dxe4 10.dxe4 Qe7 11.Nh2 Nd8" });
  lines.push({ id: "t2_col8", name: "Re1 d6 (f-g)", color: "#ffeaa7", cat: "d3", moves: c2+" 5.d3 a6 6.0-0 Ba7 7.Re1 d6 8.Bb3 0-0 9.h3 h6 10.Nbd2 Be6 11.Nf1 Re8" });
  lines.push({ id: "t2_col9", name: "Nbd2 Qe2 (h-i)", color: "#96ceb4", cat: "d3", moves: c2+" 5.d3 a6 6.Nbd2 Ba7 7.Bb3 0-0 8.h3 d5 9.Qe2 Re8 10.Nf1 Be6 11.Ng5 Na5" });
  lines.push({ id: "t2_col10", name: "b4 Bb6 (j-l)", color: "#45b7d1", cat: "d3", moves: c2+" 5.d3 a6 6.b4 Bb6 7.a4 a6 8.0-0 d6 9.Bg5 h6 10.Bh4 g5 11.Bg3 Bg4" });
  lines.push({ id: "t2_col11", name: "b4 a5 (m-o)", color: "#9b59b6", cat: "d3", moves: c2+" 5.d3 a6 6.b4 Bb6 7.a4 a5 8.b5 Ne7 9.0-0 0-0 10.Nbd2 Ng6 11.Ba3 Qe7" });
  lines.push({ id: "t2_col12p", name: "Bg5 Ng6 (p)", color: "#e67e22", cat: "d3", moves: c2+" 5.d3 a6 6.b4 Bb6 7.a4 a5 8.b5 Ne7 9.0-0 0-0 10.Nbd2 Bg5 11.Ng6 Ng6" });
  lines.push({ id: "t2_col12q", name: "Nh4 Nxh4 (q)", color: "#e67e22", cat: "d3", moves: c2+" 5.d3 a6 6.b4 Bb6 7.a4 a5 8.b5 Ne7 9.0-0 0-0 10.Nbd2 Bg5 11.Nh4 Nxh4" });
  const c3 = "1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5";
  lines.push({ id: "col13", name: "c3 Bb6 d4 Qe7", color: "#ff4757", cat: "other", moves: c3+" 4.c3 Bb6 5.d4 Qe7 6.0-0 d6 7.h3 Nf6 8.Re1 0-0 9.a4 a6 10.Na3 Kh8 11.Nc2 Ng8" });
  lines.push({ id: "col14", name: "c3 d6 exd4 Bb6", color: "#5352ed", cat: "other", moves: c3+" 4.c3 d6 5.d4 exd4 6.cxd4 Bb6 7.Nc3 Nf6 8.Be3 0-0 9.Bb3 Bg4 10.Qd3 Qe7 11.Nd2 Be6" });
  lines.push({ id: "col15", name: "b4 Bb6 d3", color: "#ffa502", cat: "other", moves: c3+" 4.c3 Nf6 5.b4 Bb6 6.d3 d6 7.0-0 Ne7 8.Nbd2 c6 9.Re1 0-0 10.a4 Ng6 11.a5 Bc7" });
  lines.push({ id: "col16", name: "Nc3 Bg5 Bxf6", color: "#2ed573", cat: "other", moves: c3+" 4.Nc3 Nf6 5.d3 d6 6.Bg5 h6 7.Bxf6 Qxf6 8.Nd5 Qd8 9.c3 Ne7 10.d4 Nxd5 11.dxc5 Nf4" });
  lines.push({ id: "col17", name: "Na5 Bb3", color: "#ff6348", cat: "other", moves: c3+" 4.c3 Nf6 5.d3 d6 6.h3 Na5 7.Bb3 c6 8.d4 Nxb3 9.axb3 exd4 10.Nxd4 h6 11.Bh4 0-0" });
  lines.push({ id: "col18", name: "0-0 Bxd4", color: "#a29bfe", cat: "other", moves: c3+" 4.0-0 Nf6 5.d4 Bxd4 6.Nxd4 Nxd4 7.Bg5 d6 8.f4 Qe7 9.fxe5 dxe5 10.c3 Ne6 11.Bxe6 Bxe6" });
  const ev = "1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.b4";
  lines.push({ id: "evans1", name: "Ba5 0-0 Qb3", color: "#e74c3c", cat: "evans", moves: ev+" Bxb4 5.c3 Ba5 6.0-0 d6 7.d4 Bb6 8.dxe5 dxe5 9.Qb3 Qf6 10.Bg5 Qg6 11.Bd5 f6 12.Bxg8 fxg5" });
  lines.push({ id: "evans2", name: "d4 0-0 Ba3", color: "#3498db", cat: "evans", moves: ev+" Bxb4 5.c3 Ba5 6.d4 exd4 7.0-0 Nge7 8.cxd4 d5 9.exd5 Nxd5 10.Ba3 Be6 11.Bb5 f6 12.Qa4 Bb6" });
  lines.push({ id: "evans3", name: "dxc3 Qb3 e5", color: "#2ecc71", cat: "evans", moves: ev+" Bxb4 5.c3 Ba5 6.d4 exd4 7.0-0 dxc3 8.Qb3 Qf6 9.e5 Qg6 10.Nxc3 Nge7 11.Ba3 0-0 12.Rad1 Rb8" });
  lines.push({ id: "evans4", name: "d6 Qb3 Nbd2", color: "#f39c12", cat: "evans", moves: ev+" Bxb4 5.c3 Ba5 6.d4 d6 7.Qb3 Qd7 8.Nbd2 Bb6 9.a4 Nf6 10.a5 Nxa5 11.Rxa5 Bxa5 12.dxe5 Ng4" });
  lines.push({ id: "evans5", name: "Be7 d4 Qh4", color: "#9b59b6", cat: "evans", moves: ev+" Bxb4 5.c3 Be7 6.d4 Na5 7.Be2 exd4 8.Qxd4 Nf6 9.e5 Nc6 10.Qh4 Nd5 11.Qg3 g6 12.0-0 Nb6" });
  lines.push({ id: "evans6", name: "Bb6 Declined", color: "#1abc9c", cat: "evans", moves: ev+" Bb6 5.a4 a6 6.Nc3 Nf6 7.Nd5 Nxd5 8.exd5 Nd4 9.a5 Ba7 10.d6 cxd6 11.0-0 0-0 12.Nxd4 Bxd4" });
  const tk0 = "1.e4 e5 2.Nf3 Nc6 3.Bc4 Nf6 4.Ng5 d5 5.exd5 Na5 6.Bb5+ c6 7.dxc6 bxc6 8.Be2 h6";
  lines.push({ id: "tk1", name: "Nf3 Ne5 d4 b3", color: "#e74c3c", cat: "tk", moves: tk0+" 9.Nf3 e4 10.Ne5 Bd6 11.d4 exd3 12.Nxd3 Qc7 13.b3 0-0 14.Bb2 Ne4 15.Nc3 f5 16.h3 Ba6" });
  lines.push({ id: "tk2", name: "f4 exf3 d4", color: "#3498db", cat: "tk", moves: tk0+" 9.Nf3 e4 10.Ne5 Bd6 11.f4 exf3 12.Nxf3 0-0 13.d4 Re8 14.0-0 Bg4 15.Nc3 Bc7 16.Ne5 Bxe2" });
  lines.push({ id: "tk3", name: "Bc5 c3 f4", color: "#2ecc71", cat: "tk", moves: tk0+" 9.Nf3 e4 10.Ne5 Bc5 11.c3 Bd6 12.f4 exf3 13.Nxf3 0-0 14.d4 Re8 15.0-0 c5 16.Kh1 cxd4" });
  lines.push({ id: "tk4", name: "Qd4 f4 Qa4", color: "#f39c12", cat: "tk", moves: tk0+" 9.Nf3 e4 10.Ne5 Qd4 11.f4 Bc5 12.Rf1 Qd8 13.c3 Nd5 14.Qa4 0-0 15.Qxe4 Re8 16.d4 Bb6" });
  lines.push({ id: "tk5", name: "Nh3 Bc5 d3", color: "#9b59b6", cat: "tk", moves: tk0+" 9.Nh3 Bc5 10.0-0 0-0 11.d3 Nb7 12.Nc3 Nd5 13.Bf3 Bb6 14.Qe2 Re8 15.Re1 Nc5 16.Nf4 Nb4" });
  lines.push({ id: "tk6", name: "Bd6 d3 Nc3", color: "#1abc9c", cat: "tk", moves: tk0+" 9.Nf3 Bd6 10.d3 0-0 11.Nc3 Nd5 12.Ne4 Bc7 13.c4 Ne7 14.0-0 f5 15.Nc3 g5 16.Kh1 Ng6" });
  const tkB = "1.e4 e5 2.Nf3 Nc6 3.Bc4 Nf6 4.Ng5";
  lines.push({ id: "tk7", name: "Bb5+ Qf3 Bd3", color: "#e74c3c", cat: "tk", moves: tkB+" d5 5.exd5 Na5 6.Bb5+ c6 7.dxc6 bxc6 8.Qf3 Rb8 9.Bd3 h6 10.Ne4 Nd5 11.b3 g6 12.Qg3 Nf4" });
  lines.push({ id: "tk8", name: "d3 Qe2 h3", color: "#3498db", cat: "tk", moves: tkB+" d5 5.exd5 Na5 6.d3 h6 7.Nf3 e4 8.Qe2 Nxc4 9.dxc4 Bc5 10.h3 0-0 11.Nh2 c6 12.dxc6 e3" });
  lines.push({ id: "tk9", name: "Fritz Nd4 c3", color: "#2ecc71", cat: "tk", moves: tkB+" d5 5.exd5 Nd4 6.c3 b5 7.Bf1 Nxd5 8.Ne4 Qh4 9.Ng3 Bb7 10.cxd4 0-0 11.Be2 Nf4 12.0-0 Rxd4" });
  lines.push({ id: "tk10", name: "Ulvestad b5", color: "#f39c12", cat: "tk", moves: tkB+" d5 5.exd5 b5 6.Bf1 h6 7.Nf3 Qxd5 8.Nc3 Qe6 9.Bxb5 Bb7 10.Qe2 0-0-0 11.Bxc6 Qxc6 12.d3 e4" });
  lines.push({ id: "tk11", name: "Traxler Bc5", color: "#9b59b6", cat: "tk", moves: tkB+" Bc5 5.Bxf7+ Ke7 6.Bd5 Rf8 7.Nf3 Nd4 8.Nxd4 Bxd4 9.0-0 c6 10.c3 Bb6 11.Bb3 Qe8 12.Re1 Qg6" });
  lines.push({ id: "tk12", name: "Nxf7 Bxf2+", color: "#1abc9c", cat: "tk", moves: tkB+" d5 5.Nxf7 Bxf2+ 6.Kf1 Qe7 7.Nxh8 d5 8.exd5 Nd4 9.d6 Qxd6 10.Nf7 Qc5 11.d3 e4 12.c3 Bh4" });
  const tkD4 = "1.e4 e5 2.Nf3 Nc6 3.Bc4 Nf6 4.d4 exd4 5.0-0";
  lines.push({ id: "tk13", name: "Max Lange e5 Re1+", color: "#e74c3c", cat: "tk_d4", moves: tkD4+" Bc5 6.e5 d5 7.exf6 dxc4 8.Re1+ Be6 9.Ng5 Qd5 10.Nc3 Qf5 11.Nce4 0-0-0 12.g4 Qe5" });
  lines.push({ id: "tk14", name: "Max Lange fxg7 Bg5", color: "#3498db", cat: "tk_d4", moves: tkD4+" Bc5 6.e5 d5 7.exf6 dxc4 8.fxg7 Rg8 9.Bg5 Be7 10.Bxe7 Kxe7 11.Nbd2 Rxg7 12.Nxc4 Be6" });
  lines.push({ id: "tk15", name: "Max Lange Bf4 d6", color: "#2ecc71", cat: "tk_d4", moves: tkD4+" Bc5 6.e5 d5 7.Bf4 d6 8.exd6 Bxd6 9.Re1+ Kf8 10.Bxd6+ Qxd6 11.c3 Qc5 12.Nbd2 d3" });
  lines.push({ id: "tk16", name: "Nxe4 Re1 Qa5", color: "#f39c12", cat: "tk_d4", moves: tkD4+" Nxe4 6.Re1 d5 7.Bxd5 Qxd5 8.Nc3 Qa5 9.Nxe4 Be6 10.Neg5 0-0-0 11.Nxe6 fxe6 12.Rxe6 Bd6" });
  lines.push({ id: "tk17", name: "Nxe4 Qa4 Bg5", color: "#9b59b6", cat: "tk_d4", moves: tkD4+" Nxe4 6.Re1 d5 7.Bxd5 Qxd5 8.Nc3 Qa5 9.Nxe4 Be6 10.Bd2 Qa4 11.Bg5 h6 12.Bh4 Bb4" });
  lines.push({ id: "tk18", name: "Nxe4 Qh5 Bg5", color: "#1abc9c", cat: "tk_d4", moves: tkD4+" Nxe4 6.Re1 d5 7.Bxd5 Qxd5 8.Nc3 Qh5 9.Nxe4 Be6 10.Bg5 Bb4 11.c3 dxc3 12.bxc3 Ba5" });
  const tkM = "1.e4 e5 2.Nf3 Nc6 3.Bc4 Nf6";
  lines.push({ id: "tk19", name: "d4 e5 Bb5 0-0", color: "#e74c3c", cat: "tk_misc", moves: tkM+" 4.d4 exd4 5.e5 d5 6.Bb5 Ne4 7.Nxd4 Bc5 8.0-0 0-0 9.Bxc6 bxc6 10.Nxc6 Qh4 11.Be3 Ba6" });
  lines.push({ id: "tk20", name: "d4 e5 Bxc6 Be3", color: "#3498db", cat: "tk_misc", moves: tkM+" 4.d4 exd4 5.e5 d5 6.Bb5 Ne4 7.Nxd4 Bc5 8.Bxc6 bxc6 9.0-0 Bc5 10.Be3 Qe7 11.Re1 0-0" });
  lines.push({ id: "tk21", name: "d3 Be7 Bb3 exd5", color: "#2ecc71", cat: "tk_misc", moves: tkM+" 4.d3 Be7 5.0-0 0-0 6.Bb3 d5 7.exd5 Nxd5 8.Re1 Bg4 9.h3 Bh5 10.g4 Bg6 11.Nxe5 Nxe5" });
  lines.push({ id: "tk22", name: "d3 Re1 c3 Ba4", color: "#f39c12", cat: "tk_misc", moves: tkM+" 4.d3 Be7 5.0-0 0-0 6.Re1 d6 7.c3 Be6 8.Bb5 Bd7 9.Ba4 a6 10.Nbd2 b5 11.Bc2 Re8" });
  lines.push({ id: "tk23", name: "d3 c3 exd5 h3", color: "#9b59b6", cat: "tk_misc", moves: tkM+" 4.d3 Be7 5.0-0 0-0 6.c3 d5 7.exd5 Nxd5 8.Re1 Bg4 9.h3 Bh5 10.Nbd2 Nf4 11.Nf1 Na5" });
  lines.push({ id: "tk24", name: "Nc3 Nxe4 Bd3", color: "#1abc9c", cat: "tk_misc", moves: tkM+" 4.Nc3 Nxe4 5.Nxe4 d5 6.Bd3 dxe4 7.Bxe4 Bd6 8.d4 exd4 9.Bxc6+ bxc6 10.Qxd4 0-0 11.0-0 c5" });
  const rC = "1.e4 e5 2.Nf3 Nc6 3.Bb5 Bc5";
  lines.push({ id: "ruy1", name: "c3 f5 d4 Nfd2", color: "#e74c3c", cat: "ruy", moves: rC+" 4.c3 f5 5.d4 fxe4 6.Bxc6 dxc6 7.Nfd2 Bd6 8.dxe5 e3 9.fxe3 Bc5 10.0-0 Bxe3+" });
  lines.push({ id: "ruy2", name: "c3 f5 Nxe5 Qd5", color: "#3498db", cat: "ruy", moves: rC+" 4.c3 f5 5.d4 fxe4 6.Bxc6 dxc6 7.Nxe5 Qd5 8.Nxc6 bxc6 9.dxc5 Ba6 10.Qxd5 exd5" });
  lines.push({ id: "ruy3", name: "c3 Nge7 0-0 d4", color: "#2ecc71", cat: "ruy", moves: rC+" 4.c3 Nge7 5.0-0 Bb6 6.d4 exd4 7.cxd4 d5 8.exd5 Nxd5 9.Re1+ Be6 10.Bg5 Qd6" });
  lines.push({ id: "ruy4", name: "c3 Nf6 Qe2 e5", color: "#f39c12", cat: "ruy", moves: rC+" 4.c3 Nf6 5.d4 Bb6 6.Qe2 exd4 7.e5 0-0 8.cxd4 Re8 9.Be3 Ng4 10.Nc3 d6" });
  lines.push({ id: "ruy5", name: "c3 f5 0-0 dxe5", color: "#9b59b6", cat: "ruy", moves: rC+" 4.c3 f5 5.0-0 0-0 6.d4 Bb6 7.dxe5 Nxe4 8.Qd5 Nc5 9.Bg5 Ne7 10.Qd1 Ne4" });
  lines.push({ id: "ruy6", name: "0-0 Nd4 Nxd4 c3", color: "#1abc9c", cat: "ruy", moves: rC+" 4.0-0 Nd4 5.Nxd4 Bxd4 6.c3 Bb6 7.d4 c6 8.Bc4 d6 9.dxe5 dxe5 10.Qxd8+ Bxd8" });
  const rB = "1.e4 e5 2.Nf3 Nc6 3.Bb5 Nf6";
  lines.push({ id: "ruyB7", name: "0-0 Bc5 Nxe5", color: "#e74c3c", cat: "ruy_berlin", moves: rB+" 4.0-0 Bc5 5.Nxe5 Nxe4 6.Qe2 Nxe5 7.Qxe4 Qe7 8.Nc3 Ng6 9.Qxe7+ Bxe7 10.Nd5 Bd6 11.Re1+ Kd8" });
  lines.push({ id: "ruyB8", name: "Berlin Wall Nc3 h6", color: "#3498db", cat: "ruy_berlin", moves: rB+" 4.0-0 Nxe4 5.d4 Nd6 6.Bxc6 dxc6 7.dxe5 Nf5 8.Qxd8+ Kxd8 9.Nc3 h6 10.h3 Bd7 11.b3 Ke8" });
  lines.push({ id: "ruyB9", name: "Berlin Wall Rd1+", color: "#2ecc71", cat: "ruy_berlin", moves: rB+" 4.0-0 Nxe4 5.d4 Nd6 6.Bxc6 dxc6 7.dxe5 Nf5 8.Qxd8+ Kxd8 9.Rd1+ Ke8 10.Nc3 h6 11.h3 a5" });
  lines.push({ id: "ruyB10", name: "Ne4 Qe2 Nd4", color: "#f39c12", cat: "ruy_berlin", moves: rB+" 4.0-0 Nxe4 5.d4 Nd6 6.Bxc6 dxc6 7.dxe5 Ne4 8.Qe2 Bf5 9.Rd1 Qc8 10.Nd4 Bc5 11.b4 Bb6" });
  lines.push({ id: "ruyB11", name: "d4 e5 Ne4 Bxc6", color: "#9b59b6", cat: "ruy_berlin", moves: rB+" 4.d4 exd4 5.e5 Ne4 6.0-0 a6 7.Bxc6 dxc6 8.Qe2 Bf5 9.Rd1 Bc5 10.Be3 Qe7 11.Nxd4 Bxd4" });
  lines.push({ id: "ruyB12", name: "Qe2 c3 Bg5", color: "#1abc9c", cat: "ruy_berlin", moves: rB+" 4.Qe2 Bc5 5.c3 Qe7 6.d3 d6 7.Bg5 h6 8.Bh4 Bd7 9.Nbd2 a6 10.Ba4 g5" });
  const rCoz = "1.e4 e5 2.Nf3 Nc6 3.Bb5 Nge7";
  lines.push({ id: "ruyC13", name: "0-0 g6 c3 d4", color: "#e74c3c", cat: "ruy_cozio", moves: rCoz+" 4.0-0 g6 5.c3 Bg7 6.d4 exd4 7.cxd4 d5 8.exd5 Nxd5 9.Re1+ Be6 10.Bg5 Qd6 11.Nbd2 0-0" });
  lines.push({ id: "ruyC14", name: "c3 g6 d4 Nc3", color: "#3498db", cat: "ruy_cozio", moves: rCoz+" 4.c3 g6 5.d4 exd4 6.cxd4 d5 7.Nc3 Bg7 8.Bg5 f6 9.Be3 Be6 10.0-0 0-0 11.Re1 Bf7" });
  lines.push({ id: "ruyC15", name: "Nc3 Ng6 d4 h4", color: "#2ecc71", cat: "ruy_cozio", moves: rCoz+" 4.Nc3 Ng6 5.d4 exd4 6.Nxd4 Bc5 7.Be3 Bxd4 8.Bxd4 0-0 9.h4 d6 10.h5 Nge5 11.h6 Bg4" });
  const rBd = "1.e4 e5 2.Nf3 Nc6 3.Bb5 Nd4";
  lines.push({ id: "ruyBd16", name: "Nxd4 0-0 Bc5 c3", color: "#f39c12", cat: "ruy_bird", moves: rBd+" 4.Nxd4 exd4 5.0-0 Bc5 6.c3 c6 7.Ba4 Ne7 8.d3 d5 9.Nd2 Bb6 10.cxd4 Bxd4 11.Kh1 0-0" });
  lines.push({ id: "ruyBd17", name: "Nxd4 Bc4 c3 a4", color: "#9b59b6", cat: "ruy_bird", moves: rBd+" 4.Nxd4 exd4 5.0-0 Bc4 6.Bc4 d6 7.c3 c6 8.a4 Ne7 9.b4 Bb6 10.a5 Bc7 11.cxd4" });
  lines.push({ id: "ruyBd18", name: "Bc4 Bc5 Nxd4 c3", color: "#1abc9c", cat: "ruy_bird", moves: rBd+" 4.Bc4 Bc5 5.Nxd4 Bxd4 6.c3 Bb6 7.d4 Qe7 8.0-0 Nf6 9.a4 a6 10.Be3 Nxe4 11.Re1 0-0" });
  const rSt = "1.e4 e5 2.Nf3 Nc6 3.Bb5 d6";
  lines.push({ id: "ruyS19", name: "d4 Nc3 0-0 Bxc6", color: "#e74c3c", cat: "ruy_steinitz", moves: rSt+" 4.d4 Bd7 5.Nc3 Nf6 6.0-0 Be7 7.Bxc6 Bxc6 8.Qd3 exd4 9.Nxd4 Bd7 10.b3 0-0 11.Bb2 c6" });
  lines.push({ id: "ruyS20", name: "d4 Nxd4 g6 Bh6", color: "#3498db", cat: "ruy_steinitz", moves: rSt+" 4.d4 Bd7 5.Nc3 exd4 6.Nxd4 g6 7.Be3 Bg7 8.Qd2 Nf6 9.Bxc6 bxc6 10.Bh6 0-0 11.Bxg7 Kxg7" });
  lines.push({ id: "ruyS21", name: "d4 Nge7 Bc4 Qg3", color: "#2ecc71", cat: "ruy_steinitz", moves: rSt+" 4.d4 Bd7 5.Nc3 Nge7 6.Bc4 exd4 7.Nxd4 Nxd4 8.Qxd4 Nc6 9.Qe3 Ne5 10.Bb3 c6 11.Qg3 Ng6" });
  const rG6 = "1.e4 e5 2.Nf3 Nc6 3.Bb5 g6";
  lines.push({ id: "ruyG22", name: "c3 d6 d4 dxe5", color: "#f39c12", cat: "ruy_g6", moves: rG6+" 4.c3 d6 5.d4 Bd7 6.0-0 Bg7 7.dxe5 dxe5 8.Qe2 Nge7 9.Rd1 Qc8 10.Be3 0-0 11.Bc5 Rd8" });
  lines.push({ id: "ruyG23", name: "c3 a6 Bc4 Bg5", color: "#9b59b6", cat: "ruy_g6", moves: rG6+" 4.c3 a6 5.Bc4 Bg7 6.d4 d6 7.Bg5 Nge7 8.dxe5 dxe5 9.Qe2 0-0 10.a4 Qe8 11.Qe3 Kh8" });
  lines.push({ id: "ruyG24", name: "d4 Bg5! f6 Bh4", color: "#1abc9c", cat: "ruy_g6", moves: rG6+" 4.d4 exd4 5.Bg5 f6 6.Bh4 Bg7 7.Nxd4 Nge7 8.Nc3 0-0 9.0-0 Kh8 10.f4 Nxd4 11.Qxd4 d6" });
  const ruySchl = "1.e4 e5 2.Nf3 Nc6 3.Bb5 f5";
  lines.push({ id: "ruySchl25", name: "Nc3 Nxe4 Qe2", color: "#e74c3c", cat: "ruy_schl", moves: ruySchl+" 4.Nc3 fxe4 5.Nxe4 Nf6 6.Qe2 d5 7.Nxf6+ gxf6 8.d4 Bg7 9.dxe5 0-0 10.Bxc6 bxc6 11.e6 Re8" });
  lines.push({ id: "ruySchl26", name: "Nxf6+ Qe2 Bxc6", color: "#3498db", cat: "ruy_schl", moves: ruySchl+" 4.Nc3 fxe4 5.Nxe4 Nf6 6.Nxf6+ Qxf6 7.Qe2 Be7 8.Bxc6 dxc6 9.Nxe5 Bf5 10.0-0 0-0 11.d4 Bd6" });
  lines.push({ id: "ruySchl27", name: "d5 Nxe5 Qg5 f4", color: "#2ecc71", cat: "ruy_schl", moves: ruySchl+" 4.Nc3 fxe4 5.Nxe4 d5 6.Nxe5 dxe4 7.Nxc6 Qg5 8.Qe2 Nf6 9.f4 Qxf4 10.Ne5+ c6 11.d4 Qh4+" });
  lines.push({ id: "ruySchl28", name: "Nd4 Ba4 Nxe5", color: "#f39c12", cat: "ruy_schl", moves: ruySchl+" 4.Nc3 Nd4 5.Ba4 Nf6 6.Nxe5 Bc5 7.Nd3 Bb6 8.e5 Ne4 9.Nd5 0-0 10.0-0 c6 11.Nxb6 axb6" });
  lines.push({ id: "ruySchl29", name: "d4 Bxc6 Qh5+", color: "#9b59b6", cat: "ruy_schl", moves: ruySchl+" 4.d4 fxe4 5.Bxc6 dxc6 6.Nxe5 Bf5 7.0-0 Bd6 8.Qh5+ g6 9.Qe2 Qh4 10.Nc3 Nf6 11.f3 Bxe5" });
  lines.push({ id: "ruySchl30", name: "d3 0-0 Bc5 Bg5", color: "#1abc9c", cat: "ruy_schl", moves: ruySchl+" 4.d3 fxe4 5.dxe4 Nf6 6.0-0 Bc5 7.Nc3 d6 8.Bg5 0-0 9.Nd5 Kh8 10.Bc4 Be6 11.Nxf6 gxf6" });
  const ruyExch = "1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Bxc6 dxc6";
  lines.push({ id: "ruyEx1", name: "0-0 f6 d4 dxe5", color: "#e74c3c", cat: "ruy_exch", moves: ruyExch+" 5.0-0 f6 6.d4 Bg4 7.dxe5 Qxd1 8.Rxd1 fxe5 9.Rd3 Bd6 10.Nbd2 Nf6 11.b3 0-0-0 12.Bb2 Rhe8" });
  lines.push({ id: "ruyEx2", name: "Nxd4 c5 Nb3", color: "#3498db", cat: "ruy_exch", moves: ruyExch+" 5.0-0 f6 6.d4 exd4 7.Nxd4 c5 8.Nb3 Qxd1 9.Rxd1 Bg4 10.f3 Be6 11.Nc3 Bd6 12.Be3 b6" });
  lines.push({ id: "ruyEx3", name: "Qd6 d3 Ne7 Nc4", color: "#2ecc71", cat: "ruy_exch", moves: ruyExch+" 5.0-0 Qd6 6.d3 Ne7 7.Nbd2 Ng6 8.Nc4 Qf6 9.Bg5 Qe6 10.Bd2 Bc5 11.b4 Ba7 12.Be3 0-0" });
  lines.push({ id: "ruyEx4", name: "Bg4 h3 h5 Be3", color: "#f39c12", cat: "ruy_exch", moves: ruyExch+" 5.0-0 Bg4 6.h3 h5 7.d3 Qf6 8.Be3 Bxf3 9.Qxf3 Qxf3 10.gxf3 Bd6 11.Nd2 Ne7 12.Rfb1 f5" });
  lines.push({ id: "ruyEx5", name: "Bd6 Qxd4 f6 Nh6", color: "#9b59b6", cat: "ruy_exch", moves: ruyExch+" 5.0-0 Bd6 6.d4 exd4 7.Qxd4 f6 8.b3 Qe7 9.Nbd2 Nh6 10.Nc4 Bc5 11.Qd3 Nf7 12.Be3 0-0" });
  lines.push({ id: "ruyEx6", name: "d4 Qxd4 Bd7 0-0-0", color: "#1abc9c", cat: "ruy_exch", moves: ruyExch+" 5.d4 exd4 6.Qxd4 Qxd4 7.Nxd4 Bd7 8.Be3 0-0-0 9.Nd2 Ne7 10.0-0-0 Re8 11.Rhe1 Ng6 12.Ne2 Bd6" });
  const ruyMod0 = "1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 d6 5.c3";
  lines.push({ id: "ruyMod7", name: "Bd7 g6 0-0 Be3 h3", color: "#e74c3c", cat: "ruy_mod", moves: ruyMod0+" Bd7 6.d4 g6 7.0-0 Bg7 8.Be3 Nf6 9.Nbd2 0-0 10.h3 Qe8 11.Bxc6 Bxc6 12.dxe5 Nxe4 13.Nxe4 Bxe4" });
  lines.push({ id: "ruyMod8", name: "d5 Nce7 Bxd7+", color: "#3498db", cat: "ruy_mod", moves: ruyMod0+" Bd7 6.d4 g6 7.0-0 Bg7 8.d5 Nce7 9.Bxd7+ Qxd7 10.c4 h6 11.Nc3 f5 12.Ne1 Nf6 13.f3 0-0" });
  lines.push({ id: "ruyMod9", name: "Nge7 Ng6 d5 c4", color: "#2ecc71", cat: "ruy_mod", moves: ruyMod0+" Bd7 6.d4 Nge7 7.0-0 Ng6 8.d5 Nb8 9.c4 Be7 10.Nc3 h6 11.b4 a5 12.a3 0-0 13.Be3 Bxa4" });
  lines.push({ id: "ruyMod10", name: "Nf6 Qe7 Re1 Nf1", color: "#f39c12", cat: "ruy_mod", moves: ruyMod0+" Bd7 6.d4 Nf6 7.0-0 Qe7 8.Re1 g6 9.Nbd2 Bg7 10.Nf1 0-0 11.Bg5 h6 12.Bh4 Qe8 13.Bc2 Nh5" });
  lines.push({ id: "ruyMod11", name: "Siesta f5 Bc2 d4", color: "#9b59b6", cat: "ruy_mod", moves: ruyMod0+" f5 6.exf5 Bxf5 7.0-0 Bd3 8.Re1 Be7 9.Bc2 Bxc2 10.Qxc2 Nf6 11.d4 0-0 12.d5 e4 13.Ng5 Ne5" });
  lines.push({ id: "ruyMod12", name: "f5 Ng5 f3 h6!", color: "#1abc9c", cat: "ruy_mod", moves: ruyMod0+" f5 6.exf5 Bxf5 7.Ng5 d5 8.Re1 Be7 9.f3 h6 10.fxe4 hxg5 11.exf5 Bd6 12.Qf3 g4 13.Qxg4 Nf6" });
  const ruyMod2 = "1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 d6";
  lines.push({ id: "ruyMod13", name: "Bg4 h3 h5 d4", color: "#e74c3c", cat: "ruy_mod", moves: ruyMod2+" 5.0-0 Bg4 6.h3 h5 7.d4 b5 8.Bb3 Nxd4 9.hxg4 Nxb3 10.axb3 hxg4 11.Ng5 Qd7 12.c4 Rb8" });
  lines.push({ id: "ruyMod14", name: "Bd7 d4 b5 Nxd4", color: "#3498db", cat: "ruy_mod", moves: ruyMod2+" 5.0-0 Bd7 6.d4 b5 7.Bb3 Nxd4 8.Nxd4 exd4 9.c3 dxc3 10.Qh5 Qe7 11.Nxc3 Nf6 12.Qd1 c6" });
  lines.push({ id: "ruyMod15", name: "Bxc6+ d4 f6 Be3", color: "#2ecc71", cat: "ruy_mod", moves: ruyMod2+" 5.Bxc6+ bxc6 6.d4 f6 7.Be3 Ne7 8.Nc3 Ng6 9.Qe2 Be7 10.0-0-0 Be6 11.h4 h5 12.dxe5 fxe5" });
  lines.push({ id: "ruyMod16", name: "Bg4 Qxd4 c5 Bf4", color: "#f39c12", cat: "ruy_mod", moves: ruyMod2+" 5.0-0 Bg4 6.d4 exd4 7.Qxd4 c5 8.Qd3 g6 9.Nc3 Bg7 10.Bf4 Ne7 11.Qd2 0-0 12.Bh6 Bg4" });
  lines.push({ id: "ruyMod17", name: "c4 Bd7 Nc3 d4", color: "#9b59b6", cat: "ruy_mod", moves: ruyMod2+" 5.c4 Bd7 6.Nc3 g6 7.d4 Bg7 8.Nxd4 exd4 9.Be3 Nge7 10.0-0 0-0 11.h3 Nxd4 12.Bxd7 Ne2+" });
  lines.push({ id: "ruyMod18", name: "d4 b5 Bd5 Bc6+", color: "#1abc9c", cat: "ruy_mod", moves: ruyMod2+" 5.d4 b5 6.Bb3 Nxd4 7.Nxd4 exd4 8.Bd5 Rb8 9.Bc6+ Bd7 10.Bxd7+ Qxd7 11.Qxd4 Nf6 12.Nc3 Be7" });
  const ruyA6 = "1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.0-0";
  lines.push({ id: "ruyA19", name: "b5 Bc5 a4 c3 d4", color: "#e74c3c", cat: "ruy_a6bc5", moves: ruyA6+" b5 6.Bb3 Bc5 7.a4 Rb8 8.c3 0-0 9.d4 Bb6 10.axb5 axb5 11.dxe5 Ng4 12.Bf4 Qe8" });
  lines.push({ id: "ruyA20", name: "b5 c3 d6 a4 h3", color: "#3498db", cat: "ruy_a6bc5", moves: ruyA6+" b5 6.Bb3 Bc5 7.c3 d6 8.a4 Bg4 9.d3 0-0 10.h3 Bxf3 11.Qxf3 Na5 12.Bc2 b4" });
  lines.push({ id: "ruyA21", name: "b5 d3 d6 a4 Be3", color: "#2ecc71", cat: "ruy_a6bc5", moves: ruyA6+" b5 6.Bb3 Bc5 7.d3 d6 8.a4 Rb8 9.axb5 axb5 10.Be3 0-0 11.Nbd2 h6 12.Qe2 Nd7" });
  lines.push({ id: "ruyA22", name: "b5 Nxe5 d4 Bxd4", color: "#f39c12", cat: "ruy_a6bc5", moves: ruyA6+" b5 6.Bb3 Bc5 7.Nxe5 Nxe5 8.d4 Bxd4 9.Qxd4 d6 10.c3 c5 11.Qd1 0-0 12.f3 Bb7" });
  lines.push({ id: "ruyA23", name: "Bc5 c3 b5 Bc2 d4", color: "#9b59b6", cat: "ruy_a6bc5", moves: ruyA6+" Bc5 6.c3 b5 7.Bc2 d6 8.d4 Bb6 9.a4 Bg4 10.d5 Ne7 11.axb5 axb5 12.Rxa8 Qxa8" });
  lines.push({ id: "ruyA24", name: "Bc5 Nxe5 b5! Bxf2+", color: "#1abc9c", cat: "ruy_a6bc5", moves: ruyA6+" Bc5 6.Nxe5 Nxe5 7.d4 b5 8.dxe5 Nxe4 9.Bb3 Bb7 10.Bd5 Bxf2+ 11.Rxf2 Nxf2 12.Kxf2 Qh4+" });
  const ruyArk = "1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4";
  lines.push({ id: "ruyArk25", name: "Bb7 Re1 Bc5 Be3", color: "#e74c3c", cat: "ruy_ark", moves: ruyArk+" Nf6 5.0-0 b5 6.Bb3 Bb7 7.Re1 Bc5 8.c3 d6 9.d4 Bb6 10.Be3 0-0 11.Nbd2 h6 12.h3 Rb8" });
  lines.push({ id: "ruyArk26", name: "Bb7 Bc5 0-0 Bg5", color: "#3498db", cat: "ruy_ark", moves: ruyArk+" Nf6 5.0-0 b5 6.Bb3 Bb7 7.Re1 Bc5 8.c3 0-0 9.d4 Bb6 10.Bg5 h6 11.Bh4 Re8 12.Qd3 d6" });
  lines.push({ id: "ruyArk27", name: "c3 Nxe4 Bc2 Nxd4", color: "#2ecc71", cat: "ruy_ark", moves: ruyArk+" Nf6 5.0-0 b5 6.Bb3 Bb7 7.c3 Nxe4 8.d4 Na5 9.Bc2 exd4 10.Nxd4 c5 11.Nf5 Qf6 12.Nd2 d5" });
  lines.push({ id: "ruyArk28", name: "d3 Bc5 a4 Nc3", color: "#f39c12", cat: "ruy_ark", moves: ruyArk+" Nf6 5.0-0 b5 6.Bb3 Bb7 7.d3 Bc5 8.a4 0-0 9.Nc3 Na5 10.axb5 Nxb3 11.cxb3 axb5 12.Rxa8 Bxa8" });
  lines.push({ id: "ruyArk29", name: "b5 Na5 0-0 Nh4 f4", color: "#9b59b6", cat: "ruy_ark", moves: ruyArk+" b5 5.Bb3 Na5 6.0-0 d6 7.d4 Nxb3 8.axb3 f6 9.Nh4 Ne7 10.f4 Bb7 11.d5 c6 12.c4 exf4" });
  lines.push({ id: "ruyArk30", name: "b5 Na5 d4 Bd2", color: "#1abc9c", cat: "ruy_ark", moves: ruyArk+" b5 5.Bb3 Na5 6.0-0 d6 7.d4 Nxb3 8.Nxd4 Bb7 9.Bd2 Nxb3 10.Nxb3 Nf6 11.Re1 Be7 12.Na5 Rb8" });
  const ruy5th = "1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6";
  lines.push({ id: "ruy5_31", name: "Be7 Re1 c3 d3 Ng3", color: "#e74c3c", cat: "ruy_5th", moves: ruy5th+" 5.0-0 Be7 6.Re1 d6 7.c3 Bg4 8.d3 0-0 9.Nbd2 Re8 10.Nf1 Bf8 11.h3 Bd7 12.Ng3 g6" });
  lines.push({ id: "ruy5_32", name: "d6 c3 Bd7 d4 Bg5", color: "#3498db", cat: "ruy_5th", moves: ruy5th+" 5.0-0 d6 6.c3 Bd7 7.d4 Qe7 8.Re1 g6 9.Nbd2 Bg7 10.Nf1 0-0 11.Bg5 h6 12.Bh4 Qe8" });
  lines.push({ id: "ruy5_33", name: "d6 Re1 b5 Na5 Bg5", color: "#2ecc71", cat: "ruy_5th", moves: ruy5th+" 5.0-0 d6 6.Re1 b5 7.Bb3 Na5 8.d4 Nxb3 9.axb3 Bb7 10.Bg5 h6 11.Bh4 g5 12.Bg3 Nxe4" });
  lines.push({ id: "ruy5_34", name: "Qe2 b5 Be7 d5!", color: "#f39c12", cat: "ruy_5th", moves: ruy5th+" 5.Qe2 b5 6.Bb3 Be7 7.c3 d5 8.d3 0-0 9.Bg5 dxe4 10.dxe4 Nd7 11.Be3 Na5 12.Bc2 Nc4" });
  lines.push({ id: "ruy5_35", name: "Nc3 b5 Be7 Nd5", color: "#9b59b6", cat: "ruy_5th", moves: ruy5th+" 5.Nc3 b5 6.Bb3 Be7 7.d3 d6 8.Nd5 Na5 9.Nxe7 Qxe7 10.0-0 0-0 11.Bg5 h6 12.Bh4 g5" });
  lines.push({ id: "ruy5_36", name: "d3 c3 g6! Nbd2 Ng3", color: "#1abc9c", cat: "ruy_5th", moves: ruy5th+" 5.d3 d6 6.c3 g6 7.Nbd2 Bg7 8.0-0 0-0 9.Re1 Re8 10.Nf1 Bd7 11.Ng3 b5 12.Bb3 Na5" });
  const ruy6th = "1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.0-0 Be7";
  lines.push({ id: "ruy6_37", name: "Worrall Qe2 Bg5", color: "#e74c3c", cat: "ruy_6th", moves: ruy6th+" 6.Qe2 b5 7.Bb3 0-0 8.c3 d5 9.d3 Bb7 10.Bg5 Na5 11.Bc2 Nd7 12.Bxe7 Qxe7 13.Nbd2 c5" });
  lines.push({ id: "ruy6_38", name: "Worrall Rd1 Na5", color: "#3498db", cat: "ruy_6th", moves: ruy6th+" 6.Qe2 b5 7.Bb3 0-0 8.c3 d6 9.Rd1 Na5 10.Bc2 c5 11.d4 Qc7 12.d5 Bd7 13.Nbd2 c4" });
  lines.push({ id: "ruy6_39", name: "Center d4 Re1 e5", color: "#2ecc71", cat: "ruy_6th", moves: ruy6th+" 6.d4 exd4 7.Re1 b5 8.e5 Nxe5 9.Rxe5 d6 10.Re1 bxa4 11.Nxd4 Bd7 12.Qf3 0-0 13.Nc3 Re8" });
  lines.push({ id: "ruy6_40", name: "Center e5 Ne4 Qxd4", color: "#f39c12", cat: "ruy_6th", moves: ruy6th+" 6.d4 exd4 7.e5 Ne4 8.Nxd4 Nxd4 9.Qxd4 Nc5 10.Nc3 0-0 11.Bg5 Bxg5 12.Qxc5 Be7 13.Qe3 d5" });
  lines.push({ id: "ruy6_41", name: "Bxc6 d3 Nc4 Nf5", color: "#9b59b6", cat: "ruy_6th", moves: ruy6th+" 6.Bxc6 dxc6 7.d3 Nd7 8.Nbd2 0-0 9.Nc4 f6 10.Nh4 Nc5 11.Qf3 Rf7 12.Nf5 Bf8 13.Be3 Ne6" });
  lines.push({ id: "ruy6_42", name: "Exchange Def. Qe1", color: "#1abc9c", cat: "ruy_6th", moves: ruy6th+" 6.Bxc6 dxc6 7.Qe1 c5 8.Nxe5 Qd4 9.Nf3 Qxe4 10.Qxe4 Nxe4 11.Re1 Nf6 12.d4 Be6 13.dxc5 Bxc5" });
  const ruyOpen = "1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.0-0 Nxe4 6.d4 b5 7.Bb3 d5 8.dxe5 Be6";
  lines.push({ id: "ruyOp43", name: "Nbd2 Nc5 Bxe6 a4", color: "#e74c3c", cat: "ruy_open", moves: ruyOpen+" 9.Nbd2 Nc5 10.c3 d4 11.Bxe6 Nxe6 12.cxd4 Ncxd4 13.a4 Bc5 14.Ne4 Bb6 15.Nfg5 Qd5 16.Re1 0-0 17.Qd3 Nxg5" });
  lines.push({ id: "ruyOp44", name: "Ng5 Qxg5 Qf3 0-0-0", color: "#3498db", cat: "ruy_open", moves: ruyOpen+" 9.Nbd2 Nc5 10.c3 d4 11.Ng5 Qxg5 12.Qf3 0-0-0 13.Bxe6+ fxe6 14.Qxc6 Qxe5 15.b4 Qd5 16.Qxd5 exd5 17.bxc5 dxc3" });
  lines.push({ id: "ruyOp45", name: "Bg4 Bc2 Re1 Nf5", color: "#2ecc71", cat: "ruy_open", moves: ruyOpen+" 9.Nbd2 Nc5 10.c3 Bg4 11.Bc2 Be7 12.Re1 Qd7 13.Nf1 Rd8 14.Ne3 Bh5 15.b4 Ne6 16.g4 Bg6 17.Nf5 0-0" });
  lines.push({ id: "ruyOp46", name: "c3 Bc5 Nbd2 Nb3", color: "#f39c12", cat: "ruy_open", moves: ruyOpen+" 9.c3 Bc5 10.Nbd2 0-0 11.Bc2 Bf5 12.Nb3 Bg6 13.Nfd4 Bxd4 14.cxd4 a5 15.Be3 a4 16.Nd2 a3 17.Nxe4 axb2" });
  lines.push({ id: "ruyOp47", name: "Nb3 Nfd4 Qxd4!", color: "#9b59b6", cat: "ruy_open", moves: ruyOpen+" 9.Nbd2 Nc5 10.c3 d4 11.Bxe6 Nxe6 12.Nb3 Bb6 13.Nfd4 Nxd4 14.Nxd4 Bxd4 15.Qxd4 c5 16.Qd1 h6 17.f3 Ng5" });
  lines.push({ id: "ruyOp48", name: "Dilworth Nxf2 Rxf2", color: "#1abc9c", cat: "ruy_open", moves: ruyOpen+" 9.Nbd2 Nc5 10.c3 d4 11.Bxe6 Nxe6 12.Rxf2 f6 13.exf6 Bxf2+ 14.Kxf2 Qxf6 15.Nf1 Ne5 16.Be3 Rae8 17.Bc5 Nxf3" });
  const ruyOp2 = "1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.0-0 Nxe4 6.d4 b5 7.Bb3 d5 8.dxe5 Be6 9.c3 Be7";
  lines.push({ id: "ruyOp49", name: "Nbd2 Qe2 Nc5 Nd4", color: "#e74c3c", cat: "ruy_open", moves: ruyOp2+" 10.Nbd2 0-0 11.Qe2 Nc5 12.Nd4 Qd7 13.Bc2 f6 14.b4 Na4 15.N2f3 Nxd4 16.Nxd4 c5 17.exf6 Rxf6" });
  lines.push({ id: "ruyOp50", name: "Bc2 f5 Nb3 Re1", color: "#3498db", cat: "ruy_open", moves: ruyOp2+" 10.Nbd2 0-0 11.Bc2 f5 12.Nb3 Qd7 13.Re1 Rad8 14.Qe2 Rfe8 15.Nfd4 Nxd4 16.Nxd4 c5 17.Nxe6 Qxe6" });
  lines.push({ id: "ruyOp51", name: "Be3 Nc5 Bd4 Bxg7", color: "#2ecc71", cat: "ruy_open", moves: ruyOp2+" 10.Be3 Nc5 11.Bc2 Nd7 12.Re1 Ndxe5 13.Nxe5 Nxe5 14.Bd4 Ng6 15.Bxg7 Rg8 16.Bxg6 Rxg7 17.Rxe6 hxg6" });
  lines.push({ id: "ruyOp52", name: "Nbd2 Re1 Bg5 Qf4", color: "#f39c12", cat: "ruy_open", moves: ruyOp2+" 10.Nbd2 0-0 11.Nbd2 Qd7 12.Re1 Nxd2 13.Qxd2 Na5 14.Bg5 c5 15.Bc2 Nc4 16.Qf4 Rfe8 17.Bf6 Qd8" });
  lines.push({ id: "ruyOp53", name: "Bc2 Qe2 Nd4 f5", color: "#9b59b6", cat: "ruy_open", moves: ruyOp2+" 10.Bc2 0-0 11.Qe2 Qd7 12.Nd4 f5 13.f3 Ng5 14.Be3 f4 15.Bf2 Bf7 16.Nd2 Ne6 17.N2b3 Bg6" });
  lines.push({ id: "ruyOp54", name: "Re1 Nd4 Nxe5! f3", color: "#1abc9c", cat: "ruy_open", moves: ruyOp2+" 10.Re1 0-0 11.Nd4 Nxe5 12.f3 Bd6 13.fxe4 Bg4 14.Qd2 Qh4 15.h3 c5 16.Qf2 Qh5 17.Re3 dxe4" });
  const ruyOp3 = "1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.0-0 Nxe4 6.d4";
  lines.push({ id: "ruyOp55", name: "c3 Nc5 Bc2 e6!", color: "#e74c3c", cat: "ruy_open", moves: ruyOp3+" b5 7.Bb3 d5 8.dxe5 Be6 9.c3 Nc5 10.Bc2 Bg4 11.Re1 d4 12.h3 Bh5 13.e6 fxe6 14.cxd4 Bxf3 15.Qxf3 Nxd4" });
  lines.push({ id: "ruyOp56", name: "Howell Qe2 Rd1 c4", color: "#3498db", cat: "ruy_open", moves: ruyOp3+" b5 7.Bb3 d5 8.dxe5 Be6 9.Qe2 Be7 10.Rd1 0-0 11.c4 bxc4 12.Bxc4 Bc5 13.Be3 Bxe3 14.Qxe3 Qb8 15.Bb3 Na5" });
  lines.push({ id: "ruyOp57", name: "Bc5 Be3 Ne7 Nbd2", color: "#2ecc71", cat: "ruy_open", moves: ruyOp3+" b5 7.Bb3 d5 8.dxe5 Be6 9.Bc5 10.Be3 Ne7 11.Nbd2 Bxe3 12.Qxe3 Nxd2 13.Qxd2 c5 14.c3 Qd7 15.Rad1 h6" });
  lines.push({ id: "ruyOp58", name: "Be3 Nc5 Nc3 Rc1", color: "#f39c12", cat: "ruy_open", moves: ruyOp3+" b5 7.Bb3 d5 8.dxe5 Be6 9.Be3 Nc5 10.Nc3 Nxb3 11.cxb3 Be7 12.Rc1 Qd7 13.h3 0-0 14.Ne2 f6 15.exf6 Rxf6" });
  lines.push({ id: "ruyOp59", name: "8.Nxe5 c6 Be3", color: "#9b59b6", cat: "ruy_open", moves: ruyOp3+" b5 7.Bb3 d5 8.Nxe5 Nxe5 9.dxe5 c6 10.Be3 Be7 11.Nd2 Nxd2 12.Qxd2 0-0 13.Qc3 Bb7 14.f4 a5 15.a3 b4" });
  lines.push({ id: "ruyOp60", name: "exd4 Re1 Nxd4 Bxh2+", color: "#1abc9c", cat: "ruy_open", moves: ruyOp3+" exd4 7.Re1 d5 8.Nxd4 Bd6 9.Nxc6 Bxh2+ 10.Kh1 Qh4 11.Rxe4+ dxe4 12.Qd8+ Qxd8 13.Nxd8+ Kxd8 14.Kxh2 Be6 15.Be3 f5" });
  const ruyClosed = "1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.0-0 Be7 6.Re1 b5 7.Bb3 d6 8.c3 0-0";
  lines.push({ id: "ruyCl1", name: "h3 Nd7 d4 a4 Bf4", color: "#e74c3c", cat: "ruy_closed", moves: ruyClosed+" 9.h3 Nd7 10.d4 Bf6 11.a4 Bb7 12.Na3 exd4 13.cxd4 Na5 14.Bc2 b4 15.Nb1 Re8 16.Bf4 c5" });
  lines.push({ id: "ruyCl2", name: "Nb6 Nbd2 exd4 Be3", color: "#3498db", cat: "ruy_closed", moves: ruyClosed+" 9.h3 Nd7 10.d4 Nb6 11.Nbd2 exd4 12.cxd4 Nb4 13.Nf1 c5 14.a3 Nc6 15.Be3 c4 16.Bc2 d5" });
  lines.push({ id: "ruyCl3", name: "Be6 Bxb3 axb3 d5", color: "#2ecc71", cat: "ruy_closed", moves: ruyClosed+" 9.h3 Be6 10.d4 Bxb3 11.axb3 exd4 12.cxd4 d5 13.e5 Ne4 14.Nc3 f5 15.exf6 Bxf6 16.Nxe4 dxe4" });
  lines.push({ id: "ruyCl4", name: "d4 Bg4 Be3 dxc5", color: "#f39c12", cat: "ruy_closed", moves: ruyClosed+" 9.d4 Bg4 10.Be3 exd4 11.cxd4 Na5 12.Bc2 c5 13.dxc5 dxc5 14.Nbd2 Re8 15.Qb1 Nd7 16.e5 Nf8" });
  lines.push({ id: "ruyCl5", name: "d4 d5 Na5 Bc2 Ng3", color: "#9b59b6", cat: "ruy_closed", moves: ruyClosed+" 9.d4 Bg4 10.d5 Na5 11.Bc2 Qc8 12.Nbd2 c6 13.h3 Bd7 14.dxc6 Bxc6 15.Nf1 Nc4 16.Ng3 g6" });
  lines.push({ id: "ruyCl6", name: "d3 Na5 Bc2 Nf1 Ng3", color: "#1abc9c", cat: "ruy_closed", moves: ruyClosed+" 9.d3 Na5 10.Bc2 c5 11.Nbd2 Re8 12.Nf1 Nc6 13.h3 h6 14.Ng3 Be6 15.d4 cxd4 16.cxd4 exd4" });
  const ruyChi = ruyClosed+" 9.h3 Na5 10.Bc2 c5 11.d4 Qc7 12.Nbd2 cxd4 13.cxd4";
  lines.push({ id: "ruyChi7", name: "Bb7 d5 Bd3 Nf5", color: "#e74c3c", cat: "ruy_chig", moves: ruyChi+" Bb7 14.d5 Rac8 15.Bd3 Nd7 16.Nf1 f5 17.Ng3 f4 18.Nf5 Rxf5 19.exf5 Nf6" });
  lines.push({ id: "ruyChi8", name: "Bb7 Nf1 Re2 a4", color: "#3498db", cat: "ruy_chig", moves: ruyChi+" Bb7 14.Nf1 Rac8 15.Re2 Nh5 16.a4 bxa4 17.Bxa4 Nf6 18.Ng3 g6 19.Bd2 Nc4" });
  lines.push({ id: "ruyChi9", name: "Bb1 Nxd4 e5 Bf5", color: "#2ecc71", cat: "ruy_chig", moves: ruyChi+" Bb7 14.Nf1 Rac8 15.Bb1 exd4 16.Nxd4 Rfe8 17.Ng3 d5 18.e5 Bb4 19.Bf5 Bxe1" });
  lines.push({ id: "ruyChi10", name: "Nc6 Nb3 Be3 Qe2", color: "#f39c12", cat: "ruy_chig", moves: ruyChi+" Nc6 14.Nb3 a5 15.Be3 a4 16.Nbd2 Bd7 17.Rc1 Qb7 18.Qe2 Rfe8 19.Bd3 Rab8" });
  lines.push({ id: "ruyChi11", name: "a3 d5 Nf1 Ne3", color: "#9b59b6", cat: "ruy_chig", moves: ruyChi+" Nc6 14.a3 Bd7 15.d5 Na5 16.Nf1 Nh5 17.b3 Rfc8 18.Ne3 g6 19.Bd2 Bd8" });
  lines.push({ id: "ruyChi12", name: "Bd7 Nf1 Ne3 d5 b4", color: "#1abc9c", cat: "ruy_chig", moves: ruyChi+" Bd7 14.Nf1 Rac8 15.Ne3 Nc6 16.d5 Nb4 17.Bb1 a5 18.a3 Na6 19.b4 axb4" });
  const ruyChi2 = ruyClosed+" 9.h3 Na5 10.Bc2 c5 11.d4";
  lines.push({ id: "ruyChi13", name: "Qc7 Nbd2 d5! a4", color: "#e74c3c", cat: "ruy_chig", moves: ruyChi2+" Qc7 12.Nbd2 Nc6 13.d5 Nd8 14.a4 Rb8 15.b4 Nb7 16.axb5 axb5 17.Nf1 Bd7 18.Be3 Ra8" });
  lines.push({ id: "ruyChi14", name: "Bd7 Nf1 Nc4 b3", color: "#3498db", cat: "ruy_chig", moves: ruyChi2+" Qc7 12.Nbd2 Bd7 13.Nf1 Nc4 14.b3 Nb6 15.Ne3 c4 16.Ba3 Rfe8 17.Qd2 a5 18.bxc4 Nxc4" });
  lines.push({ id: "ruyChi15", name: "Nc6 d5 Na5 Bh6", color: "#2ecc71", cat: "ruy_chig", moves: ruyChi2+" Nc6 12.d5 Na5 13.Nbd2 g6 14.b3 Bd7 15.Nf1 Nh5 16.Bh6 Re8 17.Qd2 Bf6 18.Rac1 Bg7" });
  lines.push({ id: "ruyChi16", name: "Nd7 Nb3 Be3 d5", color: "#f39c12", cat: "ruy_chig", moves: ruyChi2+" Nd7 12.Nbd2 cxd4 13.cxd4 Nc6 14.Nb3 a5 15.Be3 a4 16.Nbd2 Bf6 17.d5 Nd4 18.Rc1 Bb7" });
  lines.push({ id: "ruyChi17", name: "Keres dxc5 Bb7 Nf5", color: "#9b59b6", cat: "ruy_chig", moves: ruyChi2+" Qc7 12.Nbd2 dxc5 13.Nbd2 Bb7 14.Nf1 Nc4 15.Qe2 Qc7 16.Ng3 Rfe8 17.Nf5 Bf8 18.Nh2 Nd6" });
  lines.push({ id: "ruyChi18", name: "Bb7 d5 Nc4 a4 Bh6", color: "#1abc9c", cat: "ruy_chig", moves: ruyChi2+" Bb7 12.d5 Nc4 13.a4 Nb6 14.Nbd2 g6 15.a5 Nbd7 16.Nf1 Nh5 17.Bh6 Re8 18.Qd2 Bf8" });
  // Smyslov Variation
  const ruySmys = ruyClosed+" 9.h3 h6 10.d4 Re8";
  lines.push({ id: "ruySmys25", name: "Nbd2 Nf1 Ng3 d5", color: "#e74c3c", cat: "ruy_smys", moves: ruySmys+" 11.Nbd2 Bf8 12.Nf1 Bd7 13.Ng3 Na5 14.Bc2 c5 15.b3 Nc6 16.d5 Ne7 17.Be3 Ng6 18.Qd2 Nh7" });
  lines.push({ id: "ruySmys26", name: "Nc4 b3! Nh2 f4", color: "#3498db", cat: "ruy_smys", moves: ruySmys+" 11.Nbd2 Bf8 12.Nf1 Bd7 13.Ng3 Na5 14.Bc2 Nc4 15.b3 Nb6 16.Nh2 c5 17.f4 cxd4 18.cxd4 Rc8" });
  lines.push({ id: "ruySmys27", name: "Bb7 Nc4 a4 Bd3", color: "#2ecc71", cat: "ruy_smys", moves: ruySmys+" 11.Nbd2 Bf8 12.Nf1 Bb7 13.Ng3 Na5 14.Bc2 Nc4 15.b3 Nb6 16.a4 bxa4 17.bxa4 a5 18.Bd3 Ba6" });
  lines.push({ id: "ruySmys28", name: "Bd3 Bd2 d5 Nh2", color: "#f39c12", cat: "ruy_smys", moves: ruySmys+" 11.Nbd2 Bf8 12.Nf1 Bb7 13.Ng3 Na5 14.Bc2 Nc4 15.Bd3 Nb6 16.Bd2 c5 17.d5 Bc8 18.Nh2 Nh7" });
  lines.push({ id: "ruySmys29", name: "Bc2 Bd7 Bd3 d5 c4", color: "#9b59b6", cat: "ruy_smys", moves: ruySmys+" 11.Nbd2 Bf8 12.Bc2 Bd7 13.Bd3 g6 14.Bb2 Bg7 15.d5 Ne7 16.c4 c6 17.b4 cxd5 18.cxd5 Nh5" });
  lines.push({ id: "ruySmys30", name: "Be3 Nbd2 a3 b4", color: "#1abc9c", cat: "ruy_smys", moves: ruySmys+" 11.Be3 Bf8 12.Nbd2 Bd7 13.a3 Rc8 14.Bc2 g6 15.b4 Bg7 16.Rc1 Nh5 17.Nb3 Qf6" });
  // Zaitsev (Fianchetto) Variation
  const ruyZait = "1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.0-0 Be7 6.Re1 b5 7.Bb3 d6 8.c3 0-0 9.h3 Bb7 10.d4 Re8";

  lines.push({ id: "ruyZ31", name: "a4 h6 Nbd2 Bb1 c5", color: "#e74c3c", cat: "ruy_zait",
    moves: `${ruyZait} 11.a4 h6 12.Nbd2 Bf8 13.Bc2 exd4 14.cxd4 Nb4 15.Bb1 c5 16.d5 Nd7 17.Ra3 c4 18.axb5 axb5` });

  lines.push({ id: "ruyZ32", name: "a4 Ra3 f5 g4", color: "#3498db", cat: "ruy_zait",
    moves: `${ruyZait} 11.a4 h6 12.Nbd2 Bf8 13.Bc2 exd4 14.cxd4 Nb4 15.Bb1 c5 16.d5 Nd7 17.Ra3 f5 18.g4 f4` });

  lines.push({ id: "ruyZ33", name: "Nbd2 Bc2 g6 d5 c4", color: "#2ecc71", cat: "ruy_zait",
    moves: `${ruyZait} 11.Nbd2 Bf8 12.Bc2 g6 13.d5 Nb8 14.b3 c6 15.c4 Bh6 16.a4 b4 17.Nf1 Bxc1 18.Rxc1 cxd5` });

  lines.push({ id: "ruyZ34", name: "Nbd2 d5 Nb8 N3h2", color: "#f39c12", cat: "ruy_zait",
    moves: `${ruyZait} 11.Nbd2 Bf8 12.d5 Nb8 13.Nf1 Nbd7 14.N3h2 Nc5 15.Bc2 c6 16.dxc6 Bxc6 17.Bg5 h6 18.Bxf6 Qxf6` });

  lines.push({ id: "ruyZ35", name: "a3 g6 Ba2 b4 d5", color: "#9b59b6", cat: "ruy_zait",
    moves: `${ruyZait} 11.a4 h6 12.a3 g6 13.Ba2 Bg7 14.b4 a5 15.d5 Ne7 16.Nb3 axb4 17.cxb4 Nxe4 18.Rxe4 Bxd5` });

  lines.push({ id: "ruyZ36", name: "Ng5 Rf8 f4 Nd5", color: "#1abc9c", cat: "ruy_zait",
    moves: `${ruyZait} 11.Ng5 Rf8 12.f4 exf4 13.Bxf4 Na5 14.Bc2 Nd5 15.exd5 Bxg5 16.Qh5 h6 17.Nd2 Bxd5 18.Ne4 Bxf4` });

  // Marshall Attack and Anti-Marshall
  const ruyMarsh = "1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.0-0 Be7 6.Re1 b5 7.Bb3 0-0";

  lines.push({ id: "ruyMar37", name: "Marshall: Re1 Qh4 Be3", color: "#e74c3c", cat: "ruy_marsh",
    moves: `${ruyMarsh} 8.c3 d5 9.exd5 Nxd5 10.Nxe5 Nxe5 11.Rxe5 c6 12.d4 Bd6 13.Re1 Qh4 14.g3 Qh3 15.Be3 Bg4 16.Qd3 Rae8` });

  lines.push({ id: "ruyMar38", name: "Marshall: Re2 Bg4 Nd2", color: "#3498db", cat: "ruy_marsh",
    moves: `${ruyMarsh} 8.c3 d5 9.exd5 Nxd5 10.Nxe5 Nxe5 11.Rxe5 c6 12.d4 Bd6 13.Re2 Bg4 14.f3 Bf5 15.Bxd5 cxd5 16.Nd2 b4` });

  lines.push({ id: "ruyMar39", name: "Marshall: Bxd5 d4 Re3", color: "#2ecc71", cat: "ruy_marsh",
    moves: `${ruyMarsh} 8.c3 d5 9.exd5 Nxd5 10.Nxe5 Nxe5 11.Rxe5 c6 12.Bxd5 cxd5 13.d4 Bd6 14.Re3 Qh4 15.h3 Qf4 16.Re5 Qf6` });

  lines.push({ id: "ruyMar40", name: "Marshall: d3 Re1 Qh4", color: "#f39c12", cat: "ruy_marsh",
    moves: `${ruyMarsh} 8.c3 d5 9.exd5 Nxd5 10.Nxe5 Nxe5 11.Rxe5 c6 12.d3 Bd6 13.Re1 Qh4 14.g3 Qh3 15.Re4 Qf5 16.Nd2 Qg6` });

  lines.push({ id: "ruyMar41", name: "Anti-Marshall: h3 Bb7 a3", color: "#9b59b6", cat: "ruy_marsh",
    moves: `${ruyMarsh} 8.h3 Bb7 9.d3 d6 10.a3 Na5 11.Ba2 c5 12.Nbd2 Nc6 13.Nf1 Bc8 14.Bg5 Ne8 15.Bd2 Be6 16.Bxe6 fxe6` });

  lines.push({ id: "ruyMar42", name: "Anti-Marshall: a4 Bb7 Nc3", color: "#1abc9c", cat: "ruy_marsh",
    moves: `${ruyMarsh} 8.a4 Bb7 9.d3 d6 10.Nc3 Na5 11.Ba2 b4 12.Ne2 c5 13.c3 bxc3 14.bxc3 c4 15.Ng3 cxd3 16.Qxd3 Bc8` });

  // SCOTCH GAME: 1.e4 e5 2.Nf3 Nc6 3.d4 exd4 4.Nxd4 Nf6 5.Nc3 Bb4 6.Nxc6 bxc6 7.Bd3 d5 8.exd5
  const scotch = "1.e4 e5 2.Nf3 Nc6 3.d4 exd4 4.Nxd4 Nf6 5.Nc3 Bb4 6.Nxc6 bxc6 7.Bd3 d5 8.exd5";

  lines.push({ id: "scotch1", name: "cxd5 0-0 Bg5 Qf3 Ne2", color: "#e74c3c", cat: "scotch",
    moves: `${scotch} cxd5 9.0-0 0-0 10.Bg5 c6 11.Qf3 Be7 12.Rae1 Re8 13.Ne2 Bg4 14.Qf4 Bxe2 15.Rxe2 Nh5` });

  lines.push({ id: "scotch2", name: "cxd5 0-0 Bg5 Qf3 Bd6", color: "#3498db", cat: "scotch",
    moves: `${scotch} cxd5 9.0-0 0-0 10.Bg5 c6 11.Qf3 Bd6 12.Ne2 Be5 13.Rab1 h6 14.Bf4 Re8 15.Bxe5 Rxe5` });

  lines.push({ id: "scotch3", name: "cxd5 0-0 Na4 Bh4", color: "#2ecc71", cat: "scotch",
    moves: `${scotch} cxd5 9.0-0 0-0 10.Bg5 c6 11.Na4 h6 12.Bh4 Re8 13.c4 Rb8 14.Rc1 Be6 15.cxd5 Bxd5` });

  lines.push({ id: "scotch4", name: "cxd5 0-0 Be6 Qf3 Bf4", color: "#f39c12", cat: "scotch",
    moves: `${scotch} cxd5 9.0-0 0-0 10.Bg5 Be6 11.Qf3 Be7 12.h3 h6 13.Bf4 c5 14.Rfd1 d4 15.Ne4 Nd5` });

  lines.push({ id: "scotch5", name: "cxd5 Qe2+ Be7 Re1", color: "#9b59b6", cat: "scotch",
    moves: `${scotch} cxd5 9.Qe2+ Be7 10.0-0 0-0 11.Re1 Re8 12.Bg5 Bg4 13.Qe5 c6 14.Qg3 Bh5 15.Qh4 Bg6` });

  lines.push({ id: "scotch6", name: "Qe7+ Qe2 Nxd5 Bb5+", color: "#1abc9c", cat: "scotch",
    moves: `${scotch} Qe7+ 9.Qe2 Qxe2 10.Kxe2 Nxd5 11.Nxd5 cxd5 12.Bb5+ Bd7 13.Bxd7+ Kxd7 14.Rd1 Rhe8+ 15.Be3 Kc6` });

  // SCOTCH GAME Table 2: 1.e4 e5 2.Nf3 Nc6 3.d4 exd4 4.Nxd4
  const scotch2 = "1.e4 e5 2.Nf3 Nc6 3.d4 exd4 4.Nxd4";

  // Col 7: Nf6 Nxc6 bxc6 e5 Qe7 Qe2 Nd5 c4 Ba6 b3 g5 Ba3 d6 exd6 Qxe2+ Bxe2 Bg7
  lines.push({ id: "scotch7", name: "Nf6 e5 Qe7 c4 Ba6 b3", color: "#e74c3c", cat: "scotch",
    moves: `${scotch2} Nf6 5.Nxc6 bxc6 6.e5 Qe7 7.Qe2 Nd5 8.c4 Ba6 9.b3 g5 10.Ba3 d6 11.exd6 Qxe2+ 12.Bxe2 Bg7` });

  // Col 8: Nf6 Nxc6 bxc6 e5 Qe7 Qe2 Nd5 c4 Ba6 Nd2 g6 Qe4 Nb6 Bd3 Bg7 0-0 0-0
  lines.push({ id: "scotch8", name: "Nf6 e5 Nd2 Qe4 Bd3", color: "#3498db", cat: "scotch",
    moves: `${scotch2} Nf6 5.Nxc6 bxc6 6.e5 Qe7 7.Qe2 Nd5 8.c4 Ba6 9.Nd2 g6 10.Qe4 Nb6 11.Bd3 Bg7 12.0-0 0-0` });

  // Col 9: Nf6 Nxc6 bxc6 e5 Qe7 Qe2 Nd5 c4 Nb6 Nd2 Qe6 b3 a5 Bb2 a4 Qe3 axb3
  lines.push({ id: "scotch9", name: "Nf6 e5 Nb6 Nd2 Bb2", color: "#2ecc71", cat: "scotch",
    moves: `${scotch2} Nf6 5.Nxc6 bxc6 6.e5 Qe7 7.Qe2 Nd5 8.c4 Nb6 9.Nd2 Qe6 10.b3 a5 11.Bb2 a4 12.Qe3 axb3` });

  // Col 10: Bc5 Nxc6 Qf6 Qd2 dxc6 Nc3 Be6 Na4 Rd8 Bd3 Bd4 c3 Bxf2+ Qxf2 Rxd3 Qxf6 Nxf6
  lines.push({ id: "scotch10", name: "Bc5 Qf6 Qd2 Na4 c3", color: "#f39c12", cat: "scotch",
    moves: `${scotch2} Bc5 5.Nxc6 Qf6 6.Qd2 dxc6 7.Nc3 Be6 8.Na4 Rd8 9.Bd3 Bd4 10.c3 Bxf2+ 11.Qxf2 Rxd3 12.Qxf6 Nxf6` });

  // Col 11: Bc5 Nxc6 Qf6 Qd2 Qxc6 Nc3 Ne7 Qf4 Ng6 Qxf6 gxf6 Bd2 Rg8 Na4 Bd6 0-0-0 Be6
  lines.push({ id: "scotch11", name: "Bc5 Qf6 Qxc6 Qf4 Bd2", color: "#9b59b6", cat: "scotch",
    moves: `${scotch2} Bc5 5.Nxc6 Qf6 6.Qd2 Qxc6 7.Nc3 Ne7 8.Qf4 Ng6 9.Qxf6 gxf6 10.Bd2 Rg8 11.Na4 Bd6 12.0-0-0 Be6` });

  // Col 12: Bc5 Nxc6 Qf6 Qd2 dxc6 Bd3 Nf6 0-0 0-0 b4 Bd4 c3 Bb6 c4 a5 Nc3 axb4
  lines.push({ id: "scotch12", name: "Bc5 Qf6 Bd3 Nf6 0-0 b4", color: "#1abc9c", cat: "scotch",
    moves: `${scotch2} Bc5 5.Nxc6 Qf6 6.Qd2 dxc6 7.Bd3 Nf6 8.0-0 0-0 9.b4 Bd4 10.c3 Bb6 11.c4 a5 12.Nc3 axb4` });

  // SCOTCH GAME Table 3: 4...Bc5
  const scotch3 = "1.e4 e5 2.Nf3 Nc6 3.d4 exd4 4.Nxd4 Bc5";

  lines.push({ id: "scotch13", name: "Be3 Qf6 c3 Bc4 Ne5", color: "#e74c3c", cat: "scotch",
    moves: `${scotch3} 5.Be3 Qf6 6.c3 Nge7 7.Bc4 Ne5 8.Be2 Qg6 9.0-0 d6 10.f3 0-0 11.Kh1 d5 12.Nd2 dxe4` });

  lines.push({ id: "scotch14", name: "Be3 Qf6 Bc4 0-0 Nc2", color: "#3498db", cat: "scotch",
    moves: `${scotch3} 5.Be3 Qf6 6.c3 Nge7 7.Bc4 0-0 8.0-0 Bb6 9.Nc2 d6 10.Nd2 Be6 11.Qh5 Ng6 12.g3 Rae8` });

  lines.push({ id: "scotch15", name: "Be3 Qf6 g3 d5 Bg2", color: "#2ecc71", cat: "scotch",
    moves: `${scotch3} 5.Be3 Qf6 6.c3 Nge7 7.g3 d5 8.Bg2 dxe4 9.Nd2 Bxd4 10.cxd4 0-0 11.Nxe4 Qg6 12.0-0 Be6` });

  lines.push({ id: "scotch16", name: "Be3 Qf6 Nd2 h4 Rh4", color: "#f39c12", cat: "scotch",
    moves: `${scotch3} 5.Be3 Qf6 6.c3 Nge7 7.Nd2 Nge7 8.h4 Bxd4 9.cxd4 d5 10.h5 Qe6 11.h6 g6 12.Rh4 0-0` });

  lines.push({ id: "scotch17", name: "Nb3 Bb6 a4 Nd5 Qe2", color: "#9b59b6", cat: "scotch",
    moves: `${scotch3} 5.Nb3 Bb6 6.a4 a6 7.Nc3 d6 8.Nd5 Ba7 9.Qe2 Nge7 10.Bg5 0-0 11.0-0-0 f6 12.Bh4 Be6` });

  lines.push({ id: "scotch18", name: "Nb3 Bb4+ c3 Be7 c4", color: "#1abc9c", cat: "scotch",
    moves: `${scotch3} 5.Nb3 Bb4+ 6.c3 Be7 7.c4 Nf6 8.Nc3 0-0 9.Be2 Re8 10.0-0 a5 11.a4 d6 12.Be3 Nd7` });

  return lines;
}

function parseMoveSequence(movesStr) {
  const tokens = movesStr.replace(/\d+\./g, "").trim().split(/\s+/).filter(Boolean);
  const result = []; let board = INIT_BOARD(), color = "w", lastMoveData = null;
  for (const token of tokens) {
    const mv = parseMove(board, token, color, lastMoveData);
    if (mv) { result.push({ san: token, ...mv, color }); board = applyMoveRaw(board, mv.fr, mv.fc, mv.tr, mv.tc, mv.promo); lastMoveData = { piece: board[mv.tr][mv.tc]?.type, fr: mv.fr, fc: mv.fc, tr: mv.tr, tc: mv.tc }; color = color === "w" ? "b" : "w"; }
    else { console.warn("Failed:", token, color); break; }
  }
  return result;
}

function getCategory(line) {
  const m = { evans: "Evans Gambit", tk: "Two Knights' Defense", tk_d4: "Two Knights' — 4.d4 5.0-0", tk_misc: "Two Knights' — Other", ruy: "Ruy Lopez: Classical (Cordel)", ruy_berlin: "Ruy Lopez: Berlin Defense", ruy_cozio: "Ruy Lopez: Cozio Defense", ruy_bird: "Ruy Lopez: Bird's Defense", ruy_steinitz: "Ruy Lopez: Old Steinitz", ruy_g6: "Ruy Lopez: 3...g6", ruy_schl: "Ruy Lopez: Schliemann", ruy_exch: "Ruy Lopez: Exchange Variation", ruy_mod: "Ruy Lopez: Modern Steinitz", ruy_a6bc5: "Ruy Lopez: ...a6/...Bc5", ruy_ark: "Ruy Lopez: Arkangel", ruy_5th: "Ruy Lopez: Fifth-Move Variants", ruy_6th: "Ruy Lopez: Sixth-Move Variants", ruy_open: "Ruy Lopez: Open Variation", ruy_closed: "Ruy Lopez: Closed Defense", ruy_chig: "Ruy Lopez: Chigorin Variation", ruy_smys: "Ruy Lopez: Smyslov Variation", ruy_zait: "Ruy Lopez: Zaitsev Variation", ruy_marsh: "Ruy Lopez: Marshall Attack", scotch: "Scotch Game", d3: "Giuoco Piano — d3", other: "Giuoco Piano — Other" };
  return m[line.cat] || "Giuoco Piano";
}

const CATEGORY_ORDER = [
  { cat: "gp", label: "Giuoco Piano (4.c3 Nf6 5.d4)" }, { cat: "d3", label: "Giuoco Piano — d3" }, { cat: "other", label: "Giuoco Piano — Other" },
  { cat: "evans", label: "Evans Gambit (4.b4)" }, { cat: "tk", label: "Two Knights' (4.Ng5)" }, { cat: "tk_d4", label: "Two Knights' (4.d4 5.0-0)" }, { cat: "tk_misc", label: "Two Knights' — Other" },
  { cat: "ruy", label: "Ruy Lopez: Classical" }, { cat: "ruy_berlin", label: "Ruy Lopez: Berlin" }, { cat: "ruy_cozio", label: "Ruy Lopez: Cozio" }, { cat: "ruy_bird", label: "Ruy Lopez: Bird's" },
  { cat: "ruy_steinitz", label: "Ruy Lopez: Old Steinitz" }, { cat: "ruy_g6", label: "Ruy Lopez: 3...g6" }, { cat: "ruy_schl", label: "Ruy Lopez: Schliemann" }, { cat: "ruy_exch", label: "Ruy Lopez: Exchange" },
  { cat: "ruy_mod", label: "Ruy Lopez: Modern Steinitz" }, { cat: "ruy_a6bc5", label: "Ruy Lopez: ...a6/...Bc5" }, { cat: "ruy_ark", label: "Ruy Lopez: Arkangel" },
  { cat: "ruy_5th", label: "Ruy Lopez: 5th-Move Variants" }, { cat: "ruy_6th", label: "Ruy Lopez: 6th-Move Variants" },
  { cat: "ruy_open", label: "Ruy Lopez: Open Variation" }, { cat: "ruy_closed", label: "Ruy Lopez: Closed Defense" },   { cat: "ruy_chig", label: "Ruy Lopez: Chigorin" },   { cat: "ruy_smys", label: "Ruy Lopez: Smyslov" }, { cat: "ruy_zait", label: "Ruy Lopez: Zaitsev (Fianchetto)" },   { cat: "ruy_marsh", label: "Ruy Lopez: Marshall / Anti-Marshall" }, { cat: "scotch", label: "Scotch Game (3.d4)" },
];

function ChessApp() {
  const [board, setBoard] = useState(INIT_BOARD());
  const [flipped, setFlipped] = useState(false);
  const [moveHistory, setMoveHistory] = useState([]);
  const [currentMoveIdx, setCurrentMoveIdx] = useState(-1);
  const [boardHistory, setBoardHistory] = useState([INIT_BOARD()]);
  const [selectedSq, setSelectedSq] = useState(null);
  const [legalDots, setLegalDots] = useState([]);
  const [dragging, setDragging] = useState(null);
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 });
  const [arrows, setArrows] = useState([]);
  const [turn, setTurn] = useState("w");
  const [lastMove, setLastMove] = useState(null);
  const [lastMoveData, setLastMoveData] = useState(null);
  const [castleRights, setCastleRights] = useState({ wK: true, wQ: true, bK: true, bQ: true });
  const [castleHistory, setCastleHistory] = useState([{ wK: true, wQ: true, bK: true, bQ: true }]);
  const [lastMoveDataHistory, setLastMoveDataHistory] = useState([null]);
  const [activeLine, setActiveLine] = useState(null);
  const [parsedLines, setParsedLines] = useState([]);
  const [searchFilter, setSearchFilter] = useState("");
  const boardRef = useRef(null);
  const sqSize = 64;

  useEffect(() => {
    const lines = buildLines(); const parsed = [], seen = new Set();
    for (const line of lines) { const moves = parseMoveSequence(line.moves); if (moves.length > 0 && !seen.has(line.id)) { seen.add(line.id); parsed.push({ ...line, parsedMoves: moves }); } }
    setParsedLines(parsed);
  }, []);

  const updateCR = useCallback((rights, piece, fr, fc) => {
    const nr = { ...rights };
    if (piece.type === "K") { if (piece.color === "w") { nr.wK = false; nr.wQ = false; } else { nr.bK = false; nr.bQ = false; } }
    if (piece.type === "R") { if (piece.color === "w" && fr === 7 && fc === 7) nr.wK = false; if (piece.color === "w" && fr === 7 && fc === 0) nr.wQ = false; if (piece.color === "b" && fr === 0 && fc === 7) nr.bK = false; if (piece.color === "b" && fr === 0 && fc === 0) nr.bQ = false; }
    return nr;
  }, []);

  const showLegalMoves = useCallback((r, c) => {
    const moves = getLegalMoves(board, r, c, lastMoveData, castleRights);
    const unique = [], seen = new Set(); for (const mv of moves) { const k = mv.tr+","+mv.tc; if (!seen.has(k)) { seen.add(k); unique.push(mv); } }
    setLegalDots(unique);
  }, [board, lastMoveData, castleRights]);

  const goToMove = useCallback((idx) => {
    if (idx < -1 || idx >= moveHistory.length) return;
    setCurrentMoveIdx(idx); setBoard(boardHistory[idx + 1]); setTurn(idx % 2 === 0 ? "b" : "w");
    setCastleRights(castleHistory[idx + 1]); setLastMoveData(lastMoveDataHistory[idx + 1]);
    setLastMove(idx >= 0 ? { fr: moveHistory[idx].fr, fc: moveHistory[idx].fc, tr: moveHistory[idx].tr, tc: moveHistory[idx].tc } : null);
    setSelectedSq(null); setLegalDots([]);
  }, [moveHistory, boardHistory, castleHistory, lastMoveDataHistory]);

  const makeMove = useCallback((fr, fc, tr, tc, promo) => {
    const piece = board[fr][fc]; if (!piece || piece.color !== turn) return false;
    const legal = getLegalMoves(board, fr, fc, lastMoveData, castleRights);
    if (!legal.some(m => m.tr === tr && m.tc === tc)) return false;
    if (piece.type === "P" && (tr === 0 || tr === 7) && !promo) promo = "Q";
    const san = generateSAN(board, fr, fc, tr, tc, promo, castleRights, lastMoveData);
    const nb = applyMoveRaw(board, fr, fc, tr, tc, promo);
    const newCR = updateCR(castleRights, piece, fr, fc);
    const newLMD = { piece: piece.type, fr, fc, tr, tc };
    const nH = moveHistory.slice(0, currentMoveIdx + 1), nBH = boardHistory.slice(0, currentMoveIdx + 2);
    const nCH = castleHistory.slice(0, currentMoveIdx + 2), nLH = lastMoveDataHistory.slice(0, currentMoveIdx + 2);
    nH.push({ fr, fc, tr, tc, piece: piece.type, color: piece.color, promo, san }); nBH.push(nb); nCH.push(newCR); nLH.push(newLMD);
    setMoveHistory(nH); setBoardHistory(nBH); setCastleHistory(nCH); setLastMoveDataHistory(nLH);
    setCurrentMoveIdx(nH.length - 1); setBoard(nb); setTurn(turn === "w" ? "b" : "w");
    setLastMove({ fr, fc, tr, tc }); setLastMoveData(newLMD); setCastleRights(newCR);
    setSelectedSq(null); setLegalDots([]); return true;
  }, [board, turn, moveHistory, boardHistory, currentMoveIdx, castleRights, lastMoveData, castleHistory, lastMoveDataHistory, updateCR]);

  const loadLine = useCallback((line) => {
    setActiveLine(line.id); let b = INIT_BOARD(); const bh = [b], mh = [];
    let cr = { wK: true, wQ: true, bK: true, bQ: true }; const crh = [{ ...cr }]; let lmd = null; const lmdh = [null];
    for (const mv of line.parsedMoves) {
      const piece = b[mv.fr][mv.fc]; b = applyMoveRaw(b, mv.fr, mv.fc, mv.tr, mv.tc, mv.promo); bh.push(b); mh.push(mv);
      cr = { ...cr }; if (piece?.type === "K") { if (piece.color === "w") { cr.wK = false; cr.wQ = false; } else { cr.bK = false; cr.bQ = false; } }
      if (piece?.type === "R") { if (piece.color === "w" && mv.fr === 7 && mv.fc === 7) cr.wK = false; if (piece.color === "w" && mv.fr === 7 && mv.fc === 0) cr.wQ = false; if (piece.color === "b" && mv.fr === 0 && mv.fc === 7) cr.bK = false; if (piece.color === "b" && mv.fr === 0 && mv.fc === 0) cr.bQ = false; }
      crh.push({ ...cr }); lmd = { piece: piece?.type, fr: mv.fr, fc: mv.fc, tr: mv.tr, tc: mv.tc }; lmdh.push(lmd);
    }
    setMoveHistory(mh); setBoardHistory(bh); setCastleHistory(crh); setLastMoveDataHistory(lmdh);
    setBoard(INIT_BOARD()); setCurrentMoveIdx(-1); setTurn("w"); setLastMove(null); setLastMoveData(null);
    setCastleRights({ wK: true, wQ: true, bK: true, bQ: true }); setSelectedSq(null); setLegalDots([]); setArrows([]);
  }, []);

  const resetBoard = useCallback(() => {
    setBoard(INIT_BOARD()); setMoveHistory([]); setBoardHistory([INIT_BOARD()]);
    setCastleHistory([{ wK: true, wQ: true, bK: true, bQ: true }]); setLastMoveDataHistory([null]);
    setCurrentMoveIdx(-1); setTurn("w"); setLastMove(null); setLastMoveData(null);
    setCastleRights({ wK: true, wQ: true, bK: true, bQ: true }); setSelectedSq(null); setLegalDots([]); setArrows([]); setActiveLine(null);
  }, []);

  useEffect(() => {
    if (parsedLines.length === 0) { setArrows([]); return; }
    const nextIdx = currentMoveIdx + 1; const arrs = [], seen = new Set();
    for (const line of parsedLines) {
      if (nextIdx < line.parsedMoves.length) {
        let match = true;
        for (let i = 0; i <= currentMoveIdx && i < line.parsedMoves.length; i++) {
          const hm = moveHistory[i], lm = line.parsedMoves[i];
          if (!hm || !lm || hm.fr !== lm.fr || hm.fc !== lm.fc || hm.tr !== lm.tr || hm.tc !== lm.tc) { match = false; break; }
        }
        if (match && currentMoveIdx < line.parsedMoves.length) {
          const nm = line.parsedMoves[nextIdx]; const key = ""+nm.fr+nm.fc+nm.tr+nm.tc;
          if (!seen.has(key)) { seen.add(key); arrs.push({ fr: nm.fr, fc: nm.fc, tr: nm.tr, tc: nm.tc, color: line.color }); }
        }
      }
    }
    setArrows(arrs);
  }, [currentMoveIdx, moveHistory, parsedLines]);

  const getDisplayCoords = (r, c) => flipped ? [7 - r, 7 - c] : [r, c];
  const getBoardCoords = (dr, dc) => flipped ? [7 - dr, 7 - dc] : [dr, dc];

  const handleSquareClick = (r, c) => {
    if (dragging) return;
    const piece = board[r][c];
    if (selectedSq) {
      if (selectedSq[0] === r && selectedSq[1] === c) { setSelectedSq(null); setLegalDots([]); return; }
      if (piece && piece.color === turn) { setSelectedSq([r, c]); showLegalMoves(r, c); return; }
      makeMove(selectedSq[0], selectedSq[1], r, c);
    } else if (piece && piece.color === turn) { setSelectedSq([r, c]); showLegalMoves(r, c); }
  };

  const handleDragStart = (e, r, c) => {
    const piece = board[r][c]; if (!piece || piece.color !== turn) return;
    e.preventDefault();
    const rect = boardRef.current.getBoundingClientRect();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    setDragging({ r, c, piece }); setDragPos({ x: cx - rect.left, y: cy - rect.top });
    setSelectedSq([r, c]); showLegalMoves(r, c);
  };

  const handleDragMove = useCallback((e) => {
    if (!dragging || !boardRef.current) return; e.preventDefault();
    const rect = boardRef.current.getBoundingClientRect();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    setDragPos({ x: cx - rect.left, y: cy - rect.top });
  }, [dragging]);

  const handleDragEnd = useCallback((e) => {
    if (!dragging || !boardRef.current) return; e.preventDefault();
    const rect = boardRef.current.getBoundingClientRect();
    const cx = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
    const cy = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
    const x = cx - rect.left, y = cy - rect.top;
    const dc = Math.floor(x / sqSize), dr = Math.floor(y / sqSize);
    if (dc >= 0 && dc < 8 && dr >= 0 && dr < 8) { const [tr, tc] = getBoardCoords(dr, dc); makeMove(dragging.r, dragging.c, tr, tc); }
    setDragging(null); setSelectedSq(null); setLegalDots([]);
  }, [dragging, flipped, makeMove, getBoardCoords]);

  useEffect(() => {
    window.addEventListener("mousemove", handleDragMove); window.addEventListener("mouseup", handleDragEnd);
    window.addEventListener("touchmove", handleDragMove, { passive: false }); window.addEventListener("touchend", handleDragEnd);
    return () => { window.removeEventListener("mousemove", handleDragMove); window.removeEventListener("mouseup", handleDragEnd); window.removeEventListener("touchmove", handleDragMove); window.removeEventListener("touchend", handleDragEnd); };
  }, [handleDragMove, handleDragEnd]);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "ArrowLeft") goToMove(currentMoveIdx - 1);
      else if (e.key === "ArrowRight") goToMove(currentMoveIdx + 1);
      else if (e.key === "ArrowUp") { e.preventDefault(); goToMove(-1); }
      else if (e.key === "ArrowDown") { e.preventDefault(); goToMove(moveHistory.length - 1); }
    };
    window.addEventListener("keydown", handler); return () => window.removeEventListener("keydown", handler);
  }, [currentMoveIdx, goToMove, moveHistory.length]);

  const renderArrow = (arrow, idx) => {
    const [fdr, fdc] = getDisplayCoords(arrow.fr, arrow.fc), [tdr, tdc] = getDisplayCoords(arrow.tr, arrow.tc);
    const x1 = fdc * sqSize + sqSize / 2, y1 = fdr * sqSize + sqSize / 2, x2 = tdc * sqSize + sqSize / 2, y2 = tdr * sqSize + sqSize / 2;
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const sx = x1 + Math.cos(angle) * 6, sy = y1 + Math.sin(angle) * 6;
    const mid = `ah-${idx}`;
    return (<g key={idx}><defs><marker id={mid} markerWidth="4" markerHeight="3" refX="2" refY="1.5" orient="auto"><polygon points="0 0, 4 1.5, 0 3" fill={arrow.color} /></marker></defs><line x1={sx} y1={sy} x2={x2} y2={y2} stroke={arrow.color} strokeWidth="5" strokeOpacity="0.75" markerEnd={`url(#${mid})`} strokeLinecap="round" /></g>);
  };

  const formatMoveList = () => {
    const pairs = [];
    for (let i = 0; i < moveHistory.length; i += 2) pairs.push({ num: Math.floor(i / 2) + 1, white: moveHistory[i], black: moveHistory[i + 1] || null, wIdx: i, bIdx: i + 1 });
    return pairs;
  };

  const isDotSq = (r, c) => legalDots.some(m => m.tr === r && m.tc === c);
  const isDotCap = (r, c) => board[r][c] && legalDots.some(m => m.tr === r && m.tc === c);
  const filteredLines = parsedLines.filter(l => l.name.toLowerCase().includes(searchFilter.toLowerCase()));
  const activeLineObj = parsedLines.find(l => l.id === activeLine);

  const detectedOpening = (() => {
    if (currentMoveIdx < 0) return activeLineObj ? { category: getCategory(activeLineObj), line: activeLineObj } : null;
    let bestMatch = null, bestLen = 0;
    for (const line of parsedLines) { let matchLen = 0; for (let i = 0; i <= currentMoveIdx && i < line.parsedMoves.length; i++) { const hm = moveHistory[i], lm = line.parsedMoves[i]; if (hm && lm && hm.fr === lm.fr && hm.fc === lm.fc && hm.tr === lm.tr && hm.tc === lm.tc) matchLen = i + 1; else break; } if (matchLen > bestLen) { bestLen = matchLen; bestMatch = line; } }
    if (!bestMatch || bestLen === 0) { const m0 = moveHistory[0]; if (m0?.fr === 6 && m0?.fc === 4 && m0?.tr === 4 && m0?.tc === 4) { if (currentMoveIdx >= 1 && moveHistory[1]?.fr === 1 && moveHistory[1]?.fc === 4) return { category: "King's Pawn Game", line: null }; return { category: "King's Pawn Opening", line: null }; } return null; }
    const cat = bestMatch.cat; let category = getCategory(bestMatch);
    if (bestLen >= 6 && cat === "evans") category = "Evans Gambit";
    else if (bestLen >= 7 && cat === "tk") { if (bestMatch.id === "tk9") category = "Fritz Variation"; else if (bestMatch.id === "tk10") category = "Ulvestad Variation"; else if (bestMatch.id === "tk11") category = "Traxler Counter-Gambit"; }
    else if (bestLen >= 7 && cat === "tk_d4" && ["tk13","tk14","tk15"].includes(bestMatch.id)) category = "Max Lange Attack";
    else if (bestLen >= 5 && cat === "ruy_berlin" && ["ruyB8","ruyB9"].includes(bestMatch.id) && bestLen >= 8) category = "Ruy Lopez: Berlin Wall";
    else if (bestLen >= 7 && cat === "ruy_mod" && ["ruyMod11","ruyMod12"].includes(bestMatch.id)) category = "Ruy Lopez: Siesta Variation";
    else if (bestLen >= 8 && cat === "ruy_6th") { if (["ruy6_37","ruy6_38"].includes(bestMatch.id)) category = "Ruy Lopez: Worrall Attack"; else if (["ruy6_39","ruy6_40"].includes(bestMatch.id)) category = "Ruy Lopez: Center Variation"; else if (bestMatch.id === "ruy6_42") category = "Ruy Lopez: Exchange Deferred"; }
    else if (bestLen >= 10 && cat === "ruy_open" && bestMatch.id === "ruyOp48") category = "Ruy Lopez: Dilworth Attack";
    else if (bestLen >= 4) { const m4 = moveHistory[4]; if (m4 && m4.tr === 4 && m4.tc === 1) category = "Ruy Lopez"; else if (bestLen < 5) category = "Italian Game"; }
    else if (bestLen >= 3) category = "Italian Game";
    else if (bestLen >= 2) category = "King's Knight Opening";
    else category = "King's Pawn Game";
    return { category, line: bestLen >= 6 ? bestMatch : null };
  })();

  const groupedLines = [];
  for (const { cat, label } of CATEGORY_ORDER) { const catLines = filteredLines.filter(l => l.cat === cat); if (catLines.length > 0) groupedLines.push({ label, lines: catLines }); }

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 500;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", background: "#1a1a2e", minHeight: "100vh", color: "#e0e0e0", fontFamily: "'Segoe UI', Tahoma, sans-serif", padding: "10px 0" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "#f0f0f0", margin: "0 0 10px" }}>Italian Game Repertoire</h1>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center", alignItems: "flex-start" }}>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <button onClick={() => setFlipped(!flipped)} style={{ background: "#2d2d4a", color: "#ccc", border: "1px solid #444", borderRadius: 4, padding: "5px 14px", cursor: "pointer", fontSize: 13 }}>Flip Board</button>
            <button onClick={resetBoard} style={{ background: "#2d2d4a", color: "#ccc", border: "1px solid #444", borderRadius: 4, padding: "5px 14px", cursor: "pointer", fontSize: 13 }}>Reset</button>
          </div>
          <div style={{ width: sqSize * 8, marginBottom: 4, borderRadius: 5, padding: "4px 10px", background: "#16213e", border: "1px solid #333", textAlign: "center", minHeight: 44, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", boxSizing: "border-box" }}>
            {detectedOpening ? (<><div style={{ fontSize: 15, fontWeight: 700, color: "#f0c040", letterSpacing: 0.5 }}>{detectedOpening.category}</div>{detectedOpening.line && (<div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}><div style={{ width: 8, height: 8, borderRadius: 2, background: detectedOpening.line.color, flexShrink: 0 }} /><span style={{ fontSize: 12, fontWeight: 500, color: "#aaa" }}>{detectedOpening.line.name}</span><span style={{ fontSize: 11, color: "#666" }}>({currentMoveIdx + 1}/{detectedOpening.line.parsedMoves.length})</span></div>)}</>) : (<span style={{ fontSize: 13, color: "#555" }}>Select a line to begin</span>)}
          </div>
          <div ref={boardRef} style={{ position: "relative", width: sqSize * 8, height: sqSize * 8, border: "2px solid #555", userSelect: "none", touchAction: "none" }}>
            {Array(8).fill(null).map((_, dr) => Array(8).fill(null).map((_, dc) => {
              const [r, c] = getBoardCoords(dr, dc); const isLight = (dr + dc) % 2 === 0; const piece = board[r][c];
              const isSelected = selectedSq && selectedSq[0] === r && selectedSq[1] === c;
              const isLM = lastMove && ((lastMove.fr === r && lastMove.fc === c) || (lastMove.tr === r && lastMove.tc === c));
              const isDragThis = dragging && dragging.r === r && dragging.c === c;
              const hasDot = isDotSq(r, c), isCapDot = isDotCap(r, c);
              let bg = isLight ? "#f0d9b5" : "#b58863";
              if (isLM) bg = isLight ? "#f7ec5e" : "#dac34b"; if (isSelected) bg = isLight ? "#f7f769" : "#bbcb2b";
              return (<div key={`${dr}-${dc}`} style={{ position: "absolute", left: dc * sqSize, top: dr * sqSize, width: sqSize, height: sqSize, background: bg, display: "flex", alignItems: "center", justifyContent: "center", cursor: piece ? "pointer" : hasDot ? "pointer" : "default" }}
                onClick={() => handleSquareClick(r, c)} onMouseDown={(e) => piece && handleDragStart(e, r, c)} onTouchStart={(e) => piece && handleDragStart(e, r, c)}>
                {dc === 0 && <span style={{ position: "absolute", top: 2, left: 3, fontSize: 10, fontWeight: 700, color: isLight ? "#b58863" : "#f0d9b5" }}>{flipped ? (dr + 1) : (8 - dr)}</span>}
                {dr === 7 && <span style={{ position: "absolute", bottom: 1, right: 3, fontSize: 10, fontWeight: 700, color: isLight ? "#b58863" : "#f0d9b5" }}>{FILES[flipped ? 7 - dc : dc]}</span>}
                {piece && !isDragThis && <span style={{ fontSize: sqSize * 0.78, lineHeight: 1, pointerEvents: "none", color: piece.color === "b" ? "#000" : "#fff", textShadow: piece.color === "w" ? "0 0 3px rgba(0,0,0,0.5)" : "0 0 3px rgba(255,255,255,0.4)" }}>{PIECE_UNICODE[piece.type][piece.color]}</span>}
                {hasDot && !isCapDot && <div style={{ position: "absolute", width: 16, height: 16, borderRadius: "50%", background: "rgba(0,0,0,0.25)", pointerEvents: "none" }} />}
                {isCapDot && <div style={{ position: "absolute", width: sqSize - 4, height: sqSize - 4, borderRadius: "50%", border: "4px solid rgba(0,0,0,0.25)", pointerEvents: "none", boxSizing: "border-box" }} />}
              </div>);
            }))}
            <svg style={{ position: "absolute", top: 0, left: 0, width: sqSize * 8, height: sqSize * 8, pointerEvents: "none" }}>{arrows.map((a, i) => renderArrow(a, i))}</svg>
            {dragging && <span style={{ position: "absolute", left: dragPos.x - sqSize / 2, top: dragPos.y - sqSize / 2, fontSize: sqSize * 0.85, lineHeight: 1, pointerEvents: "none", zIndex: 100, color: dragging.piece.color === "b" ? "#000" : "#fff", filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.5))" }}>{PIECE_UNICODE[dragging.piece.type][dragging.piece.color]}</span>}
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 8 }}>
            {[{ label: "⏮", action: () => goToMove(-1) }, { label: "◀", action: () => goToMove(currentMoveIdx - 1) }, { label: "▶", action: () => goToMove(currentMoveIdx + 1) }, { label: "⏭", action: () => goToMove(moveHistory.length - 1) }].map((btn, i) => (
              <button key={i} onClick={btn.action} style={{ background: "#2d2d4a", color: "#ddd", border: "1px solid #555", borderRadius: 4, padding: "6px 16px", cursor: "pointer", fontSize: 16 }}>{btn.label}</button>))}
          </div>
        </div>
        <div style={{ width: 300, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ background: "#16213e", borderRadius: 6, padding: 10, maxHeight: 200, overflowY: "auto", border: "1px solid #333" }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, color: "#aaa" }}>Moves</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
              {formatMoveList().map(pair => (<div key={pair.num} style={{ display: "flex", gap: 2, alignItems: "center", fontSize: 13 }}>
                <span style={{ color: "#777", minWidth: 24 }}>{pair.num}.</span>
                <span onClick={() => goToMove(pair.wIdx)} style={{ padding: "2px 5px", borderRadius: 3, cursor: "pointer", background: currentMoveIdx === pair.wIdx ? "#4a6fa5" : "transparent", color: currentMoveIdx === pair.wIdx ? "#fff" : "#ccc" }}>{pair.white?.san || "?"}</span>
                {pair.black && <span onClick={() => goToMove(pair.bIdx)} style={{ padding: "2px 5px", borderRadius: 3, cursor: "pointer", background: currentMoveIdx === pair.bIdx ? "#4a6fa5" : "transparent", color: currentMoveIdx === pair.bIdx ? "#fff" : "#ccc" }}>{pair.black?.san || "?"}</span>}
              </div>))}
              {moveHistory.length === 0 && <span style={{ color: "#555", fontSize: 12 }}>Select a line to begin</span>}
            </div>
          </div>
          <div style={{ background: "#16213e", borderRadius: 6, padding: 10, maxHeight: 420, overflowY: "auto", border: "1px solid #333" }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "#aaa" }}>Lines ({filteredLines.length})</div>
            <input type="text" placeholder="Filter lines..." value={searchFilter} onChange={e => setSearchFilter(e.target.value)} style={{ width: "100%", padding: "5px 8px", marginBottom: 8, background: "#1a1a2e", border: "1px solid #444", borderRadius: 4, color: "#ccc", fontSize: 12, boxSizing: "border-box", outline: "none" }} />
            {groupedLines.map((group, gi) => (<div key={gi}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#667", textTransform: "uppercase", letterSpacing: 0.5, margin: "8px 0 4px", paddingBottom: 3, borderBottom: "1px solid #2a2a40" }}>{group.label}</div>
              {group.lines.map(line => (<div key={line.id} onClick={() => loadLine(line)} style={{ padding: "6px 10px", marginBottom: 3, borderRadius: 5, cursor: "pointer", background: activeLine === line.id ? "#2a3f5f" : "#1a1a2e", borderLeft: `4px solid ${line.color}`, transition: "background 0.15s" }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: activeLine === line.id ? "#fff" : "#bbb" }}>{line.name}</div>
                <div style={{ fontSize: 10, color: "#666", marginTop: 1 }}>{line.parsedMoves.length} moves</div>
              </div>))}
            </div>))}
          </div>
          <div style={{ fontSize: 11, color: "#555", textAlign: "center" }}>Arrow keys to navigate · Click or drag pieces</div>
        </div>
      </div>
    </div>
  );
}

export default ChessApp;
