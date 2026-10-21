import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { io } from "socket.io-client";

const testLobbySessions = new Map<string, string>();

async function rememberTestLobby(page: Page, code: string) {
  const token = await page.evaluate(
    (lobbyCode) => localStorage.getItem(`c52:session:${lobbyCode}`),
    code,
  );
  if (!token) throw new Error(`Missing cleanup token for test lobby ${code}`);
  testLobbySessions.set(code, token);
}

async function closeTestLobby(code: string, token: string) {
  await new Promise<void>((resolve, reject) => {
    const cleanupSocket = io("http://127.0.0.1:3001", {
      forceNew: true,
      reconnection: false,
      timeout: 4_000,
      transports: ["websocket"],
    });
    let finished = false;
    const finish = (error?: Error) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      cleanupSocket.disconnect();
      if (error) reject(error);
      else resolve();
    };
    const timeout = setTimeout(
      () => finish(new Error(`Timed out while closing test lobby ${code}`)),
      5_000,
    );
    cleanupSocket.once("connect_error", (error) => finish(error));
    cleanupSocket.once("connect", () =>
      cleanupSocket.emit(
        "lobby:resume",
        { code, token },
        (resumeResult: { ok?: boolean; error?: string }) => {
          if (!resumeResult.ok) {
            if (resumeResult.error === "lobby_not_found") finish();
            else
              finish(
                new Error(
                  `Could not resume test lobby ${code}: ${resumeResult.error ?? "unknown error"}`,
                ),
              );
            return;
          }
          cleanupSocket.emit(
            "lobby:close",
            (closeResult: { ok?: boolean; error?: string }) => {
              if (!closeResult.ok)
                finish(
                  new Error(
                    `Could not close test lobby ${code}: ${closeResult.error ?? "unknown error"}`,
                  ),
                );
              else finish();
            },
          );
        },
      ),
    );
  });
}

test.afterEach(async () => {
  const lobbies = [...testLobbySessions];
  testLobbySessions.clear();
  for (const [code, token] of lobbies) await closeTestLobby(code, token);
});

