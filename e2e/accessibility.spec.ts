import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('home is keyboard-ready and has no detectable WCAG A/AA violations', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-accent', 'system');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.locator('.skip-link')).toBeFocused();
  const name = page.getByLabel(/Display name|Benutzername/); const createLobby = page.getByRole('button', { name: /Create lobby|Lobby erstellen/ }); await expect(name).toHaveAttribute('maxlength', '16'); await expect(page.getByText(/1 to 32 characters|1 bis 32 Zeichen/)).toHaveCount(0); await expect(createLobby).toBeDisabled(); await expect(page.getByRole('button', { name: /Join lobby|Lobby beitreten/ })).toBeDisabled(); await name.focus(); await name.blur(); await expect(page.getByText(/Please enter a display name|Bitte gib einen Benutzernamen/)).toBeVisible();
  await name.fill('A1'); await expect(name).toHaveAttribute('aria-invalid', 'true'); await expect(page.getByText(/at least three letters|mindestens drei Buchstaben/)).toBeVisible(); await expect(createLobby).toBeDisabled(); await name.fill('Anna!'); await expect(page.getByText(/16 letters, numbers|16 Buchstaben, Zahlen/)).toBeVisible(); await expect(createLobby).toBeDisabled(); await name.fill('Ann_1-'); await expect(name).toHaveAttribute('aria-invalid', 'false'); await expect(createLobby).toBeEnabled(); await name.fill('Anna'); const code = page.getByLabel(/Lobby code|Lobby-Code/); await code.focus(); await code.blur(); await expect(code).toHaveAttribute('aria-invalid', 'false'); await code.fill('AAAAAAAA'); await expect(page.getByText(/No lobby was found for this code|Unter diesem Code wurde keine Lobby gefunden/)).toBeVisible(); await expect(code).toHaveAttribute('aria-invalid', 'true'); await expect(page.getByRole('button', { name: /Join lobby|Lobby beitreten/ })).toBeDisabled();
  await expect(page.getByRole('tooltip')).toHaveCount(0); await page.getByRole('button', { name: /Show all games|Alle Spiele anzeigen/ }).click(); const gamesDialog = page.getByRole('dialog'); const searchGames = gamesDialog.getByRole('searchbox', { name: /Search games|Spiele suchen/ }); await expect(searchGames).toHaveAttribute('placeholder', /Enter a name|Name eingeben/); await expect(gamesDialog.locator('.game-catalog-mark')).toHaveCount(0); await expect(gamesDialog.locator('.game-alias-chip').filter({ hasText: 'Dummkopf' })).toHaveCount(1); await searchGames.fill('Schnauz'); await expect(gamesDialog.locator('.game-catalog-card')).toContainText(/Knack/); await searchGames.fill('Dummkopf'); await expect(gamesDialog.locator('.game-catalog-card')).toContainText(/Durak/); await searchGames.fill('Skat'); await expect(gamesDialog.getByText(/No game found|Kein Spiel gefunden/)).toBeVisible(); await expect(gamesDialog.getByText(/Try a different name\.|Versuche einen anderen Namen\./)).toBeVisible(); await gamesDialog.getByRole('button', { name: /Dismiss|Schließen/ }).click();
  await page.goto('/?lobby=AAAAAAAA'); await expect(page).toHaveURL(/\/$/); await expect(page.getByLabel(/Lobby code|Lobby-Code/)).toHaveValue('');
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(results.violations).toEqual([]);
  if (testInfo.project.name === 'mobile-chromium') {
    await expect(page.getByRole('combobox', { name: /Color theme|Farbschema/ })).toBeVisible();
  } else {
    const theme = page.getByRole('button', { name: /Color theme|Farbschema/ }); const themeList = page.getByRole('listbox', { name: /Color theme|Farbschema/ }); await expect(theme).toBeVisible(); await theme.press('Enter'); await expect(themeList).toBeVisible(); await theme.press('ArrowDown'); await theme.press('Enter'); await expect(theme).toContainText(/Light|Hell/); await expect(themeList).toBeHidden(); await theme.click(); await themeList.getByRole('option', { name: /Dark|Dunkel/ }).click(); await expect(theme).toContainText(/Dark|Dunkel/); await expect(theme).toHaveAttribute('aria-expanded', 'false'); await expect(themeList).toBeHidden();
  }
  await page.getByRole('button', { name: /^Settings$|^Einstellungen$/ }).click(); const settings = page.getByRole('dialog'); const accentLabel = /Accent color|Akzentfarbe/;
  if (testInfo.project.name === 'mobile-chromium') { const accent = settings.getByRole('combobox', { name: accentLabel }); await expect(accent.locator('option')).toHaveCount(6); await accent.selectOption('amber'); }
  else { const accent = settings.getByRole('button', { name: accentLabel }); await accent.click(); await expect(settings.getByRole('option')).toHaveCount(6); await settings.getByRole('option', { name: /Amber|Bernstein/ }).click(); }
  await expect(page.locator('html')).toHaveAttribute('data-accent', 'amber'); expect(await page.evaluate(() => JSON.parse(localStorage.getItem('c52:prefs') ?? '{}').accent)).toBe('amber'); await settings.getByRole('button', { name: /Dismiss|Schließen/ }).click();
});

