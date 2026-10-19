import { test, expect } from '@playwright/test';
test('register, demo chat, tools and confirmed memory', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await page.getByRole('button', { name: '注册账号' }).click();
  await page.getByLabel('邮箱').fill(`browser-${Date.now()}@example.com`);
  await page.getByLabel('密码').fill('BrowserTestPass123!');
  await page.getByRole('button', { name: '创建账号并出发' }).click();
  await expect(page.getByText('演示模式', { exact: true })).toBeVisible();
  await page.getByPlaceholder('告诉我，你想去哪里？').fill('计划杭州三日旅行');
  await page.getByRole('button', { name: '发送消息' }).click();
  await expect(page.getByText('这是演示模式', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: '预算估算', exact: false }).first().click();
  await page.getByRole('button', { name: '开始查询' }).click();
  await expect(page.getByText('结果来源')).toBeVisible();
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await page.getByRole('button', { name: '旅行记忆', exact: false }).click();
  await page.getByLabel('偏好类型').click();
  await page.getByText('旅行节奏', { exact: true }).click();
  await page.getByLabel('偏好内容').fill('慢节奏城市漫步');
  await page.getByRole('button', { name: '确认并保存记忆' }).click();
  await expect(page.getByText('慢节奏城市漫步', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await page.getByRole('button', { name: '开启新旅程' }).click();
  await expect(page.getByText('偏好已保存', { exact: true })).toBeHidden();
  await expect(page.getByText('心之所向，', { exact: false })).toBeVisible();
  await page
    .getByRole('navigation', { name: '会话列表' })
    .getByRole('button', { name: 'message 计划杭州三日旅行', exact: true })
    .click();
  await expect(page.getByText('这是演示模式', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: '开启新旅程' }).click();
  await page.screenshot({ path: 'docs/screenshots/desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'docs/screenshots/mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.reload();
  await expect(page.getByRole('button', { name: '登录并出发' })).toBeVisible();
});
test('late old-account responses cannot appear in another account', async ({ page }) => {
  let release!: () => void;
  let began!: () => void;
  let settled!: () => void;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  const pending = new Promise<void>((r) => {
    began = r;
  });
  const finished = new Promise<void>((r) => {
    settled = r;
  });
  await page.route('**/api/auth/login', async (route) => {
    const { email } = route.request().postDataJSON() as { email: string };
    await route.fulfill({ json: { accessToken: email, user: { email } } });
  });
  await page.route('**/api/conversations', async (route) => {
    if (route.request().headers().authorization === 'Bearer a@example.com') {
      began();
      await gate;
      await route
        .fulfill({
          json: [
            {
              id: crypto.randomUUID(),
              title: 'A-private-travel-title',
              updatedAt: new Date().toISOString(),
            },
          ],
        })
        .catch(() => {});
      settled();
    } else await route.fulfill({ json: [] });
  });
  await page.goto('/');
  for (const email of ['a@example.com', 'b@example.com']) {
    await page.getByLabel('邮箱').fill(email);
    await page.getByLabel('密码').fill('TestPassword123!');
    await page.getByRole('button', { name: '登录并出发' }).click();
    await expect(page.getByTitle(email)).toBeVisible();
    if (email.startsWith('a@')) {
      await pending;
      await page.getByRole('button', { name: '退出登录' }).click();
    }
  }
  release();
  await finished;
  await expect(page.getByText('A-private-travel-title')).toHaveCount(0);
});
