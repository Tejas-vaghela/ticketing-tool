// Quick HTTP endpoint verification script
async function runTests() {
  console.log('--- Testing Auth Endpoints ---');

  // Test 1: Empty body (Validation failure -> 400)
  try {
    const res1 = await fetch('http://localhost:4000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const data1 = await res1.json();
    console.log('1. Empty body status:', res1.status, '(expected 400)');
    console.log('   Error response:', data1.message);
  } catch (err) {
    console.error('1. Error:', err.message);
  }

  // Test 2: Invalid password -> 401
  try {
    const res2 = await fetch('http://localhost:4000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailOrId: 'tejas@inbox.GoldMine.io', password: 'wrongpassword' }),
    });
    const data2 = await res2.json();
    console.log('2. Invalid password status:', res2.status, '(expected 401)');
    console.log('   Error response:', data2.message);
  } catch (err) {
    console.error('2. Error:', err.message);
  }

  // Test 3: Valid login -> 200 + JWT
  let token = '';
  try {
    const res3 = await fetch('http://localhost:4000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailOrId: 'tejas@inbox.GoldMine.io', password: 'admin123' }),
    });
    const data3 = await res3.json();
    console.log('3. Valid login status:', res3.status, '(expected 200)');
    console.log('   User name:', data3.user?.name, '| Role:', data3.user?.role);
    console.log('   Has password exposed:', 'password' in (data3.user || {}), '(expected false)');
    token = data3.accessToken;
    console.log('   Token received length:', token ? token.length : 0);
  } catch (err) {
    console.error('3. Error:', err.message);
  }

  // Test 4: Protected GET /api/auth/me without token -> 401
  try {
    const res4 = await fetch('http://localhost:4000/api/auth/me', {
      method: 'GET',
    });
    console.log('4. GET /api/auth/me without token status:', res4.status, '(expected 401)');
  } catch (err) {
    console.error('4. Error:', err.message);
  }

  // Test 5: Protected GET /api/auth/me with Bearer token -> 200
  try {
    const res5 = await fetch('http://localhost:4000/api/auth/me', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const data5 = await res5.json();
    console.log('5. GET /api/auth/me with token status:', res5.status, '(expected 200)');
    console.log('   Hydrated user:', data5.name, `(${data5.email})`);
  } catch (err) {
    console.error('5. Error:', err.message);
  }

  // Test 6: Protected POST /api/auth/logout with Bearer token -> 200
  try {
    const res6 = await fetch('http://localhost:4000/api/auth/logout', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const data6 = await res6.json();
    console.log('6. POST /api/auth/logout with token status:', res6.status, '(expected 200)');
    console.log('   Logout result:', data6);
  } catch (err) {
    console.error('6. Error:', err.message);
  }

  // Test 7: Account switcher login by user id (e.g. user-2, support123) -> 200
  try {
    const res7 = await fetch('http://localhost:4000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailOrId: 'user-2', password: 'support123' }),
    });
    const data7 = await res7.json();
    console.log('7. Account switcher by ID status:', res7.status, '(expected 200)');
    console.log('   User name:', data7.user?.name, '| Role:', data7.user?.role);
  } catch (err) {
    console.error('7. Error:', err.message);
  }
}

runTests();
