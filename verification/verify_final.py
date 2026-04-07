from playwright.sync_api import sync_playwright

def verify_app(page):
    page.goto("http://localhost:4173")
    page.wait_for_timeout(5000)  # Wait for bootstrap

    # Take screenshot of the main dashboard
    page.screenshot(path="verification/final_dashboard.png")

    # Open account settings
    page.click("button:has-text('Account Settings')")
    page.wait_for_timeout(1000)
    page.screenshot(path="verification/final_account_settings.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_app(page)
        except Exception as e:
            print(f"Error during verification: {e}")
        finally:
            browser.close()
