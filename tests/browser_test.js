// Real-browser walkthrough of the whole product. Run with the server up on :5000.
const { chromium } = require("playwright");
const BASE = process.env.BASE || "http://localhost:5000";
const SHOTS = process.env.SHOTS || "/tmp/shots";
require("fs").mkdirSync(SHOTS, { recursive: true });
let fails = 0; const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fails++; };

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1100, height: 900 } })).newPage();
  const errors = [];
  page.on("pageerror", e => errors.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error" && !/cdnjs|ERR_|Failed to load resource/.test(m.text())) errors.push("console: " + m.text()); });
  page.on("dialog", d => d.accept());
  const shot = n => page.screenshot({ path: `${SHOTS}/${n}.png`, fullPage: true });
  const go = async h => { await page.goto(BASE + "/#/" + h); await page.waitForTimeout(500); };
  const txt = async () => (await page.locator("#view").innerText());

  async function adminLogin() {
    await go("control");
    if (await page.locator("#pw").count()) { await page.fill("#pw", "glassballot-demo"); await page.click('button:has-text("Sign in")'); await page.waitForTimeout(800); }
  }
  async function voteAs(id, candidate, opts = {}) {
    await go("vote");
    if (await page.locator('button:has-text("Next voter")').count()) await page.click('button:has-text("Next voter")');
    await page.fill("#vid", id); await page.click('button:has-text("Send my code")');
    await page.waitForSelector(".inbox .code");
    await page.fill("#otp", (await page.locator(".inbox .code").innerText()).trim()); await page.click('button:has-text("Verify and continue")');
    await page.waitForSelector(".cands");
    await page.click(`.cand:has-text("${candidate}")`); await page.click('button:has-text("Seal my ballot")');
    await page.waitForSelector(".fp");
    if (opts.test) { await page.click('button:has-text("Test this ballot")'); await page.waitForSelector(".notice.ok, .notice.bad"); }
    if (opts.stopAfterTest) return;
    if (opts.test) { await page.click('button:has-text("Seal a fresh ballot")'); await page.waitForSelector("text=Cast this ballot"); }
    await page.click('button:has-text("Cast this ballot")'); await page.waitForSelector(".stub");
  }

  await go("vote");
  ok((await txt()).includes("Cast your vote"), "vote page renders");

  await adminLogin();
  await page.click('button:has-text("Add 10 sample votes")'); await page.waitForSelector("text=sample ballots added");
  await page.waitForTimeout(600);
  ok((await txt()).includes("10 = 10"), "Two Books show 10 = 10 after seeding");
  ok((await txt()).includes("Chain valid"), "integrity tile says Chain valid");
  ok((await txt()).includes("3 of 3 agree"), "all three witnesses agree");
  await shot("1_control_clean");

  await voteAs("RGIT26031", "Riya Menon", { test: true });
  const stubText = await page.locator(".stub").innerText();
  ok(/GB-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}/.test(stubText), "Proof Card shows a receipt code");
  ok(!/Riya/.test(stubText), "Proof Card does not reveal the choice");
  await shot("2_proof_card");
  await page.click('button:has-text("Check my card now")'); await page.waitForSelector(".notice.ok, .notice.bad");
  ok((await txt()).includes("Verified."), "Proof Card verifies in the browser");
  await shot("3_verified");

  // compromised device must be caught by Test My Ballot
  await adminLogin();
  await page.click('button:has-text("Compromised voting device: OFF")'); await page.waitForSelector("text=simulation ON");
  await voteAs("RGIT26032", "Riya Menon", { test: true, stopAfterTest: true });
  ok((await txt()).includes("Test failed. Do not cast."), "cheating device is caught by Test My Ballot");
  await shot("4_device_caught");
  await adminLogin();
  ok((await txt()).includes("DEVICE_MISMATCH"), "mismatch raised an alert in the control room");
  await page.click('button:has-text("Compromised voting device: ON")'); await page.waitForSelector("text=simulation OFF");

  // insider rewrites history and re-signs: server is fooled, witnesses are not
  await page.click('button:has-text("Insider rewrites history and re-signs")'); await page.waitForSelector("text=Witnesses can");
  await page.waitForTimeout(800);
  ok((await txt()).includes("Chain valid"), "after rewrite the server's own check still says valid");
  ok(/\d of 3 ALARM/.test(await txt()), "witnesses raise ALARM");
  await shot("5_rewrite_alarm");
  await go("witnesses"); await page.waitForTimeout(800);
  ok((await txt()).includes("ALARM"), "witness page shows ALARM");
  await shot("6_witnesses");
  await go("verify"); await page.click('button:has-text("Run full audit")'); await page.waitForSelector(".notice.bad, .notice.ok");
  ok((await txt()).includes("Tampering detected"), "browser full audit detects the rewrite");
  await shot("7_audit_detects");

  // reset, naive edit
  await adminLogin(); await page.click('button:has-text("Reset demo")'); await page.waitForSelector("text=Demo reset");
  await page.click('button:has-text("Add 10 sample votes")'); await page.waitForSelector("text=sample ballots added");
  await page.click('button:has-text("Insider edits one ballot in the database")'); await page.waitForSelector("text=edited in place");
  await page.waitForTimeout(600);
  ok(/Broken at #\d+/.test(await txt()), "naive edit is caught and names the entry");
  await shot("8_naive_edit");

  // clean run to tally
  await page.click('button:has-text("Reset demo")'); await page.waitForSelector("text=Demo reset");
  await page.click('button:has-text("Add 10 sample votes")'); await page.waitForSelector("text=sample ballots added");
  await page.click('button:has-text("Close voting")'); await page.waitForSelector("text=Voting closed.");
  await page.click('button:has-text("Trustee 1")'); await page.click('button:has-text("Trustee 3")');
  await page.click('button:has-text("Unlock and publish tally")'); await page.waitForSelector("text=Tally published");
  await page.waitForTimeout(800);
  ok((await txt()).includes("10 ballots decrypted for 10 ledger entries"), "tally matches ledger");
  await shot("9_results");

  ok(errors.length === 0, "no JavaScript errors" + (errors.length ? ": " + errors.join(" | ") : ""));
  await browser.close();
  console.log(fails ? fails + " FAILED" : "ALL BROWSER CHECKS PASSED");
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
