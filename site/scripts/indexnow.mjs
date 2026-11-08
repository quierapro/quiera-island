// Tells search engines that use IndexNow (Bing, Yandex, Seznam, Naver…) about
// every page of the live sitemap, so they crawl new and changed pages soon.
// Run it after a deployment: pnpm indexnow
//
// The key is public by design: public/<key>.txt proves the site is ours.
const KEY = "8b3439daf89202eb9fbe90bf4729bd27";
const site = (process.env.SITE_URL || "https://quiera.eu/").replace(/\/?$/, "/");
const host = new URL(site).host;

const sitemap = await (await fetch(`${site}sitemap.xml`)).text();
const urlList = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
if (!urlList.length) throw new Error("no URL in the live sitemap: is the site deployed?");

const keyFile = await fetch(`${site}${KEY}.txt`);
if (!keyFile.ok || (await keyFile.text()).trim() !== KEY) throw new Error(`${site}${KEY}.txt is not online yet: deploy first`);

const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host, key: KEY, keyLocation: `${site}${KEY}.txt`, urlList }),
});
// 200 and 202 both mean accepted.
console.log(`IndexNow: ${urlList.length} pages sent, answer ${res.status} ${res.statusText}`);
if (!res.ok) process.exit(1);
