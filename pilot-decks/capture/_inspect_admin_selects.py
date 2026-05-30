"""Dump the admin workspace's nav <select> elements and their options so we can
drive category sub-views for the administrator deck."""
import os, sys
from playwright.sync_api import sync_playwright
import capture_lib as cl

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_smoke_out")


def main():
    with sync_playwright() as p:
        browser, page = cl.launch(p)
        try:
            cl.login(page, "Administrator")
            cl.set_role_view(page, "Administrator")
            data = page.evaluate(
                """() => [...document.querySelectorAll('select')].map(s => ({
                    aria: s.getAttribute('aria-label'),
                    value: s.value,
                    options: [...s.options].map(o => o.text.trim())
                }))"""
            )
            for i, s in enumerate(data):
                print(f"select[{i}] aria={s['aria']!r} value={s['value']!r}")
                print("   options:", s["options"])
        finally:
            browser.close()


if __name__ == "__main__":
    sys.exit(main())
