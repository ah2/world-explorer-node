// Simple user model for in-memory store
let nextId = 1;

class User {
  constructor(username, email, password) {
    this.id = nextId++;
    this.username = username;
    this.email = email;
    this.password = password;
    this.createdAt = new Date();
  }
}

module.exports = User;