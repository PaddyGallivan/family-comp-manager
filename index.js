var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// index.js
var json = /* @__PURE__ */ __name((d, s = 200) => new Response(JSON.stringify(d), {
  status: s,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "*",
    "Access-Control-Allow-Headers": "*"
  }
}), "json");
async function initDB(env) {
  const db = env.D1;
  if (!db) return;
  try {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS comps (
        id TEXT PRIMARY KEY,
        name TEXT,
        type TEXT,
        season TEXT,
        status TEXT,
        created_at TEXT
      );
      CREATE TABLE IF NOT EXISTS tips (
        id TEXT PRIMARY KEY,
        comp_id TEXT,
        round INTEGER,
        user_id TEXT,
        username TEXT,
        picks TEXT,
        submitted_at TEXT
      );
      CREATE TABLE IF NOT EXISTS results (
        id TEXT PRIMARY KEY,
        comp_id TEXT,
        round INTEGER,
        results TEXT,
        submitted_at TEXT
      );
      CREATE TABLE IF NOT EXISTS standings (
        id TEXT PRIMARY KEY,
        comp_id TEXT,
        user_id TEXT,
        username TEXT,
        points INTEGER,
        correct INTEGER,
        position INTEGER,
        updated_at TEXT
      );
      CREATE TABLE IF NOT EXISTS payouts (
        id TEXT PRIMARY KEY,
        comp_id TEXT,
        round INTEGER,
        user_id TEXT,
        username TEXT,
        payout REAL,
        created_at TEXT
      );
      CREATE TABLE IF NOT EXISTS trash_talk (
        id TEXT PRIMARY KEY,
        comp_id TEXT,
        user_id TEXT,
        username TEXT,
        message TEXT,
        emoji TEXT,
        created_at TEXT
      );
      CREATE TABLE IF NOT EXISTS family_comp_commentary (
        id TEXT PRIMARY KEY,
        comp_type TEXT,
        round_number INTEGER,
        standings_snapshot TEXT,
        commentary TEXT,
        created_at TEXT
      );
    `);
  } catch (e) {
    console.log("Tables may already exist:", e.message);
  }
}
__name(initDB, "initDB");
async function createComp(env, name, type, season) {
  const db = env.D1;
  if (!db) return { error: "D1 not bound" };
  try {
    const compId = "comp_" + Date.now();
    await db.prepare(`
      INSERT INTO comps (id, name, type, season, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(compId, name, type, season, "active", (/* @__PURE__ */ new Date()).toISOString()).run();
    return { ok: true, id: compId };
  } catch (e) {
    return { error: e.message };
  }
}
__name(createComp, "createComp");
async function submitTips(env, compId, round, userId, username, picks) {
  const db = env.D1;
  if (!db) return { error: "D1 not bound" };
  try {
    const tipId = "tip_" + Date.now();
    await db.prepare(`
      INSERT INTO tips (id, comp_id, round, user_id, username, picks, submitted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(tipId, compId, round, userId, username, JSON.stringify(picks), (/* @__PURE__ */ new Date()).toISOString()).run();
    return { ok: true, id: tipId };
  } catch (e) {
    return { error: e.message };
  }
}
__name(submitTips, "submitTips");
async function submitResults(env, compId, round, results) {
  const db = env.D1;
  if (!db) return { error: "D1 not bound" };
  try {
    const resultId = "result_" + Date.now();
    await db.prepare(`
      INSERT INTO results (id, comp_id, round, results, submitted_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(resultId, compId, round, JSON.stringify(results), (/* @__PURE__ */ new Date()).toISOString()).run();
    const tips = await db.prepare(`
      SELECT * FROM tips WHERE comp_id = ? AND round = ?
    `).bind(compId, round).all();
    if (tips.results) {
      for (const tip of tips.results) {
        const userPicks = JSON.parse(tip.picks);
        const correct = Object.keys(userPicks).filter((k) => results[k] === userPicks[k]).length;
        const existing = await db.prepare(`
          SELECT * FROM standings WHERE comp_id = ? AND user_id = ?
        `).bind(compId, tip.user_id).first();
        if (existing) {
          await db.prepare(`
            UPDATE standings SET points = points + ?, correct = correct + ? WHERE id = ?
          `).bind(correct, correct, existing.id).run();
        } else {
          const standId = "stand_" + Date.now();
          await db.prepare(`
            INSERT INTO standings (id, comp_id, user_id, username, points, correct, position, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(standId, compId, tip.user_id, tip.username, correct, correct, 1, (/* @__PURE__ */ new Date()).toISOString()).run();
        }
      }
    }
    return { ok: true, id: resultId };
  } catch (e) {
    return { error: e.message };
  }
}
__name(submitResults, "submitResults");
async function getStandings(env, compId) {
  const db = env.D1;
  if (!db) return { error: "D1 not bound", standings: [] };
  try {
    const result = await db.prepare(`
      SELECT * FROM standings 
      WHERE comp_id = ? 
      ORDER BY points DESC, correct DESC
    `).bind(compId).all();
    if (result.results) {
      for (let i = 0; i < result.results.length; i++) {
        await db.prepare(`
          UPDATE standings SET position = ? WHERE id = ?
        `).bind(i + 1, result.results[i].id).run();
      }
    }
    return { standings: result.results || [] };
  } catch (e) {
    return { error: e.message, standings: [] };
  }
}
__name(getStandings, "getStandings");
async function getPayouts(env, compId) {
  const db = env.D1;
  if (!db) return { error: "D1 not bound", payouts: [] };
  try {
    const result = await db.prepare(`
      SELECT * FROM payouts 
      WHERE comp_id = ? 
      ORDER BY created_at DESC
    `).bind(compId).all();
    return { payouts: result.results || [] };
  } catch (e) {
    return { error: e.message, payouts: [] };
  }
}
__name(getPayouts, "getPayouts");
async function postTrashTalk(env, compId, userId, username, message, emoji = "\u{1F525}") {
  const db = env.D1;
  if (!db) return { error: "D1 not bound" };
  try {
    const talkId = "talk_" + Date.now();
    await db.prepare(`
      INSERT INTO trash_talk (id, comp_id, user_id, username, message, emoji, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(talkId, compId, userId, username, message, emoji, (/* @__PURE__ */ new Date()).toISOString()).run();
    return { ok: true, id: talkId };
  } catch (e) {
    return { error: e.message };
  }
}
__name(postTrashTalk, "postTrashTalk");
async function getTrashTalk(env, compId, limit = 50) {
  const db = env.D1;
  if (!db) return { error: "D1 not bound", feed: [] };
  try {
    const result = await db.prepare(`
      SELECT * FROM trash_talk 
      WHERE comp_id = ? 
      ORDER BY created_at DESC
      LIMIT ?
    `).bind(compId, limit).all();
    return { feed: result.results || [] };
  } catch (e) {
    return { error: e.message, feed: [] };
  }
}
__name(getTrashTalk, "getTrashTalk");
async function getMyTips(env, compId, userId) {
  const db = env.D1;
  if (!db) return { error: "D1 not bound", tips: [] };
  try {
    const result = await db.prepare(`
      SELECT * FROM tips 
      WHERE comp_id = ? AND user_id = ? 
      ORDER BY submitted_at DESC
    `).bind(compId, userId).all();
    return { tips: result.results || [] };
  } catch (e) {
    return { error: e.message, tips: [] };
  }
}
__name(getMyTips, "getMyTips");
async function generateCommentary(env, body) {
  const db = env.D1;
  if (!db) return json({ error: "D1 not bound" }, 500);
  const { compType, roundNumber, standings } = body;
  if (!standings) return json({ error: "standings is required in request body" }, 400);
  const standingsText = typeof standings === "string" ? standings : JSON.stringify(standings, null, 2);
  const prompt = `You are writing the weekly update for the Gallivan family ${compType || "AFL"} footy tipping competition after Round ${roundNumber || "?"}.

Here are the current standings:

${standingsText}

Write funny, roasting, warm-hearted commentary about these standings. Call out the leader with hype, mock whoever is last (lovingly), highlight any interesting position changes, and throw in at least one solid family banter line. Keep it punchy \u2014 3 to 5 short paragraphs. Use emojis. Make it feel like a group chat message from a funny uncle. \u{1F3C8}`;
  let commentary;
  try {
    const thorRes = await fetch("https://thor.pgallivan.workers.dev/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: prompt })
    });
    if (!thorRes.ok) {
      const errText = await thorRes.text();
      return json({ error: `Thor returned ${thorRes.status}: ${errText}` }, 502);
    }
    const thorData = await thorRes.json();
    commentary = thorData.reply || thorData.response || thorData.message || thorData.text || JSON.stringify(thorData);
  } catch (e) {
    return json({ error: `Failed to reach Thor: ${e.message}` }, 502);
  }
  try {
    const rowId = "commentary_" + Date.now();
    await db.prepare(`
      INSERT INTO family_comp_commentary (id, comp_type, round_number, standings_snapshot, commentary, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      rowId,
      compType || null,
      roundNumber || null,
      standingsText,
      commentary,
      (/* @__PURE__ */ new Date()).toISOString()
    ).run();
  } catch (e) {
    console.error("Failed to store commentary:", e.message);
    return json({ commentary, warning: "Generated but failed to store: " + e.message });
  }
  return json({ commentary });
}
__name(generateCommentary, "generateCommentary");
async function getLatestCommentary(env) {
  const db = env.D1;
  if (!db) return json({ error: "D1 not bound" }, 500);
  try {
    const row = await db.prepare(`
      SELECT * FROM family_comp_commentary
      ORDER BY created_at DESC
      LIMIT 1
    `).first();
    if (!row) return json({ commentary: null, message: "No commentary generated yet" });
    return json({ commentary: row });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
__name(getLatestCommentary, "getLatestCommentary");
var index_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    if (method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "*",
          "Access-Control-Allow-Headers": "*"
        }
      });
    }
    if (path === "/health" || path === "/ping") {
      return json({ ok: true, worker: "family-comp-manager", ts: (/* @__PURE__ */ new Date()).toISOString() });
    }
    await initDB(env);
    if (path === "/ai/commentary" && method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch (e) {
        return json({ error: "Invalid JSON body" }, 400);
      }
      return generateCommentary(env, body);
    }
    if (path === "/ai/commentary/latest" && method === "GET") {
      return getLatestCommentary(env);
    }
    if (path === "/comps" && method === "POST") {
      const body = await request.json();
      const result = await createComp(env, body.name, body.type, body.season);
      return json(result);
    }
    if (path.startsWith("/comps/") && path.endsWith("/tips") && method === "POST") {
      const compId = path.split("/")[2];
      const body = await request.json();
      const result = await submitTips(env, compId, body.round, body.userId, body.username, body.picks);
      return json(result);
    }
    if (path.startsWith("/comps/") && path.endsWith("/results") && method === "POST") {
      const compId = path.split("/")[2];
      const body = await request.json();
      const result = await submitResults(env, compId, body.round, body.results);
      return json(result);
    }
    if (path.startsWith("/comps/") && path.endsWith("/standings") && method === "GET") {
      const compId = path.split("/")[2];
      const result = await getStandings(env, compId);
      return json(result);
    }
    if (path.startsWith("/comps/") && path.endsWith("/payouts") && method === "GET") {
      const compId = path.split("/")[2];
      const result = await getPayouts(env, compId);
      return json(result);
    }
    if (path.startsWith("/comps/") && path.endsWith("/trash-talk") && method === "POST") {
      const compId = path.split("/")[2];
      const body = await request.json();
      const result = await postTrashTalk(env, compId, body.userId, body.username, body.message, body.emoji);
      return json(result);
    }
    if (path.startsWith("/comps/") && path.endsWith("/trash-talk") && method === "GET") {
      const compId = path.split("/")[2];
      const limit = parseInt(url.searchParams.get("limit") || "50");
      const result = await getTrashTalk(env, compId, limit);
      return json(result);
    }
    if (path.startsWith("/comps/") && path.includes("/tips/") && method === "GET") {
      const parts = path.split("/");
      const compId = parts[2];
      const userId = parts[4];
      const result = await getMyTips(env, compId, userId);
      return json(result);
    }
    if (path === "/health" && method === "GET") {
      return json({ ok: true, worker: "family-comp-manager", version: "2.1.0", routes: [
        "POST /comps",
        "POST /comps/:id/tips",
        "POST /comps/:id/results",
        "GET  /comps/:id/standings",
        "GET  /comps/:id/payouts",
        "POST /comps/:id/trash-talk",
        "GET  /comps/:id/trash-talk",
        "GET  /comps/:id/tips/:userId",
        "POST /ai/commentary",
        "GET  /ai/commentary/latest"
      ] });
    }
    return json({ error: "Route not found", path, method }, 404);
  }
};
export {
  index_default as default
};
//# sourceMappingURL=index.js.map