test("home is keyboard-ready and has no detectable WCAG A/AA violations", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute(
    "data-accent",
    "collection",
  );
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.locator(".skip-link")).toBeFocused();
  const name = page.getByLabel(/Display name|Benutzername/);
  const createLobby = page.getByRole("button", {
    name: /Create lobby|Lobby erstellen/,
  });
  await expect(name).toHaveAttribute("maxlength", "16");
  await expect(
    page.getByText(/1 to 32 characters|1 bis 32 Zeichen/),
  ).toHaveCount(0);
  await expect(createLobby).toBeDisabled();
  await expect(
    page.getByRole("button", { name: /Join lobby|Lobby beitreten/ }),
  ).toBeDisabled();
  await name.focus();
  await name.blur();
  await expect(
    page.getByText(/Please enter a display name|Bitte gib einen Benutzernamen/),
  ).toBeVisible();
  await name.fill("A1");
  await expect(name).toHaveAttribute("aria-invalid", "true");
  await expect(
    page.getByText(/at least three letters|mindestens drei Buchstaben/),
  ).toBeVisible();
  await expect(createLobby).toBeDisabled();
  await name.fill("Anna!");
  await expect(
    page.getByText(/16 letters, numbers|16 Buchstaben, Zahlen/),
  ).toBeVisible();
  await expect(createLobby).toBeDisabled();
  await name.fill("Ann_1-");
  await expect(name).toHaveAttribute("aria-invalid", "false");
  await expect(createLobby).toBeEnabled();
  await name.fill("Anna");
  const code = page.getByLabel(/Lobby code|Lobby-Code/);
  await code.focus();
  await code.blur();
  await expect(code).toHaveAttribute("aria-invalid", "false");
  await code.fill("AAAAAAAA");
  await expect(
    page.getByText(
      /No lobby was found for this code|Unter diesem Code wurde keine Lobby gefunden/,
    ),
  ).toBeVisible();
  await expect(code).toHaveAttribute("aria-invalid", "true");
  await expect(
    page.getByRole("button", { name: /Join lobby|Lobby beitreten/ }),
  ).toBeDisabled();
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await page
    .getByRole("button", { name: /Show all games|Alle Spiele anzeigen/ })
    .click();
  const gamesDialog = page.getByRole("dialog");
  const searchGames = gamesDialog.getByRole("searchbox", {
    name: /Search games|Spiele suchen/,
  });
  await expect(searchGames).toHaveAttribute(
    "placeholder",
    /Enter a name|Name eingeben/,
  );
  await expect(gamesDialog.locator(".game-catalog-mark")).toHaveCount(0);
  await expect(
    gamesDialog.locator(".game-alias-chip").filter({ hasText: "Fool" }),
  ).toHaveCount(0);
  await searchGames.fill("Mau Mau");
  const mauMauGame = gamesDialog
    .locator(".game-catalog-card")
    .filter({ hasText: "Mau-Mau" });
  await expect(mauMauGame).toBeVisible();
  await expect(
    gamesDialog.locator(".game-alias-chip").filter({ hasText: /^Mau Mau$/ }),
  ).toHaveCount(0);
  await mauMauGame.getByRole("button", { name: /Select|Auswählen/ }).click();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("c52:game")))
    .toBe("mau-mau");
  await page.reload();
  const gamePicker = page.locator(".game-picker");
  if (testInfo.project.name === "mobile-chromium")
    await expect(
      gamePicker.getByRole("combobox", { name: /Card game|Kartenspiel/ }),
    ).toHaveValue("mau-mau");
  else
    await expect(
      gamePicker.getByRole("button", { name: /Card game|Kartenspiel/ }),
    ).toContainText("Mau-Mau");
  await page
    .getByRole("button", { name: /Show all games|Alle Spiele anzeigen/ })
    .click();
  const reopenedGamesDialog = page.getByRole("dialog");
  const reopenedSearchGames = reopenedGamesDialog.getByRole("searchbox", {
    name: /Search games|Spiele suchen/,
  });
  await reopenedSearchGames.fill("31");
  await expect(reopenedGamesDialog.locator(".game-catalog-card")).toContainText(
    /Schwimmen/,
  );
  await expect(reopenedGamesDialog.locator(".game-alias-chip")).toHaveCount(0);
  await reopenedSearchGames.fill("Fool");
  await expect(
    reopenedGamesDialog.getByText(/No game found|Kein Spiel gefunden/),
  ).toBeVisible();
  await reopenedSearchGames.fill("Skat");
  await expect(
    reopenedGamesDialog.getByText(/No game found|Kein Spiel gefunden/),
  ).toBeVisible();
  await expect(
    reopenedGamesDialog.getByText(
      /Try a different name\.|Versuche einen anderen Namen\./,
    ),
  ).toBeVisible();
  await reopenedGamesDialog
    .getByRole("button", { name: /Dismiss|Schließen/ })
    .click();
  await page.evaluate(() => localStorage.setItem("c52:language", "de"));
  await page.reload();
  await page.getByRole("button", { name: "Alle Spiele anzeigen" }).click();
  const germanGamesDialog = page.getByRole("dialog");
  const germanGameSearch = germanGamesDialog.getByRole("searchbox", {
    name: "Spiele suchen",
  });
  await germanGameSearch.fill("Hosen runter");
  await expect(germanGamesDialog.locator(".game-catalog-card")).toContainText(
    "Schwimmen",
  );
  await expect(
    germanGamesDialog
      .locator(".game-alias-chip")
      .filter({ hasText: /^Hosen runter$/ }),
  ).toHaveCount(1);
  await germanGameSearch.fill("Thirty-One");
  await expect(
    germanGamesDialog.getByText("Kein Spiel gefunden"),
  ).toBeVisible();
  await germanGamesDialog.getByRole("button", { name: "Schließen" }).click();
  await page.goto("/?lobby=AAAAAAAA");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByLabel(/Lobby code|Lobby-Code/)).toHaveValue("");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);
  if (testInfo.project.name === "mobile-chromium") {
    await expect(
      page.getByRole("combobox", { name: /Color theme|Farbschema/ }),
    ).toBeVisible();
  } else {
    const theme = page.getByRole("button", { name: /Color theme|Farbschema/ });
    const themeList = page.getByRole("listbox", {
      name: /Color theme|Farbschema/,
    });
    await expect(theme).toBeVisible();
    await theme.press("Enter");
    await expect(themeList).toBeVisible();
    await theme.press("ArrowDown");
    await theme.press("Enter");
    await expect(theme).toContainText(/Light|Hell/);
    await expect(themeList).toBeHidden();
    await theme.click();
    await themeList.getByRole("option", { name: /Dark|Dunkel/ }).click();
    await expect(theme).toContainText(/Dark|Dunkel/);
    await expect(theme).toHaveAttribute("aria-expanded", "false");
    await expect(themeList).toBeHidden();
  }
  await page
    .getByRole("button", { name: /^Settings$|^Einstellungen$/ })
    .click();
  const settings = page.getByRole("dialog");
  const accentLabel = /Accent color|Akzentfarbe/;
  if (testInfo.project.name === "mobile-chromium") {
    const accent = settings.getByRole("combobox", { name: accentLabel });
    await expect(accent.locator("option")).toHaveCount(6);
    await accent.selectOption("amber");
  } else {
    const accent = settings.getByRole("button", { name: accentLabel });
    await accent.click();
    await expect(settings.getByRole("option")).toHaveCount(6);
    await settings.getByRole("option", { name: /Amber|Bernstein/ }).click();
  }
  await expect(page.locator("html")).toHaveAttribute("data-accent", "amber");
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("c52:prefs") ?? "{}").accent,
    ),
  ).toBe("amber");
  await settings.getByRole("button", { name: /Dismiss|Schließen/ }).click();
});

test("site notice and privacy policy are available in both languages", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("c52:language", "de"));
  await page.goto("/impressum");
  await expect(
    page.getByRole("heading", { level: 1, name: "Impressum" }),
  ).toBeVisible();
  await expect(page.getByText("Kaiser-Otto-Ring 6")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "collection52@steinente.de" }),
  ).toHaveAttribute("href", "mailto:collection52@steinente.de");
  await expect(
    page.getByRole("contentinfo").getByRole("link", { name: "Datenschutz" }),
  ).toHaveAttribute("href", "/datenschutz");

  await page.goto("/datenschutz");
  await expect(
    page.getByRole("heading", { level: 1, name: "Datenschutzerklärung" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "1. Datenschutz auf einen Blick" }),
  ).toBeVisible();
  await expect(
    page.getByText("Kommunikation via WhatsApp", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/zuständigen Aufsichtsbehörde/).first(),
  ).toBeVisible();
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);

  await page.evaluate(() => localStorage.setItem("c52:language", "en"));
  await page.reload();
  await expect(
    page.getByRole("heading", { level: 1, name: "Privacy Policy" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "1. An overview of data protection" }),
  ).toBeVisible();
  await page.goto("/impressum");
  await expect(
    page.getByRole("heading", { level: 1, name: "Site Notice" }),
  ).toBeVisible();
});

