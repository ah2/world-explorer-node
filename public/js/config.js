// Global configuration
const CONFIG = {
  basePath: '',
  apiBase: '/api'
};

// Helper to prefix paths with basePath
function getPath(relativePath) {
  return CONFIG.basePath + relativePath;
}

console.log('🔧 Config loaded:', CONFIG);