"""
Smoke + DOM-inspection pass for the Atlas pilot screenshot pipeline.

Loads the public landing and the /app workspace, screenshots both, and dumps the
interactive controls (inputs, buttons, links, role text) so we can learn the
real selectors for the login form and role switcher before automating captures.
Run: python3 pilot-decks/capture/_smoke.py
"""
import json
import os
import sys
from playwright.sync_api import sync_playwright

BASE = "http://localhost:5173"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_smoke_out")
os.makedirs(OUT, exist_ok=True)


def dump_controls(page, tag):
    info = page.evaluate(
        """() => {
          const pick = (el) => ({
            tag: el.tagName.toLowerCase(),
            type: el.getAttribute('type'),
            name: el.getAttribute('name'),
            id: el.id || null,
            placeholder: el.getAttribute('placeholder'),
            aria: el.getAttribute('aria-label'),
            text: (el.innerText || el.value || '').trim().slice(0, 60),
            testid: el.getAttribute('data-testid'),
          });
          return {
            title: document.title,
            url: location.href,
            inputs: [...document.querySelectorAll('input,textarea,select')].map(pick),
            buttons: [...document.querySelectorAll('button,[role=button]')].map(pick).slice(0, 60),
            headings: [...document.querySelectorAll('h1,h2,h3')].map(e => e.innerText.trim()).slice(0, 30),
          };
        }"""
    )
    with open(os.path.join(OUT, f"{tag}.json"), "w") as f:
        json.dump(info, f, indent=2)
    print(f"== {tag} :: {info['title']} :: {info['url']}")
    print("  headings:", info["headings"][:12])
    print("  inputs:", [(i["type"], i["name"], i["placeholder"], i["aria"]) for i in info["inputs"]])
    print("  buttons:", [b["text"] for b in info["buttons"] if b["text"]][:25])


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        page.set_default_timeout(20000)

        page.goto(f"{BASE}/", wait_until="networkidle")
        page.wait_for_timeout(1500)
        page.screenshot(path=os.path.join(OUT, "landing.png"), full_page=False)
        dump_controls(page, "landing")

        page.goto(f"{BASE}/app", wait_until="networkidle")
        page.wait_for_timeout(2000)
        page.screenshot(path=os.path.join(OUT, "app.png"), full_page=False)
        dump_controls(page, "app")

        browser.close()
    print("\nwrote screenshots + json to", OUT)


if __name__ == "__main__":
    sys.exit(main())
