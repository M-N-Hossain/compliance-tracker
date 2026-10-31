import http from "k6/http";
import { check, sleep } from "k6";
import type { Options } from "k6/options";

export const options: Options = {
  vus: 1, // smoke test: just ONE robot
  duration: "10s", // run for 10 seconds

  // Pass/fail rules. If these are broken, k6 marks the test failed.
  thresholds: {
    http_req_duration: ["p(95)<500"], // 95% of requests faster than 500 ms
    http_req_failed: ["rate<0.01"], // fewer than 1% errors
  },
};

// Change this if your app runs on another port.
const BASE_URL = "http://localhost:3000";

// Each robot runs this function in a loop until time is up.
export default function smokeTest(): void {
  const res = http.get(`${BASE_URL}/login`);

  // Assertion: did we get a normal page back?
  // TypeScript knows "r" is a k6 Response, so r.status autocompletes.
  check(res, {
    "status is 200": (r) => r.status === 200,
  });

  sleep(1);
}