test('site notice and privacy policy are available in both languages', async ({ page }) => {
  await page.goto('/'); await page.evaluate(() => localStorage.setItem('c52:language', 'de'));
  await page.goto('/impressum');
  await expect(page.getByRole('heading', { level: 1, name: 'Impressum' })).toBeVisible();
  await expect(page.getByText('Kaiser-Otto-Ring 6')).toBeVisible();
  await expect(page.getByRole('link', { name: 'collection52@steinente.de' })).toHaveAttribute('href', 'mailto:collection52@steinente.de');
  await expect(page.getByRole('contentinfo').getByRole('link', { name: 'Datenschutz' })).toHaveAttribute('href', '/datenschutz');

  await page.goto('/datenschutz');
  await expect(page.getByRole('heading', { level: 1, name: 'Datenschutzerklärung' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '1. Datenschutz auf einen Blick' })).toBeVisible();
  await expect(page.getByText('Kommunikation via WhatsApp', { exact: true })).toBeVisible();
  await expect(page.getByText(/zuständigen Aufsichtsbehörde/).first()).toBeVisible();
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(results.violations).toEqual([]);

  await page.evaluate(() => localStorage.setItem('c52:language', 'en'));
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Privacy Policy' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '1. An overview of data protection' })).toBeVisible();
  await page.goto('/impressum');
  await expect(page.getByRole('heading', { level: 1, name: 'Site Notice' })).toBeVisible();
});