test("two browser contexts can create, join, and start Durak", async ({
  browser,
}) => {
  const hostContext = await browser.newContext({
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const guestContext = await browser.newContext();
  await hostContext.addInitScript(() => {
    window.speechSynthesis.cancel = () =>
      sessionStorage.setItem("c52:speech-cancelled-test", "true");
    window.speechSynthesis.speak = (utterance) => {
      const spoken = JSON.parse(
        sessionStorage.getItem("c52:spoken-test") ?? "[]",
      ) as string[];
      spoken.push(utterance.text);
      sessionStorage.setItem("c52:spoken-test", JSON.stringify(spoken));
      sessionStorage.setItem("c52:last-spoken-test", utterance.text);
    };
  });
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();
  try {
    await host.goto("/");
    const create = host.getByRole("form").filter({
      has: host.getByRole("heading", { name: /Start playing|Spiel starten/ }),
    });
    await create.getByLabel(/Display name|Benutzername/).fill("Anna");
    await create
      .getByRole("checkbox", { name: /Protect lobby|Lobby mit Passwort/ })
      .check();
    await expect(
      create.getByRole("button", { name: /Create lobby|Lobby erstellen/ }),
    ).toBeDisabled();
    await create
      .getByLabel(/Lobby password|Lobby-Passwort/)
      .fill("secret-pass");
    await create
      .getByRole("button", { name: /Create lobby|Lobby erstellen/ })
      .click();
    const lobbyHeading = host.getByRole("heading", {
      level: 1,
      name: /^Lobby [A-Z2-9X]{8}$/,
    });
    await expect(lobbyHeading).toBeVisible();
    const startGame = host.getByRole("button", {
      name: /Start game|Partie starten/,
    });
    await expect(startGame).toBeDisabled();
    const code = (await lobbyHeading.textContent())!.split(" ").at(-1)!;
    await rememberTestLobby(host, code);
    await host.addInitScript(() => {
      const state = window as typeof window & { c52HomeFlashed?: boolean };
      state.c52HomeFlashed = false;
      new MutationObserver(() => {
        if (
          /Spiel starten|Start playing/.test(document.body?.textContent ?? "")
        )
          state.c52HomeFlashed = true;
      }).observe(document.documentElement, { childList: true, subtree: true });
    });
    await host.reload();
    await expect(lobbyHeading).toBeVisible();
    expect(
      await host.evaluate(
        () =>
          (window as typeof window & { c52HomeFlashed?: boolean })
            .c52HomeFlashed,
      ),
    ).toBe(false);
    await host.getByRole("button", { name: /Copy code|Code kopieren/ }).click();
    await expect(
      host
        .locator("#main")
        .getByRole("status")
        .filter({ hasText: /lobby code was copied|Lobby-Code wurde kopiert/i }),
    ).toBeVisible();
    const rulesButton = host
      .getByRole("contentinfo")
      .getByRole("button", { name: /Game rules|Spielregeln/ });
    await rulesButton.click();
    await expect(rulesButton).toHaveClass(/button-pressed/);
    const rulesDialog = host.getByRole("dialog");
    await expect(
      rulesDialog.getByText(/Goal of the game|Ziel des Spiels/),
    ).toBeVisible();
    await expect(
      rulesDialog.getByText(/Pick up the cards|Karten aufnehmen/),
    ).toBeVisible();
    await rulesDialog
      .getByRole("button", { name: /Dismiss|Schließen/ })
      .click();
    await host
      .getByRole("button", { name: /^Settings$|^Einstellungen$/ })
      .click();
    const settingsDialog = host.getByRole("dialog");
    await expect(
      settingsDialog.getByRole("button", {
        name: /Read current game state|Spielzustand vorlesen/,
      }),
    ).toHaveCount(0);
    await expect(
      settingsDialog.getByRole("button", {
        name: /Repeat last announcement|Letzte Ansage wiederholen/,
      }),
    ).toHaveCount(0);
    const customAccent = settingsDialog.getByLabel(
      /Custom accent color|Eigene Akzentfarbe/,
    );
    await expect(customAccent).toBeDisabled();
    const accentSelect = settingsDialog.getByRole("combobox", {
      name: /Accent color|Akzentfarbe/,
    });
    if (await accentSelect.count()) await accentSelect.selectOption("custom");
    else {
      await settingsDialog
        .getByRole("button", { name: /Accent color|Akzentfarbe/ })
        .click();
      await settingsDialog
        .getByRole("option", { name: /Custom color|Eigene Farbe/ })
        .click();
    }
    await expect(customAccent).toBeEnabled();
    const speechToggle = settingsDialog.getByRole("checkbox", {
      name: /Enable speech|Sprachausgabe aktivieren/,
    });
    await expect(speechToggle).not.toBeChecked();
    await expect(
      settingsDialog.getByRole("slider", {
        name: /Speech rate|Sprechgeschwindigkeit/,
      }),
    ).toBeDisabled();
    await speechToggle.check();
    await host.evaluate(() =>
      sessionStorage.removeItem("c52:speech-cancelled-test"),
    );
    await expect(
      settingsDialog.getByRole("slider", {
        name: /Speech rate|Sprechgeschwindigkeit/,
      }),
    ).toBeEnabled();
    await settingsDialog
      .getByRole("button", { name: /Dismiss|Schließen/ })
      .click();
    const protection = host.getByRole("checkbox", {
      name: /Protect lobby|Lobby mit Passwort/,
    });
    await expect(protection).toBeChecked();
    await protection.uncheck();
    await host
      .getByRole("button", { name: /Save settings|Einstellungen speichern/ })
      .click();
    await expect(protection).not.toBeChecked();
    const unnamedContext = await browser.newContext();
    const unnamed = await unnamedContext.newPage();
    await unnamed.goto(`/?lobby=${code}`);
    await expect(
      unnamed.getByText(
        /Please enter a display name|Bitte gib einen Benutzernamen/,
      ),
    ).toBeVisible();
    await unnamedContext.close();
    const savedContext = await browser.newContext();
    await savedContext.addInitScript(() =>
      localStorage.setItem("c52:name", "Clara"),
    );
    const saved = await savedContext.newPage();
    await saved.goto(`/?lobby=${code}`);
    await expect(
      saved.getByRole("heading", {
        level: 1,
        name: new RegExp(`^Lobby ${code}$`),
      }),
    ).toBeVisible();
    await expect(host.getByText("Clara", { exact: true })).toBeVisible();
    saved.once("dialog", (dialog) => dialog.accept());
    await saved
      .getByRole("button", { name: /Leave lobby|Lobby verlassen/ })
      .click();
    await expect(
      saved.getByRole("heading", { name: /still a member|noch Mitglied/ }),
    ).toBeVisible();
    await expect(
      saved.getByRole("button", { name: /Create lobby|Lobby erstellen/ }),
    ).toBeDisabled();
    await expect(host.getByText("Clara", { exact: true })).toBeVisible();
    await saved
      .getByRole("button", { name: /Return to lobby|Zur Lobby zurückkehren/ })
      .click();
    await expect(
      saved.getByRole("heading", {
        level: 1,
        name: new RegExp(`^Lobby ${code}$`),
      }),
    ).toBeVisible();
    saved.once("dialog", (dialog) => dialog.accept());
    await saved
      .getByRole("button", { name: /Leave lobby|Lobby verlassen/ })
      .click();
    saved.once("dialog", (dialog) => dialog.accept());
    await saved
      .getByRole("button", { name: /Leave permanently|Endgültig verlassen/ })
      .click();
    await expect(host.getByText("Clara", { exact: true })).toHaveCount(0);
    await expect(host.locator(".floating-notice")).toContainText(
      /Clara.*permanently left|Clara.*endgültig verlassen/,
    );
    await savedContext.close();
    await protection.check();
    await host.getByLabel(/Lobby password|Lobby-Passwort/).fill("secret-pass");
    await host
      .getByRole("button", { name: /Save settings|Einstellungen speichern/ })
      .click();
    await expect(
      host.getByText(
        /settings have been saved|Einstellungen wurden gespeichert/i,
      ),
    ).toBeVisible();
    await expect(host.getByLabel(/New password|Neues Passwort/)).toBeVisible();
    await host
      .getByRole("button", {
        name: /Show technical log|Technisches Protokoll anzeigen/,
      })
      .click();
    const history = host.locator(".history");
    await expect(history).toContainText(
      /Clara disconnected|Clara wurde getrennt/,
    );
    await expect(history).toContainText(
      /Clara reconnected|Clara ist wieder verbunden/,
    );
    await expect(history).not.toContainText(
      /permanently left|endgültig verlassen/,
    );
    await expect(
      host.getByText(/created the lobby|hat die Lobby erstellt/),
    ).toHaveCount(0);
    await expect(
      host.getByText(/changed the lobby settings|Lobby-Einstellungen geändert/),
    ).toHaveCount(0);
    await guest.goto("/");
    await guest.getByLabel(/Display name|Benutzername/).fill("Ben");
    const publicLobby = guest.getByRole("listitem").filter({ hasText: code });
    await expect(publicLobby.getByText(/Host: Anna/)).toBeVisible();
    const lobbyPassword = publicLobby.getByLabel(
      new RegExp(`Password for lobby ${code}|Passwort für Lobby ${code}`),
    );
    await expect(lobbyPassword).toBeVisible();
    await lobbyPassword.fill("wrong-password");
    await publicLobby.getByRole("button", { name: /Join|Beitreten/ }).click();
    const floatingError = guest.getByRole("alert");
    await expect(floatingError).toBeVisible();
    await expect(floatingError).toHaveCSS("position", "fixed");
    await guest
      .getByRole("button", { name: /Show all games|Alle Spiele anzeigen/ })
      .click();
    await expect(guest.getByRole("dialog")).toBeVisible();
    await expect
      .poll(() =>
        floatingError.evaluate((element) => {
          const bounds = element.getBoundingClientRect();
          const top = document.elementFromPoint(
            bounds.left + bounds.width / 2,
            bounds.top + bounds.height / 2,
          );
          return Boolean(top && element.contains(top));
        }),
      )
      .toBe(true);
    await floatingError
      .getByRole("button", { name: /Dismiss|Schließen/ })
      .click();
    await expect(floatingError).toHaveCount(0);
    await guest
      .getByRole("dialog")
      .getByRole("button", { name: /Dismiss|Schließen/ })
      .click();
    await lobbyPassword.fill("secret-pass");
    await publicLobby.getByRole("button", { name: /Join|Beitreten/ }).click();
    await expect(host.getByText("Ben", { exact: true })).toBeVisible();
    await expect(startGame).toBeEnabled();
    await startGame.click();
    await expect(
      host.getByRole("heading", {
        name: /Attack|Defense|Angriff|Verteidigung/,
      }),
    ).toBeVisible();
    await expect(
      guest.getByRole("heading", {
        name: /Attack|Defense|Angriff|Verteidigung/,
      }),
    ).toBeVisible();
    await expect(
      host.getByRole("button", {
        name: /Copy code|Code kopieren|Copy invitation link|Einladungslink kopieren/,
      }),
    ).toHaveCount(0);
    await expect(host.getByText(/^Running$|^Laufend$/)).toHaveCount(0);
    await expect(
      host.getByRole("button", {
        name: /Read current game state|Spielzustand vorlesen/,
      }),
    ).toHaveCount(0);
    await expect(
      host.getByRole("heading", { name: /Game log|Spielprotokoll/ }),
    ).toBeVisible();
    await expect(host.locator(".narration-log")).toContainText(
      /Your hand is|Deine Handkarten sind/,
    );
    await expect
      .poll(() =>
        host.evaluate(() => sessionStorage.getItem("c52:last-spoken-test")),
      )
      .toMatch(/Your hand is|Deine Handkarten sind/);
    const playerOverview = host.locator(".players");
    const hostPlayer = playerOverview
      .getByRole("listitem")
      .filter({ hasText: "Anna" });
    await expect(hostPlayer).toContainText(/6 cards|6 Handkarten/);
    await expect(hostPlayer).not.toContainText(/online|You|Du/);
    await expect(hostPlayer).toHaveAccessibleName(
      /Anna.*6 (cards|Handkarten).*(Host)/,
    );
    await expect(
      playerOverview.getByRole("listitem").filter({ hasText: "Ben" }),
    ).toContainText(/6 cards|6 Handkarten/);
    const attackerPage = (await host
      .getByRole("button", {
        name: /Attack\/throw in selected card|Ausgewählte Karte angreifen\/nachlegen/,
      })
      .count())
      ? host
      : guest;
    const defenderPage = attackerPage === host ? guest : host;
    await expect(
      defenderPage.locator(".hand-cards .playing-card:not(:disabled)"),
    ).toHaveCount(0);
    await expect(
      attackerPage.locator(".hand-cards .playing-card").first(),
    ).toBeEnabled();
    await attackerPage.locator(".hand-cards .playing-card").first().click();
    await attackerPage
      .getByRole("button", {
        name: /Attack\/throw in selected card|Ausgewählte Karte angreifen\/nachlegen/,
      })
      .click();
    await expect(
      attackerPage.locator(".hand-cards .playing-card:not(:disabled)"),
    ).toHaveCount(0);
    await expect(
      defenderPage.locator(".table-cards button.playing-card"),
    ).toBeEnabled();
    const narrationLog = host.locator(".narration-log");
    await expect(narrationLog).toContainText(/attacks with|greift mit/);
    await expect
      .poll(() =>
        host.evaluate(() => sessionStorage.getItem("c52:last-spoken-test")),
      )
      .toMatch(/attacks with|greift mit/);
    const spoken = await host.evaluate(
      () =>
        JSON.parse(
          sessionStorage.getItem("c52:spoken-test") ?? "[]",
        ) as string[],
    );
    expect(spoken.at(-2)).toMatch(/Your hand is|Deine Handkarten sind/);
    expect(spoken.at(-1)).toMatch(/attacks with|greift mit/);
    expect(
      await host.evaluate(() =>
        sessionStorage.getItem("c52:speech-cancelled-test"),
      ),
    ).toBeNull();
    await guest.close();
    await expect(history).toContainText(/Ben disconnected|Ben wurde getrennt/, {
      timeout: 10_000,
    });
    const reconnectedGuest = await guestContext.newPage();
    await reconnectedGuest.goto(`/?lobby=${code}`);
    await expect(
      reconnectedGuest.getByRole("heading", { level: 1, name: /Durak/ }),
    ).toBeVisible();
    await expect(history).toContainText(
      /Ben reconnected|Ben ist wieder verbunden/,
      { timeout: 10_000 },
    );
    await expect(narrationLog).not.toContainText(
      /Ben disconnected|Ben wurde getrennt|Ben reconnected|Ben ist wieder verbunden/,
    );
  } finally {
    try {
      const closeLobby = host.getByRole("button", {
        name: /Close lobby|Lobby schließen/,
      });
      if (!host.isClosed() && (await closeLobby.count())) {
        host.once("dialog", (dialog) => dialog.accept());
        await closeLobby.click({ timeout: 2_000 });
        await expect(closeLobby).toHaveCount(0);
      }
    } finally {
      await hostContext.close();
      await guestContext.close();
    }
  }
});

test("two browser contexts can play a complete Schwimmen turn", async ({
  browser,
}) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();
  try {
    await host.goto("/");
    await host.getByLabel(/Display name|Benutzername/).fill("Klara");
    await host
      .getByRole("button", { name: /Show all games|Alle Spiele anzeigen/ })
      .click();
    const knackCard = host
      .getByRole("dialog")
      .locator(".game-catalog-card")
      .filter({ hasText: "Schwimmen" });
    await expect(knackCard.locator(".game-alias-chip")).toHaveCount(0);
    await knackCard.getByRole("button", { name: /Select|Auswählen/ }).click();
    await host
      .getByRole("button", { name: /Create lobby|Lobby erstellen/ })
      .click();
    const heading = host.getByRole("heading", {
      level: 1,
      name: /^Lobby [A-Z2-9X]{8}$/,
    });
    await expect(heading).toBeVisible();
    const code = (await heading.textContent())!.split(" ").at(-1)!;
    await rememberTestLobby(host, code);
    await expect(host.getByText(/32 cards|32 Karten/).first()).toBeVisible();
    await guest.goto("/");
    await guest.getByLabel(/Display name|Benutzername/).fill("Berta");
    await guest.getByLabel(/Lobby code|Lobby-Code/).fill(code);
    await expect(
      guest.getByRole("button", { name: /Join lobby|Lobby beitreten/ }),
    ).toBeEnabled();
    await guest
      .getByRole("button", { name: /Join lobby|Lobby beitreten/ })
      .click();
    await expect(host.getByText("Berta", { exact: true })).toBeVisible();
    await host
      .getByRole("button", { name: /Start game|Partie starten/ })
      .click();
    await expect(
      host.getByRole("heading", { level: 1, name: "Schwimmen" }),
    ).toBeVisible();
    await expect(
      guest.getByRole("heading", { level: 1, name: "Schwimmen" }),
    ).toBeVisible();
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const next = host.getByRole("button", {
        name: /Next round|Nächste Runde/,
      });
      if (!(await next.count())) break;
      await next.click();
      await host.waitForTimeout(100);
    }
    const hostSwapAll = host.getByRole("button", {
      name: /Exchange all three|Alle drei tauschen/,
    });
    const active = (await hostSwapAll.isEnabled().catch(() => false))
      ? host
      : guest;
    const waiting = active === host ? guest : host;
    await expect(active.locator(".hand-cards .playing-card")).toHaveCount(3);
    await expect(
      active.locator(".knack-center-cards .playing-card"),
    ).toHaveCount(3);
    await expect(
      waiting.locator(".hand-cards .playing-card:disabled"),
    ).toHaveCount(3);
    await active.locator(".hand-cards .playing-card").first().click();
    await active.locator(".knack-center-cards .playing-card").first().click();
    await active
      .getByRole("button", {
        name: /Exchange selected cards|Gewählte Karten tauschen/,
      })
      .click();
    await expect(active.locator(".narration-log")).toContainText(
      /takes .+ from the center and puts .+ in its place|nimmt .+ aus der Mitte und legt .+ hinein/,
    );
    await host
      .getByRole("contentinfo")
      .getByRole("button", { name: /Game rules|Spielregeln/ })
      .click();
    const rules = host.getByRole("dialog");
    await expect(rules).toContainText(
      /exactly one hand card|genau eine Handkarte/,
    );
    await expect(rules).toContainText(/swimming|schwimmt/);
    await rules.getByRole("button", { name: /Dismiss|Schließen/ }).click();
  } finally {
    try {
      const closeLobby = host.getByRole("button", {
        name: /Close lobby|Lobby schließen/,
      });
      if (!host.isClosed() && (await closeLobby.count())) {
        host.once("dialog", (dialog) => dialog.accept());
        await closeLobby.click({ timeout: 2_000 });
      }
    } finally {
      await hostContext.close();
      await guestContext.close();
    }
  }
});

