// test-api.js - Test API endpoints without starting the main app

const axios = require('axios');
const { performance } = require('perf_hooks');
const crypto = require('crypto');

// Test configuration
const BASE_URL = process.env.TEST_URL || 'http://localhost:5000';
const TIMEOUT = 5000;

// Colors for output
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    gray: '\x1b[90m',
    bold: '\x1b[1m'
};

function log(message, color = 'reset', bold = false) {
    const boldText = bold ? colors.bold : '';
    console.log(`${boldText}${colors[color]}${message}${colors.reset}`);
}

function logTest(name, passed, message = '') {
    const status = passed ? '✅ PASS' : '❌ FAIL';
    const color = passed ? 'green' : 'red';
    log(`  ${status} - ${name}`, color);
    if (message) log(`    ${message}`, 'gray');
}

class APITester {
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
        this.results = [];
        this.testUser = {
            username: `test_${Date.now()}`,
            email: `test_${Date.now()}@example.com`,
            password: 'Test123!@#'
        };
        this.authToken = null;
    }

async testConnection() {
    const start = performance.now();
    
    // List of possible health endpoints
    const endpoints = [
        '/api/health',
        '/health', 
        '/',
        '/status',
        '/api/status',
        '/places',
        '/api/ping'
    ];
    
    console.log(`\n🔍 Testing connection to ${this.baseUrl}...`);
    
    // First check if server is reachable
    try {
        const baseResponse = await axios.get(this.baseUrl, { 
            timeout: 3000,
            validateStatus: () => true
        });
        console.log(`   ✅ Server reachable (Status: ${baseResponse.status})`);
    } catch (error) {
        console.log(`   ❌ Server not reachable: ${error.message}`);
        return { passed: false, error: 'Server not reachable' };
    }
    
    // Try each endpoint
    for (const endpoint of endpoints) {
        try {
            const response = await axios.get(`${this.baseUrl}${endpoint}`, {
                timeout: 3000,
                validateStatus: () => true
            });
            
            if (response.status === 200) {
                const duration = (performance.now() - start).toFixed(2);
                console.log(`   ✅ Found working endpoint: ${endpoint} (${duration}ms)`);
                
                // Store the working endpoint for other tests
                this.workingEndpoint = endpoint;
                
                return { 
                    passed: true, 
                    duration,
                    data: response.data,
                    endpoint: endpoint
                };
            } else {
                console.log(`   ⚠️  ${endpoint} returned status ${response.status}`);
            }
        } catch (error) {
            console.log(`   ⚠️  ${endpoint} failed: ${error.message}`);
        }
    }
    
    console.log(`   ❌ No working endpoint found`);
    return { passed: false, error: 'No endpoints responding' };
}

    async testEndpoint(method, endpoint, data = null, headers = {}) {
        const start = performance.now();
        try {
            const config = {
                method,
                url: `${this.baseUrl}${endpoint}`,
                timeout: TIMEOUT,
                headers: {
                    'Content-Type': 'application/json',
                    ...headers
                }
            };
            
            if (data && ['post', 'put', 'patch'].includes(method.toLowerCase())) {
                config.data = data;
            }
            
            const response = await axios(config);
            const duration = (performance.now() - start).toFixed(2);
            
            return {
                passed: true,
                duration,
                status: response.status,
                data: response.data
            };
        } catch (error) {
            const duration = (performance.now() - start).toFixed(2);
            return {
                passed: false,
                duration,
                status: error.response?.status || 0,
                error: error.response?.data || error.message,
                data: error.response?.data
            };
        }
    }

    async testHealth() {
        log('\n🏥 Testing Health Endpoint', 'cyan', true);
        const result = await this.testEndpoint('get', '/api/health');
        
        if (result.passed) {
            logTest('Health check', true, `Status: ${result.status}, Response: ${JSON.stringify(result.data)}`);
        } else {
            logTest('Health check', false, `Error: ${result.error}`);
        }
        this.results.push({ name: 'Health Check', ...result });
        return result;
    }

    async testRegistration() {
        log('\n📝 Testing User Registration', 'cyan', true);
        
        const result = await this.testEndpoint('post', '/api/auth/register', this.testUser);
        
        if (result.passed && result.data && result.data.token) {
            this.authToken = result.data.token;
            logTest('Registration', true, `User: ${this.testUser.username}, Status: ${result.status}`);
        } else {
            logTest('Registration', false, result.error || 'Failed to register');
        }
        this.results.push({ name: 'Registration', ...result });
        return result;
    }

    async testLogin() {
        log('\n🔑 Testing User Login', 'cyan', true);
        
        const loginData = {
            username: this.testUser.username,
            password: this.testUser.password
        };
        
        const result = await this.testEndpoint('post', '/api/auth/login', loginData);
        
        if (result.passed && result.data && result.data.token) {
            this.authToken = result.data.token;
            logTest('Login', true, `User: ${this.testUser.username}, Status: ${result.status}`);
        } else {
            logTest('Login', false, result.error || 'Failed to login');
        }
        this.results.push({ name: 'Login', ...result });
        return result;
    }

    async testProtectedEndpoint() {
        log('\n🔐 Testing Protected Endpoint', 'cyan', true);
        
        if (!this.authToken) {
            logTest('Protected Endpoint', false, 'No auth token available');
            return { passed: false, error: 'No auth token' };
        }
        
        const headers = { Authorization: `Bearer ${this.authToken}` };
        const result = await this.testEndpoint('get', '/api/places', null, headers);
        
        if (result.passed) {
            logTest('Protected Endpoint', true, `Status: ${result.status}, Data: ${JSON.stringify(result.data).substring(0, 100)}...`);
        } else {
            logTest('Protected Endpoint', false, result.error || 'Failed to access protected endpoint');
        }
        this.results.push({ name: 'Protected Endpoint', ...result });
        return result;
    }

    async testInvalidLogin() {
        log('\n❌ Testing Invalid Login', 'cyan', true);
        
        const invalidData = {
            username: 'nonexistent_user',
            password: 'wrong_password'
        };
        
        const result = await this.testEndpoint('post', '/api/auth/login', invalidData);
        
        // Expecting 401 Unauthorized
        const passed = result.status === 401;
        logTest('Invalid Login (should fail)', passed, `Status: ${result.status}, Expected: 401`);
        this.results.push({ name: 'Invalid Login', ...result, passed });
        return { ...result, passed };
    }

    async testMissingFields() {
        log('\n⚠️  Testing Missing Fields Validation', 'cyan', true);
        
        const missingData = {
            username: 'testuser'
            // Missing email and password
        };
        
        const result = await this.testEndpoint('post', '/api/auth/register', missingData);
        
        const passed = result.status === 400;
        logTest('Missing Fields Validation', passed, `Status: ${result.status}, Expected: 400`);
        this.results.push({ name: 'Missing Fields', ...result, passed });
        return { ...result, passed };
    }

    async testRateLimit() {
        log('\n⏱️  Testing Rate Limits', 'cyan', true);
        
        const start = Date.now();
        const requests = [];
        
        for (let i = 0; i < 10; i++) {
            requests.push(
                this.testEndpoint('get', '/api/health')
            );
        }
        
        const results = await Promise.all(requests);
        const duration = Date.now() - start;
        
        const failed = results.filter(r => !r.passed);
        const passed = failed.length === 0;
        
        logTest('Rate Limit Test', passed, `${results.length} requests in ${duration}ms, ${failed.length} failed`);
        this.results.push({ name: 'Rate Limit', passed });
        return { passed, results };
    }

    async runAllTests() {
        log('\n🚀 Starting API Tests', 'magenta', true);
        log(`   Base URL: ${this.baseUrl}`, 'gray');
        log(`   Timeout: ${TIMEOUT}ms`, 'gray');
        log('='.repeat(50), 'cyan');

        // Check if server is running
        const connection = await this.testConnection();
        if (!connection.passed) {
            log('\n❌ Cannot connect to server!', 'red');
            log(`   Error: ${connection.error}`, 'red');
            log(`   Make sure the server is running at ${this.baseUrl}`, 'yellow');
            return;
        }

        await this.testHealth();
        await this.testRegistration();
        await this.testLogin();
        await this.testProtectedEndpoint();
        await this.testInvalidLogin();
        await this.testMissingFields();
        await this.testRateLimit();

        this.printSummary();
    }

    printSummary() {
        log('\n📊 Test Summary', 'blue', true);
        log('='.repeat(50), 'cyan');
        
        const total = this.results.length;
        const passed = this.results.filter(r => r.passed).length;
        const failed = total - passed;
        
        log(`  Total Tests: ${total}`, 'reset');
        log(`  Passed: ${passed}`, 'green');
        log(`  Failed: ${failed}`, 'red');
        log(`  Success Rate: ${((passed / total) * 100).toFixed(1)}%`, 'cyan');
        
        // Detailed results
        log('\n📋 Detailed Results:', 'blue');
        this.results.forEach((result, index) => {
            const status = result.passed ? '✅' : '❌';
            const duration = result.duration ? `${result.duration}ms` : 'N/A';
            log(`  ${status} ${result.name} - ${duration}`, result.passed ? 'green' : 'red');
        });
        
        log('\n' + '='.repeat(50), 'cyan');
        log(`\n💡 To run specific tests:`, 'yellow');
        log(`   node test-api.js --test=health`, 'gray');
        log(`   node test-api.js --test=registration`, 'gray');
        log(`   node test-api.js --test=login`, 'gray');
    }
}

// Command-line argument parsing
async function runSpecificTest(testName) {
    const tester = new APITester(BASE_URL);
    
    const tests = {
        health: () => tester.testHealth(),
        registration: () => tester.testRegistration(),
        login: () => tester.testLogin(),
        protected: () => tester.testProtectedEndpoint(),
        invalid: () => tester.testInvalidLogin(),
        missing: () => tester.testMissingFields(),
        ratelimit: () => tester.testRateLimit()
    };
    
    if (tests[testName]) {
        await tests[testName]();
    } else {
        log(`❌ Test "${testName}" not found`, 'red');
        log(`Available tests: ${Object.keys(tests).join(', ')}`, 'yellow');
    }
}

// Main execution
if (require.main === module) {
    const args = process.argv.slice(2);
    const testArg = args.find(arg => arg.startsWith('--test='));
    
    if (testArg) {
        const testName = testArg.split('=')[1];
        runSpecificTest(testName).catch(console.error);
    } else {
        // Run all tests
        const tester = new APITester(BASE_URL);
        tester.runAllTests().catch(console.error);
    }
}

module.exports = { APITester };