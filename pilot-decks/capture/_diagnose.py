"""Diagnose why the workspace stays on the skeleton: poll body text growth and
capture console errors + failed network responses after admin login."""
import os
import sys
from playwright.sync_api import sync_playwright

BASE = "http://localhost:5173"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_smoke_out")
EMAIL, PW = "pilot.admin@atlas.test", "AtlasPilot2026!"


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        msgs = []
        page.on("console", lambda m: msgs.append(f"[{m.type}] {m.text[:200]}"))
        page.on("response", lambda r: msgs.append(f"[net {r.status}] {r.url[:160]}") if r.status >= 400 else None)
        page.on("pageerror", lambda e: msgs.append(f"[pageerror] {str(e)[:200]}"))

        page.goto(f"{BASE}/app", wait_until="networkidle")
        page.wait_for_timeout(1000)
        page.fill("input[type=email]", EMAIL)
        page.fill("input[type=password]", PW)
        page.get_by_role("button", name="sign in with email").click()
        page.wait_for_function("() => !document.querySelector('input[type=password]')", timeout=30000)

        for i in range(15):
            page.wait_for_timeout(2000)
            stat = page.evaluate(
                """() => ({
                  bodyLen: document.body.innerText.length,
                  shimmerCls: [...new Set([...document.querySelectorAll('div')]
                    .map(d => (d.className||'').toString())
                    .filter(c => /pulse|shimmer|skeleton|animate/i.test(c)))].slice(0,5),
                  banner: (document.body.innerText.match(/error|denied|permission|unable|failed/i)||[])[0] || null,
                })"""
            )
            print(f"t+{(i+1)*2:>2}s bodyLen={stat['bodyLen']:>6} shimmer={stat['shimmerCls']} banner={stat['banner']}")
            if stat["bodyLen"] > 400:
                break

        print("\n--- console / network (last 40) ---")
        for m in msgs[-40:]:
            print(m)
        page.screenshot(path=os.path.join(OUT, "diagnose_final.png"))
        browser.close()


if __name__ == "__main__":
    sys.exit(main())
