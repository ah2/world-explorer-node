const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

class AuthController {
    static async login(req, res) {
        try {
            const { username, password } = req.body;

            if (!username || !password) {
                return res.status(400).json({ 
                    error: 'Username and password are required' 
                });
            }

            const user = await User.findByUsername(username);

            if (!user) {
                return res.status(401).json({ 
                    error: 'Invalid username or password' 
                });
            }

            // For development, check plain text passwords
            const validPasswords = ['adminpass', 'alicepass', 'bobpass'];
            const isValid = validPasswords.includes(password);

            if (!isValid) {
                return res.status(401).json({ 
                    error: 'Invalid username or password' 
                });
            }

            const token = jwt.sign(
                { 
                    userId: user.id, 
                    username: user.username 
                },
                process.env.JWT_SECRET || 'your-secret-key-change-this',
                { expiresIn: '24h' }
            );

            res.json({
                success: true,
                token,
                user: {
                    id: user.id,
                    username: user.username,
                    score: user.score || 0,
                    position: { 
                        lat: user.current_lat || 40.7128, 
                        lng: user.current_lng || -74.0060 
                    }
                }
            });
        } catch (error) {
            console.error('Login error:', error);
            res.status(500).json({ 
                error: 'An error occurred during login' 
            });
        }
    }

    static async register(req, res) {
        try {
            const { username, password } = req.body;

            if (!username || !password) {
                return res.status(400).json({ 
                    error: 'Username and password are required' 
                });
            }

            if (username.length < 3 || password.length < 3) {
                return res.status(400).json({ 
                    error: 'Username and password must be at least 3 characters' 
                });
            }

            const existingUser = await User.findByUsername(username);
            if (existingUser) {
                return res.status(400).json({ 
                    error: 'Username already exists' 
                });
            }

            // In production, hash the password
            const hashedPassword = password; // For development only

            const userId = await User.create(username, hashedPassword);

            res.status(201).json({ 
                success: true,
                message: 'User created successfully',
                userId
            });
        } catch (error) {
            console.error('Register error:', error);
            res.status(500).json({ 
                error: 'An error occurred during registration' 
            });
        }
    }

    static async getProfile(req, res) {
        try {
            const userId = req.userId;
            const user = await User.findById(userId);

            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            res.json({
                id: user.id,
                username: user.username,
                score: user.score || 0,
                position: {
                    lat: user.current_lat || 40.7128,
                    lng: user.current_lng || -74.0060
                },
                created_at: user.created_at
            });
        } catch (error) {
            console.error('Get profile error:', error);
            res.status(500).json({ error: 'Failed to get profile' });
        }
    }
}

// Export the class methods directly
module.exports = {
    login: AuthController.login,
    register: AuthController.register,
    getProfile: AuthController.getProfile
};
