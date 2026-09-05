const http = require('http');

const request = (method, path, body = null, token = null) => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };
    
    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    if (body) {
      const bodyData = JSON.stringify(body);
      options.headers['Content-Length'] = Buffer.byteLength(bodyData);
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data || '{}') });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', (e) => reject(e));
    
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
};

async function runTests() {
  console.log('--- Testing /api/health ---');
  let res = await request('GET', '/api/health');
  console.log(res);

  console.log('\n--- Testing Login (Admin Worker) ---');
  res = await request('POST', '/api/auth/login', { email: 'admin@example.com', password: 'password123' });
  console.log(res.status, res.data.message);
  const token = res.data.token;
  
  if (!token) {
    console.error('Login failed, aborting tests');
    return;
  }

  console.log('\n--- Testing Services CRUD ---');
  res = await request('POST', '/api/services', { name: 'Test Service', description: 'Test', price: 10.50 }, token);
  console.log('Create Service:', res.status, res.data);
  const serviceId = res.data.id;

  if (serviceId) {
    res = await request('GET', '/api/services', null, token);
    console.log('Get Services:', res.status, res.data.length, 'services found');

    res = await request('PUT', `/api/services/${serviceId}`, { price: 15.00 }, token);
    console.log('Update Service:', res.status, res.data);

    res = await request('DELETE', `/api/services/${serviceId}`, null, token);
    console.log('Delete Service:', res.status, res.data);
  }

  console.log('\n--- Testing Orders ---');
  res = await request('GET', '/api/orders', null, token);
  console.log('Get Orders:', res.status, res.data.length, 'orders found');
}

runTests().catch(console.error);