test('two browser contexts can create, join, and start Durak', async ({ browser }) => {
  const hostContext = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] }); const guestContext = await browser.newContext();
  await hostContext.addInitScript(() => { window.speechSynthesis.cancel = () => sessionStorage.setItem('c52:speech-cancelled-test', 'true'); window.speechSynthesis.speak = (utterance) => { const spoken = JSON.parse(sessionStorage.getItem('c52:spoken-test') ?? '[]') as string[]; spoken.push(utterance.text); sessionStorage.setItem('c52:spoken-test', JSON.stringify(spoken)); sessionStorage.setItem('c52:last-spoken-test', utterance.text); }; });
  const host = await hostContext.newPage(); const guest = await guestContext.newPage();
  try {
  await host.goto('/');
  const create = host.getByRole('form').filter({ has: host.getByRole('heading', { name: /Start playing|Spiel starten/ }) });
  await create.getByLabel(/Display name|Benutzername/).fill('Anna'); await create.getByRole('checkbox', { name: /Protect lobby|Lobby mit Passwort/ }).check(); await expect(create.getByRole('button', { name: /Create lobby|Lobby erstellen/ })).toBeDisabled(); await create.getByLabel(/Lobby password|Lobby-Passwort/).fill('secret-pass'); await create.getByRole('button', { name: /Create lobby|Lobby erstellen/ }).click();
  const lobbyHeading = host.getByRole('heading', { level: 1, name: /^Lobby [A-Z2-9X]{8}$/ }); await expect(lobbyHeading).toBeVisible();
  const startGame = host.getByRole('button', { name: /Start game|Partie starten/ }); await expect(startGame).toBeDisabled();
  const code = (await lobbyHeading.textContent())!.split(' ').at(-1)!;
  await host.getByRole('button', { name: /Copy code|Code kopieren/ }).click(); await expect(host.locator('#main').getByRole('status').filter({ hasText: /lobby code was copied|Lobby-Code wurde kopiert/i })).toBeVisible();
  const rulesButton = host.getByRole('contentinfo').getByRole('button', { name: /Game rules|Spielregeln/ }); await rulesButton.click(); await expect(rulesButton).toHaveClass(/button-pressed/); const rulesDialog = host.getByRole('dialog'); await expect(rulesDialog.getByText(/Goal of the game|Ziel des Spiels/)).toBeVisible(); await expect(rulesDialog.getByText(/Pick up the cards|Karten aufnehmen/)).toBeVisible(); await rulesDialog.getByRole('button', { name: /Dismiss|Schließen/ }).click();
  await host.getByRole('button', { name: /^Settings$|^Einstellungen$/ }).click(); const settingsDialog = host.getByRole('dialog'); await expect(settingsDialog.getByRole('button', { name: /Read current game state|Spielzustand vorlesen/ })).toHaveCount(0); await expect(settingsDialog.getByRole('button', { name: /Repeat last announcement|Letzte Ansage wiederholen/ })).toHaveCount(0); const speechToggle = settingsDialog.getByRole('checkbox', { name: /Enable speech|Sprachausgabe aktivieren/ }); await expect(speechToggle).not.toBeChecked(); await expect(settingsDialog.getByRole('slider', { name: /Speech rate|Sprechgeschwindigkeit/ })).toBeDisabled(); await speechToggle.check(); await host.evaluate(() => sessionStorage.removeItem('c52:speech-cancelled-test')); await expect(settingsDialog.getByRole('slider', { name: /Speech rate|Sprechgeschwindigkeit/ })).toBeEnabled(); await settingsDialog.getByRole('button', { name: /Dismiss|Schließen/ }).click();
  const protection = host.getByRole('checkbox', { name: /Protect lobby|Lobby mit Passwort/ }); await expect(protection).toBeChecked(); await protection.uncheck(); await host.getByRole('button', { name: /Save settings|Einstellungen speichern/ }).click(); await expect(protection).not.toBeChecked();
  const unnamedContext = await browser.newContext(); const unnamed = await unnamedContext.newPage(); await unnamed.goto(`/?lobby=${code}`); await expect(unnamed.getByText(/Please enter a display name|Bitte gib einen Benutzernamen/)).toBeVisible(); await unnamedContext.close();
  const savedContext = await browser.newContext(); await savedContext.addInitScript(() => localStorage.setItem('c52:name', 'Clara')); const saved = await savedContext.newPage(); await saved.goto(`/?lobby=${code}`); await expect(saved.getByRole('heading', { level: 1, name: new RegExp(`^Lobby ${code}$`) })).toBeVisible(); await expect(host.getByText('Clara', { exact: true })).toBeVisible(); await saved.getByRole('button', { name: /Leave lobby|Lobby verlassen/ }).click(); await expect(host.getByText('Clara', { exact: true })).toHaveCount(0); await savedContext.close();
  await protection.check(); await host.getByLabel(/Lobby password|Lobby-Passwort/).fill('secret-pass'); await host.getByRole('button', { name: /Save settings|Einstellungen speichern/ }).click(); await expect(host.getByText(/settings have been saved|Einstellungen wurden gespeichert/i)).toBeVisible(); await expect(host.getByLabel(/New password|Neues Passwort/)).toBeVisible();
  await host.getByRole('button', { name: /Show technical log|Technisches Protokoll anzeigen/ }).click(); const history = host.locator('.history'); await expect(host.getByText(/No technical events yet|Noch keine technischen Ereignisse/)).toBeVisible(); await expect(host.getByText(/created the lobby|hat die Lobby erstellt/)).toHaveCount(0); await expect(host.getByText(/changed the lobby settings|Lobby-Einstellungen geändert/)).toHaveCount(0);
  await guest.goto('/'); await guest.getByLabel(/Display name|Benutzername/).fill('Ben'); const publicLobby = guest.getByRole('listitem').filter({ hasText: code }); await expect(publicLobby.getByText(/Host: Anna/)).toBeVisible(); const lobbyPassword = publicLobby.getByLabel(new RegExp(`Password for lobby ${code}|Passwort für Lobby ${code}`)); await expect(lobbyPassword).toBeVisible(); await lobbyPassword.fill('wrong-password'); await publicLobby.getByRole('button', { name: /Join|Beitreten/ }).click(); const floatingError = guest.getByRole('alert'); await expect(floatingError).toBeVisible(); await expect(floatingError).toHaveCSS('position', 'fixed'); await floatingError.getByRole('button', { name: /Dismiss|Schließen/ }).click(); await expect(floatingError).toHaveCount(0); await lobbyPassword.fill('secret-pass'); await publicLobby.getByRole('button', { name: /Join|Beitreten/ }).click();
  await expect(host.getByText('Ben', { exact: true })).toBeVisible(); await expect(startGame).toBeEnabled(); await startGame.click();
  await expect(host.getByRole('heading', { name: /Attack|Defense|Angriff|Verteidigung/ })).toBeVisible(); await expect(guest.getByRole('heading', { name: /Attack|Defense|Angriff|Verteidigung/ })).toBeVisible(); await expect(host.getByRole('button', { name: /Copy code|Code kopieren|Copy invitation link|Einladungslink kopieren/ })).toHaveCount(0); await expect(host.getByText(/^Running$|^Laufend$/)).toHaveCount(0); await expect(host.getByRole('button', { name: /Read current game state|Spielzustand vorlesen/ })).toHaveCount(0); await expect(host.getByRole('heading', { name: /Game log|Spielprotokoll/ })).toBeVisible(); await expect(host.locator('.narration-log')).toContainText(/Your hand is|Deine Handkarten sind/); await expect.poll(() => host.evaluate(() => sessionStorage.getItem('c52:last-spoken-test'))).toMatch(/Your hand is|Deine Handkarten sind/);
  const playerOverview = host.locator('.players'); const hostPlayer = playerOverview.getByRole('listitem').filter({ hasText: 'Anna' }); await expect(hostPlayer).toContainText(/6 cards|6 Handkarten/); await expect(hostPlayer).not.toContainText(/online|You|Du/); await expect(hostPlayer).toHaveAccessibleName(/Anna.*6 (cards|Handkarten).*(Host)/); await expect(playerOverview.getByRole('listitem').filter({ hasText: 'Ben' })).toContainText(/6 cards|6 Handkarten/);
  const attackerPage = await host.getByRole('button', { name: /Attack\/throw in selected card|Ausgewählte Karte angreifen\/nachlegen/ }).count() ? host : guest; const defenderPage = attackerPage === host ? guest : host; await expect(defenderPage.locator('.hand-cards .playing-card:not(:disabled)')).toHaveCount(0); await expect(attackerPage.locator('.hand-cards .playing-card').first()).toBeEnabled(); await attackerPage.locator('.hand-cards .playing-card').first().click(); await attackerPage.getByRole('button', { name: /Attack\/throw in selected card|Ausgewählte Karte angreifen\/nachlegen/ }).click(); await expect(attackerPage.locator('.hand-cards .playing-card:not(:disabled)')).toHaveCount(0); await expect(defenderPage.locator('.table-cards button.playing-card')).toBeEnabled(); const narrationLog = host.locator('.narration-log'); await expect(narrationLog).toContainText(/attacks with|greift mit/); await expect.poll(() => host.evaluate(() => sessionStorage.getItem('c52:last-spoken-test'))).toMatch(/attacks with|greift mit/); const spoken = await host.evaluate(() => JSON.parse(sessionStorage.getItem('c52:spoken-test') ?? '[]') as string[]); expect(spoken.at(-2)).toMatch(/Your hand is|Deine Handkarten sind/); expect(spoken.at(-1)).toMatch(/attacks with|greift mit/); expect(await host.evaluate(() => sessionStorage.getItem('c52:speech-cancelled-test'))).toBeNull();
  await guest.close(); await expect(history).toContainText(/Ben disconnected|Ben wurde getrennt/, { timeout: 10_000 }); const reconnectedGuest = await guestContext.newPage(); await reconnectedGuest.goto(`/?lobby=${code}`); await expect(reconnectedGuest.getByRole('heading', { level: 1, name: /Durak/ })).toBeVisible(); await expect(history).toContainText(/Ben reconnected|Ben ist wieder verbunden/, { timeout: 10_000 }); await expect(narrationLog).not.toContainText(/Ben disconnected|Ben wurde getrennt|Ben reconnected|Ben ist wieder verbunden/);
  } finally {
    try {
      const closeLobby = host.getByRole('button', { name: /Close lobby|Lobby schließen/ });
      if (!host.isClosed() && await closeLobby.count()) { host.once('dialog', (dialog) => dialog.accept()); await closeLobby.click({ timeout: 2_000 }); await expect(closeLobby).toHaveCount(0); }
    } finally {
      await hostContext.close(); await guestContext.close();
    }
  }
});

