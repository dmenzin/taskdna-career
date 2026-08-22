import { expect, test } from "@playwright/test";

const personas = [
  "failure-analyst",
  "greenfield-software",
  "quality-dislikes-compliance",
  "robotics-no-cpp",
  "low-information",
];

for (const persona of personas) {
  test(`complete product flow for ${persona}`, async ({ page }) => {
    await page.goto("/");
    await page.getByTestId(`persona-${persona}`).click();

    await expect(page.getByTestId("profile")).toContainText("Task DNA profile");
    await expect(page.getByTestId("profile")).toContainText("Capabilities are separate");

    const scenarioButtons = page.locator('[data-testid^="scenario-love-"]');
    if (await scenarioButtons.count()) {
      await scenarioButtons.first().click();
      await expect(page.getByTestId("adaptive-interview")).toContainText(/next scenarios|Early stopped/i);
    }

    await page.getByTestId("job-explorer").scrollIntoViewIfNeeded();
    await page.getByLabel("Sort jobs").selectOption("fit");
    await page.getByTestId("freshness-filter").selectOption("VERIFIED_LIVE");
    await expect(page.getByTestId("job-card").first()).toBeVisible();

    await page.getByTestId("job-card").first().click();
    await expect(page.getByTestId("job-detail")).toContainText("What this job is really about");
    await expect(page.getByTestId("job-detail")).toContainText("CAF");
    await expect(page.getByTestId("job-network-tab")).toContainText("Network access does not change Work Fit");

    await page.getByTestId("reaction-dislike").click();
    await expect(page.getByTestId("recommendation-change")).toContainText("Capability evidence was not changed");

    await page.getByTestId("debug-console").scrollIntoViewIfNeeded();
    await expect(page.getByTestId("debug-console")).toContainText("Decision trace");
    await expect(page.getByTestId("debug-console")).toContainText("Raw fit");
    await expect(page.getByTestId("debug-console")).toContainText("Capability matches and gaps");
    await expect(page.getByTestId("debug-console")).toContainText("Raw observations");
  });
}

test("human opportunity graph dashboard supports network strategy inspection", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("network-dashboard").scrollIntoViewIfNeeded();
  await expect(page.getByTestId("network-dashboard")).toContainText("Today: next best actions");
  await expect(page.getByTestId("network-dashboard")).toContainText("Network coverage");
  await expect(page.getByTestId("network-dashboard")).toContainText("Contact explorer");
  await expect(page.getByTestId("network-dashboard")).toContainText("Best warm paths");
  await expect(page.getByTestId("network-dashboard")).toContainText(/Social cost|Best ask|Work Fit/);
});

test("standalone export works without the app server", async ({ page }) => {
  await page.goto("file:///workspace/artifacts/function_map_demo.html");
  await expect(page.getByRole("heading", { name: "TaskDNA function map demo" })).toBeVisible();
  await page.locator("#search").fill("reliability");
  await page.locator("#sort").selectOption("fit");
  await page.locator("#freshness").selectOption("POSSIBLY_STALE");
  await expect(page.locator(".job").first()).toBeVisible();
  await page.locator(".job").first().click();
  await expect(page.locator("#detail")).toContainText("Decision trace");
  await page.locator("#save").click();
  await page.locator("#savedOnly").click();
  await expect(page.locator(".job").first()).toBeVisible();
});

test("standalone opportunity graph export works without the app server", async ({ page }) => {
  await page.goto("file:///workspace/artifacts/opportunity_graph_demo.html");
  await expect(page.getByRole("heading", { name: "Human Opportunity Graph" })).toBeVisible();
  await expect(page.locator("#actions")).toContainText("Priority");
  await expect(page.locator("#contacts")).toContainText("Routing");
  await expect(page.locator("#access")).toContainText("Referral");
  await expect(page.locator("#paths")).toContainText(/DIRECT|SECOND DEGREE/);
});
