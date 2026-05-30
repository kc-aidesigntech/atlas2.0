"""Log in as each pilot role, set the role-switcher, and dump the top-nav labels
plus a workspace screenshot, so we can map deck steps to real nav targets."""
import os
import sys
from playwright.sync_api import sync_playwright
import capture_lib as cl

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_smoke_out")


def main():
    with sync_playwright() as p:
        for role in ["Administrator", "Navigator", "Supervisor", "Partner"]:
            browser, page = cl.launch(p)
            try:
                cl.login(page, role)
                cl.set_role_view(page, role)
                labels = cl.nav_labels(page)
                cl.shot(page, os.path.join(OUT, f"role_{role.lower()}.png"))
                print(f"== {role}: {labels}")
            except Exception as e:
                print(f"!! {role}: {type(e).__name__}: {e}")
            finally:
                browser.close()


if __name__ == "__main__":
    sys.exit(main())