test("Mau-Mau house rules are configurable and the first turn is playable", async ({
  browser,
}) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();
  try {
    await host.goto("/");
    await host.getByLabel(/Display name|Benutzername/).fill("Marta");
    await host
      .getByRole("button", { name: /Show all games|Alle Spiele anzeigen/ })
      .click();
    const mauMauCard = host
      .getByRole("dialog")
      .locator(".game-catalog-card")
      .filter({ hasText: "Mau-Mau" });
    await expect(mauMauCard).toBeVisible();
    await mauMauCard.getByRole("button", { name: /Select|Auswählen/ }).click();
    await host
      .getByRole("button", { name: /Create lobby|Lobby erstellen/ })
      .click();
    let heading = host.getByRole("heading", {
      level: 1,
      name: /^Lobby [A-Z2-9X]{8}$/,
    });
    await expect(heading).toBeVisible();
    let code = (await heading.textContent())!.split(" ").at(-1)!;
    await rememberTestLobby(host, code);
    const stackSevens = host.getByRole("checkbox", {
      name: /Stack sevens|Siebenen stapeln/,
    });
    const reverseAces = host.getByRole("checkbox", {
      name: /Ace reverses|Ass ändert/,
    });
    await expect(
      host.getByRole("button", { name: /Everything saved|Alles gespeichert/ }),
    ).toBeDisabled();
    await stackSevens.check();
    await reverseAces.check();
    const saveSettings = host.getByRole("button", {
      name: /Save settings|Einstellungen speichern/,
    });
    await expect(saveSettings).toBeEnabled();
    await saveSettings.click();
    await expect(
      host.getByText(
        /settings have been saved|Einstellungen wurden gespeichert/i,
      ),
    ).toBeVisible();
    await expect(
      host.getByRole("button", { name: /Everything saved|Alles gespeichert/ }),
    ).toBeDisabled();
    await expect
      .poll(() =>
        host.evaluate(
          () =>
            JSON.parse(localStorage.getItem("c52:mau-mau-rules") ?? "{}")
              .stackSevens,
        ),
      )
      .toBe(true);
    const firstClose = host.getByRole("button", {
      name: /Close lobby|Lobby schließen/,
    });
    host.once("dialog", (dialog) => dialog.accept());
    await firstClose.click();
    await expect(
      host.getByRole("button", { name: /Create lobby|Lobby erstellen/ }),
    ).toBeVisible();
    await host
      .getByRole("button", { name: /Create lobby|Lobby erstellen/ })
      .click();
    heading = host.getByRole("heading", {
      level: 1,
      name: /^Lobby [A-Z2-9X]{8}$/,
    });
    await expect(heading).toBeVisible();
    code = (await heading.textContent())!.split(" ").at(-1)!;
    await rememberTestLobby(host, code);
    await expect(
      host.getByRole("checkbox", { name: /Stack sevens|Siebenen stapeln/ }),
    ).toBeChecked();
    await expect(
      host.getByRole("checkbox", { name: /Ace reverses|Ass ändert/ }),
    ).toBeChecked();
    await host
      .getByRole("contentinfo")
      .getByRole("button", { name: /Game rules|Spielregeln/ })
      .click();
    const rules = host.getByRole("dialog");
    await expect(rules).not.toContainText(
      /House rules for this game|Hausregeln dieser Partie/,
    );
    await expect(rules).toContainText(/After a seven|Nach einer Sieben/);
    await rules.getByRole("button", { name: /Dismiss|Schließen/ }).click();
    await guest.goto("/");
    await guest.getByLabel(/Display name|Benutzername/).fill("Gerta");
    await guest.getByLabel(/Lobby code|Lobby-Code/).fill(code);
    await expect(
      guest.getByRole("button", { name: /Join lobby|Lobby beitreten/ }),
    ).toBeEnabled();
    await guest
      .getByRole("button", { name: /Join lobby|Lobby beitreten/ })
      .click();
    await host
      .getByRole("button", { name: /Start game|Partie starten/ })
      .click();
    await expect(
      host.getByRole("heading", { level: 1, name: "Mau-Mau" }),
    ).toBeVisible();
    const hostPlayable = host.locator(
      ".hand-cards .playing-card:not(:disabled)",
    );
    const hostDraw = host.getByRole("button", {
      name: /Draw one card|Eine Karte ziehen/,
    });
    const guestPlayable = guest.locator(
      ".hand-cards .playing-card:not(:disabled)",
    );
    const guestDraw = guest.getByRole("button", {
      name: /Draw one card|Eine Karte ziehen/,
    });
    await expect
      .poll(
        async () =>
          (await hostPlayable.count()) > 0 ||
          (await hostDraw.isEnabled().catch(() => false)) ||
          (await guestPlayable.count()) > 0 ||
          (await guestDraw.isEnabled().catch(() => false)),
      )
      .toBe(true);
    const active =
      (await hostPlayable.count()) > 0 ||
      (await hostDraw.isEnabled().catch(() => false))
        ? host
        : guest;
    const mauMauBoard = active.locator(".mau-mau-board");
    await expect(mauMauBoard).toBeVisible();
    expect(
      await mauMauBoard.evaluate((board) => {
        const bounds = board.getBoundingClientRect();
        return [...board.children].every((child) => {
          const childBounds = child.getBoundingClientRect();
          return (
            childBounds.left >= bounds.left - 1 &&
            childBounds.right <= bounds.right + 1
          );
        });
      }),
    ).toBe(true);
    expect(
      await active
        .locator(".hand-cards")
        .evaluate(
          (hand) =>
            hand.scrollWidth <= hand.clientWidth + 1 &&
            hand.scrollHeight <= hand.clientHeight + 1,
        ),
    ).toBe(true);
    expect(
      await active.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    ).toBe(true);
    const gamePanelPadding = await active
      .locator(".hand.panel")
      .evaluate((panel) => getComputedStyle(panel).padding);
    for (const selector of [
      ".narration-log.panel",
      ".utility.panel",
      ".danger-zone.panel",
    ])
      expect(
        await active
          .locator(selector)
          .evaluate((panel) => getComputedStyle(panel).padding),
      ).toBe(gamePanelPadding);
    const playable = active.locator(".hand-cards .playing-card:not(:disabled)");
    if (await playable.count()) {
      await playable.first().click();
      const suitChoice = active.locator(".mau-mau-suit-choice");
      if (await suitChoice.count())
        await suitChoice.getByRole("button").first().click();
      await active
        .getByRole("button", { name: /Play card|Karte ablegen/ })
        .click();
      await expect(active.locator(".narration-log")).toContainText(
        /plays|legt/,
      );
    } else {
      await active
        .getByRole("button", { name: /Draw one card|Eine Karte ziehen/ })
        .click();
      const privateDrawEntry = active
        .locator(".narration-log li")
        .filter({ hasText: /You draw|Du ziehst/ });
      await expect(privateDrawEntry).toBeVisible();
      await expect(
        privateDrawEntry.locator(".protocol-private-badge"),
      ).toBeVisible();
    }
  } finally {
    try {
      const closeLobby = host.getByRole("button", {
        name: /Close lobby|Lobby schließen/,
      });
      if (!host.isClosed() && (await closeLobby.count())) {
        host.once("dialog", (dialog) => dialog.accept());
        await closeLobby.click({ timeout: 2_000 });
      }
    } finally {
      await hostContext.close();
      await guestContext.close();
    }
  }
});

