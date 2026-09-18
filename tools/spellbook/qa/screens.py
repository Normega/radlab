import asyncio, sys, os
TARGET = sys.argv[1]  # file:///abs/path/index.html or https://radlab.zone/spellbook/
OUTDIR = sys.argv[2] if len(sys.argv) > 2 else '/tmp'
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        errs = []
        for name, hash_, w, h, full in [('home','#/',1280,900,True),('spell','#/spell/sense-foraging/2',1280,900,False),('abbey','#/spell/metaphor-mirror/2',1280,900,False),
                                  ('paper','#/evidence/nap-spell?ref=nap-spell-r6',1280,900,False),('evidx','#/evidence',1280,900,False),('mob','#/spell/steady-motion',390,844,True),('dark','#/',1280,900,False)]:
            ctx = await b.new_context(viewport={'width':w,'height':h}, color_scheme='dark' if name=='dark' else 'light')
            pg = await ctx.new_page()
            pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: m.type=='error' and errs.append(m.text))
            await pg.route('**/fonts.googleapis.com/**', lambda r: r.abort())
            await pg.goto(TARGET + hash_)
            await pg.wait_for_timeout(900)
            await pg.screenshot(path=os.path.join(OUTDIR, f'{name}.png'), full_page=full)
            await ctx.close()
        print(errs[:5])
        await b.close()
asyncio.run(main())