test('two browser contexts can play a complete Knack turn', async ({ browser }) => {
  const hostContext = await browser.newContext(); const guestContext = await browser.newContext();
  const host = await hostContext.newPage(); const guest = await guestContext.newPage();
  try {
    await host.goto('/'); await host.getByLabel(/Display name|Benutzername/).fill('Klara');
    await host.getByRole('button', { name: /Show all games|Alle Spiele anzeigen/ }).click();
    const knackCard = host.getByRole('dialog').locator('.game-catalog-card').filter({ hasText: 'Knack' });
    await expect(knackCard).toContainText(/Schwimmen/); await knackCard.getByRole('button', { name: /Select|Auswählen/ }).click();
    await host.getByRole('button', { name: /Create lobby|Lobby erstellen/ }).click();
    const heading = host.getByRole('heading', { level: 1, name: /^Lobby [A-Z2-9X]{8}$/ }); await expect(heading).toBeVisible();
    const code = (await heading.textContent())!.split(' ').at(-1)!; await expect(host.getByText(/32 cards|32 Karten/).first()).toBeVisible();
    await guest.goto('/'); await guest.getByLabel(/Display name|Benutzername/).fill('Berta'); await guest.getByLabel(/Lobby code|Lobby-Code/).fill(code);
    await expect(guest.getByRole('button', { name: /Join lobby|Lobby beitreten/ })).toBeEnabled(); await guest.getByRole('button', { name: /Join lobby|Lobby beitreten/ }).click();
    await expect(host.getByText('Berta', { exact: true })).toBeVisible(); await host.getByRole('button', { name: /Start game|Partie starten/ }).click();
    await expect(host.getByRole('heading', { level: 1, name: 'Knack' })).toBeVisible(); await expect(guest.getByRole('heading', { level: 1, name: 'Knack' })).toBeVisible();
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const next = host.getByRole('button', { name: /Next round|Nächste Runde/ });
      if (!await next.count()) break;
      await next.click(); await host.waitForTimeout(100);
    }
    const hostSwapAll = host.getByRole('button', { name: /Exchange all three|Alle drei tauschen/ });
    const active = await hostSwapAll.isEnabled().catch(() => false) ? host : guest; const waiting = active === host ? guest : host;
    await expect(active.locator('.hand-cards .playing-card')).toHaveCount(3); await expect(active.locator('.knack-center-cards .playing-card')).toHaveCount(3); await expect(waiting.locator('.hand-cards .playing-card:disabled')).toHaveCount(3);
    await active.locator('.hand-cards .playing-card').first().click(); await active.locator('.knack-center-cards .playing-card').first().click();
    await active.getByRole('button', { name: /Exchange selected cards|Gewählte Karten tauschen/ }).click();
    await expect(active.locator('.narration-log')).toContainText(/exchanges one hand card|tauscht eine Handkarte/);
    await host.getByRole('contentinfo').getByRole('button', { name: /Game rules|Spielregeln/ }).click();
    const rules = host.getByRole('dialog'); await expect(rules).toContainText(/exactly one hand card|genau eine Handkarte/); await expect(rules).toContainText(/swimming|schwimmt/); await rules.getByRole('button', { name: /Dismiss|Schließen/ }).click();
  } finally {
    try {
      const closeLobby = host.getByRole('button', { name: /Close lobby|Lobby schließen/ });
      if (!host.isClosed() && await closeLobby.count()) { host.once('dialog', (dialog) => dialog.accept()); await closeLobby.click({ timeout: 2_000 }); }
    } finally { await hostContext.close(); await guestContext.close(); }
  }
});