test("Rommé can be configured, started, and drawn from", async ({
  browser,
}) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();
  try {
    await host.goto("/");
    await host.getByLabel(/Display name|Benutzername/).fill("Romy");
    await host
      .getByRole("button", { name: /Show all games|Alle Spiele anzeigen/ })
      .click();
    const rommeCard = host
      .getByRole("dialog")
      .locator(".game-catalog-card")
      .filter({ hasText: /Rommé|German Rummy/ });
    await expect(rommeCard).toBeVisible();
    await expect(rommeCard).toContainText(/Gin-Rommé|Gin Rummy/);
    await rommeCard.getByRole("button", { name: /Select|Auswählen/ }).click();
    await host
      .getByRole("button", { name: /Create lobby|Lobby erstellen/ })
      .click();
    const heading = host.getByRole("heading", {
      level: 1,
      name: /^Lobby [A-Z2-9X]{8}$/,
    });
    await expect(heading).toBeVisible();
    const code = (await heading.textContent())!.split(" ").at(-1)!;
    await rememberTestLobby(host, code);
    await expect(host.getByText(/110 cards|110 Karten/).first()).toBeVisible();
    const opening = host.getByRole("button", {
      name: /Initial meld minimum|Mindestwert der Erstmeldung/,
    });
    if (await opening.count()) {
      await opening.click();
      await host.getByRole("option", { name: /30 points|30 Punkte/ }).click();
    } else
      await host
        .getByRole("combobox", {
          name: /Initial meld minimum|Mindestwert der Erstmeldung/,
        })
        .selectOption("30");
    await host
      .getByRole("checkbox", {
        name: /Use a picked-up discard|Aufgenommene Ablagekarte/,
      })
      .check();
    await host
      .getByRole("button", { name: /Save settings|Einstellungen speichern/ })
      .click();
    await guest.goto("/");
    await guest.getByLabel(/Display name|Benutzername/).fill("Berni");
    await guest.getByLabel(/Lobby code|Lobby-Code/).fill(code);
    await expect(
      guest.getByRole("button", { name: /Join lobby|Lobby beitreten/ }),
    ).toBeEnabled();
    await guest
      .getByRole("button", { name: /Join lobby|Lobby beitreten/ })
      .click();
    await host
      .getByRole("button", { name: /Start game|Partie starten/ })
      .click();
    await expect(
      host.getByRole("heading", { level: 1, name: /Rommé|German Rummy/ }),
    ).toBeVisible();
    await expect(host.locator(".hand-cards .playing-card")).toHaveCount(13);
    await expect(guest.locator(".hand-cards .playing-card")).toHaveCount(13);
    await expect(host.locator(".narration-log")).not.toContainText(
      /no cards|keine Karten/,
    );
    await expect(guest.locator(".narration-log")).not.toContainText(
      /no cards|keine Karten/,
    );
    const hostDraw = host.getByRole("button", {
      name: /Draw from stock|Verdeckt ziehen/,
    });
    const active = (await hostDraw.isEnabled().catch(() => false))
      ? host
      : guest;
    const sortControls = active.locator(".hand-sort-controls");
    const nativeSort = sortControls.getByRole("combobox", {
      name: /Sort hand|Handkarten sortieren/,
    });
    if (await nativeSort.count()) {
      await expect(nativeSort).toHaveValue("suit");
      await nativeSort.selectOption("none");
    } else {
      const sortTrigger = sortControls.getByRole("button", {
        name: /Sort hand|Handkarten sortieren/,
      });
      await expect(sortTrigger).toContainText(/By suit|Nach Farbe/);
      await sortTrigger.click();
      await active
        .getByRole("option", { name: /No sorting|Keine Sortierung/ })
        .click();
    }
    await expect(
      sortControls.getByRole("button", { name: /Ascending|Aufsteigend/ }),
    ).toBeDisabled();
    await expect
      .poll(() =>
        active.evaluate(
          () => JSON.parse(localStorage.getItem("c52:hand-sort") ?? "{}").mode,
        ),
      )
      .toBe("none");
    const unsortedOrder = await active
      .locator(".hand-cards .playing-card")
      .evaluateAll((cards) =>
        cards.map((card) => card.getAttribute("data-card-id")),
      );
    const drawPanel = active.locator(".romme-discard");
    await expect(drawPanel).toBeVisible();
    expect(
      await drawPanel.evaluate((panel) => {
        const bounds = panel.getBoundingClientRect();
        return [...panel.querySelectorAll("button")].every((button) => {
          const buttonBounds = button.getBoundingClientRect();
          return (
            buttonBounds.left >= bounds.left &&
            buttonBounds.right <= bounds.right &&
            buttonBounds.top >= bounds.top &&
            buttonBounds.bottom <= bounds.bottom
          );
        });
      }),
    ).toBe(true);
    await active
      .getByRole("button", { name: /Draw from stock|Verdeckt ziehen/ })
      .click();
    await expect(active.locator(".hand-cards .playing-card")).toHaveCount(14);
    const privateDrawEntry = active
      .locator(".narration-log li")
      .filter({ hasText: /You draw|Du ziehst/ });
    await expect(privateDrawEntry).toBeVisible();
    await expect(
      privateDrawEntry.locator(".protocol-private-badge"),
    ).toBeVisible();
    const orderAfterDraw = await active
      .locator(".hand-cards .playing-card")
      .evaluateAll((cards) =>
        cards.map((card) => card.getAttribute("data-card-id")),
      );
    expect(orderAfterDraw.slice(0, -1)).toEqual(unsortedOrder);
    expect(unsortedOrder).not.toContain(orderAfterDraw.at(-1));
    expect(
      await active
        .locator(".hand-cards")
        .evaluate(
          (hand) =>
            hand.scrollWidth <= hand.clientWidth + 1 &&
            hand.scrollHeight <= hand.clientHeight + 1 &&
            (window.innerWidth > 760 ||
              hand.getBoundingClientRect().height < 350),
        ),
    ).toBe(true);
    expect(
      await active
        .locator(".hand-cards .playing-card")
        .first()
        .evaluate(
          (card) =>
            card.getBoundingClientRect().width <=
            (window.innerWidth <= 760 ? 72 : 76),
        ),
    ).toBe(true);
    await active.evaluate(() => {
      document.documentElement.classList.add("large-text");
      document.querySelector(".app")?.classList.add("large-cards");
    });
    for (const width of [320, 360, 412, 760]) {
      await active.setViewportSize({ width, height: 800 });
      const overflow = await active.evaluate(() => ({
        page: document.documentElement.scrollWidth - window.innerWidth,
        elements: [...document.body.querySelectorAll<HTMLElement>("*")]
          .filter((element) => {
            const rect = element.getBoundingClientRect();
            return (
              rect.width > 2 &&
              (rect.left < -1 || rect.right > window.innerWidth + 1)
            );
          })
          .map(
            (element) =>
              `${element.tagName.toLowerCase()}.${element.className}`,
          )
          .slice(0, 8),
      }));
      expect(overflow, `horizontal overflow at ${width}px`).toEqual({
        page: 0,
        elements: [],
      });
    }
    expect(
      await active.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    ).toBe(true);
    await host
      .getByRole("contentinfo")
      .getByRole("button", { name: /Game rules|Spielregeln/ })
      .click();
    const rules = host.getByRole("dialog");
    await expect(rules).toContainText(/40 points|40 Punkte/);
    await expect(rules).toContainText(/Exchanging a joker|Joker austauschen/);
    await rules.getByRole("tab", { name: /Gin Rummy|Gin-Rommé/ }).click();
    await expect(rules).toContainText(/deadwood|Totholz/);
    await expect(rules).toContainText(/undercut|unterbietet/);
    await rules.getByRole("button", { name: /Dismiss|Schließen/ }).click();
  } finally {
    try {
      const closeLobby = host.getByRole("button", {
        name: /Close lobby|Lobby schließen/,
      });
      if (!host.isClosed() && (await closeLobby.count())) {
        host.once("dialog", (dialog) => dialog.accept());
        await closeLobby.click({ timeout: 2_000 });
      }
    } finally {
      await hostContext.close();
      await guestContext.close();
    }
  }
});
