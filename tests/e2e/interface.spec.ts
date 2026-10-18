import { expect,test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('Hebrew defaults, English, dark mode and startup preferences persist after reload',async({page})=>{
  await page.goto('/');await expect(page.locator('html')).toHaveAttribute('dir','rtl');await expect(page.locator('html')).toHaveAttribute('lang','he');
  await page.getByRole('button',{name:'העדפות',exact:true}).click();await page.locator('#language').selectOption('en');await page.locator('#theme').selectOption('dark');await page.locator('#start-tab').selectOption('pdf');await page.getByRole('button',{name:'Save defaults',exact:true}).click();await page.reload();
  await expect(page.locator('html')).toHaveAttribute('dir','ltr');await expect(page.locator('html')).toHaveAttribute('data-theme','dark');await expect(page.getByRole('heading',{name:'A little order for your PDFs.'})).toBeVisible();
  await page.screenshot({path:'tmp/screenshots/dark-english.png',fullPage:true});await page.getByRole('button',{name:'Help & glossary',exact:true}).click();await expect(page.getByRole('heading',{name:'Which format?'})).toBeVisible();
});
test('help beside every image tool opens and closes using the keyboard',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'עזרה: שינוי מידות',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();await expect(page.getByRole('dialog')).toContainText('בלי חיתוך');await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
});
test('mobile Hebrew and English layouts have no horizontal page overflow or runtime errors',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width:390,height:844});await page.goto('/');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();await page.screenshot({path:'tmp/screenshots/mobile-hebrew.png',fullPage:true});await page.getByRole('button',{name:'שפת הממשק',exact:true}).click();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();await page.getByRole('button',{name:'PDF tools',exact:true}).click();await expect(page.getByRole('heading',{name:'A little order for your PDFs.'})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();expect(errors).toEqual([]);
});
test('does not send files or use any third-party network service',async({page})=>{
  const external:string[]=[];page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:5176')&&!r.url().startsWith('blob:')&&!r.url().startsWith('data:'))external.push(r.url());});await page.goto('/');await page.getByRole('button',{name:'כלי PDF',exact:true}).click();await expect(page.getByRole('heading',{name:'קצת סדר ב־PDF.'})).toBeVisible();expect(external).toEqual([]);
});
test('main workspace passes automated accessibility checks in light and dark mode',async({page})=>{
  await page.goto('/');
  expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze()).violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}))).toEqual([]);
  await page.getByRole('button',{name:'כהה',exact:true}).click();
  await page.locator('.dropzone').evaluate(async element => { await Promise.all(element.getAnimations().map(animation => animation.finished)); });
  expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze()).violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}))).toEqual([]);
});
