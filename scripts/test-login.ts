import { CookieJar, Cookie } from "tough-cookie";

async function testLogin() {
  const baseUrl = "http://localhost:3000";
  const email = "joseph@buzzi.ai";
  const password = "Sec0ndStreet";

  console.log("🔐 Testing login...\n");

  try {
    const cookieJar = new CookieJar();

    // Get CSRF token with cookies
    console.log("1. Getting CSRF token...");
    const csrfResponse = await fetch(`${baseUrl}/api/auth/csrf`);

    // Extract cookies from response
    const setCookies = csrfResponse.headers.getSetCookie();
    for (const cookieStr of setCookies) {
      const cookie = Cookie.parse(cookieStr);
      if (cookie) {
        cookieJar.setCookieSync(cookie, baseUrl);
      }
    }

    const { csrfToken } = await csrfResponse.json();
    console.log(`   ✓ CSRF token obtained`);
    console.log(`   Cookies: ${setCookies.length} received\n`);

    // Get cookies for the request
    const cookies = cookieJar.getCookiesSync(baseUrl);
    const cookieHeader = cookies.map(c => `${c.key}=${c.value}`).join("; ");

    // Test login with cookies
    console.log("2. Attempting login...");
    const loginResponse = await fetch(`${baseUrl}/api/auth/callback/credentials`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Cookie": cookieHeader,
      },
      body: new URLSearchParams({
        email,
        password,
        csrfToken,
        callbackUrl: baseUrl,
      }),
      redirect: "manual",
    });

    console.log(`   Status: ${loginResponse.status}`);
    console.log(`   Location: ${loginResponse.headers.get("location")}`);

    if (loginResponse.status === 302 || loginResponse.status === 303) {
      const location = loginResponse.headers.get("location") || "";
      if (location.includes("error")) {
        const errorMatch = location.match(/error=([^&]+)/);
        const errorType = errorMatch ? errorMatch[1] : "Unknown";
        console.log(`\n❌ Login failed`);
        console.log(`   Error: ${errorType}`);

        // If CredentialsSignin, check database
        if (errorType === "CredentialsSignin") {
          console.log(`\n   This could mean:`);
          console.log(`   - User doesn't exist in the database`);
          console.log(`   - Password is incorrect`);
          console.log(`   - User is inactive or suspended`);
        }
      } else {
        console.log(`\n✅ Login successful!`);
        console.log(`   Redirecting to: ${location}`);
      }
    } else {
      const text = await loginResponse.text();
      console.log(`   Response: ${text.substring(0, 200)}...`);
    }
  } catch (error) {
    console.error("❌ Test failed:", error);
  }
}

testLogin();
