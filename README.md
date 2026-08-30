🌍 World Explorer - Node.js Edition
A web-based adventure game where players explore real-world locations using Overture Maps API and OpenStreetMap. Collect points by discovering and visiting places around the world!

✨ Features
🗺️ Interactive Map - Powered by OpenStreetMap tiles with Overture Maps data

🎮 Gameplay - Explore real-world locations and collect points

🏃 Movement - Use WASD or Arrow keys to navigate

⭐ Points System - Collect places to earn points

👤 User Authentication - Login system with JWT tokens

📊 Leaderboard - Compete with other players

🏆 Collections - Track all places you've discovered

📋 Prerequisites
Node.js (v14 or higher)

npm (v6 or higher)

Overture Maps API Key (Get one here)

🚀 Installation
1. Clone the Repository
bash
git clone https://github.com/yourusername/world-explorer-node.git
cd world-explorer-node
2. Install Dependencies
bash
npm install
3. Configure Environment Variables
Create a .env file in the root directory:

env
PORT=5000
JWT_SECRET=your_super_secret_jwt_key_change_this
OVERTURE_API_KEY=your_overture_api_key_here
NODE_ENV=development
4. Start the Application
bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
5. Access the Application
Open your browser and navigate to: http://localhost:5000

🔑 Default Accounts
Username	Password	Role
admin	adminpass	Admin
alice	alicepass	User
bob	bobpass	User
🎮 How to Play
Login - Use one of the default accounts or register a new one

Explore - Move around the map using WASD or Arrow keys

Collect - Click on markers to collect places and earn points

Track Progress - View your collected places and score in the sidebar

Compete - Try to collect more points than other players!

Controls
Key	Action
W / ↑	Move North
S / ↓	Move South
A / ←	Move West
D / →	Move East
Click	Move to location
Click Marker	Collect place
🏗️ Project Structure
text
world-explorer-node/
├── src/
│   ├── config/
│   │   └── database.js          # Database configuration
│   ├── models/
│   │   ├── User.js              # User model
│   │   └── Location.js          # Location model
│   ├── controllers/
│   │   ├── authController.js    # Authentication logic
│   │   └── mapController.js     # Map and gameplay logic
│   ├── routes/
│   │   ├── authRoutes.js        # Auth endpoints
│   │   └── mapRoutes.js         # Map endpoints
│   ├── middleware/
│   │   └── auth.js              # JWT authentication
│   ├── public/
│   │   ├── css/
│   │   │   └── style.css        # Styling
│   │   └── js/
│   │       └── map.js           # Frontend game logic
│   ├── views/
│   │   └── index.html           # Main HTML page
│   └── app.js                   # Application entry point
├── data/
│   └── world_explorer.db        # SQLite database
├── .env                         # Environment variables
├── package.json                 # Dependencies
└── README.md                    # This file
📡 API Endpoints
Authentication
Method	Endpoint	Description
POST	/api/auth/login	User login
POST	/api/auth/register	User registration
GET	/api/auth/profile	Get user profile (authenticated)
Map & Gameplay
Method	Endpoint	Description
GET	/api/map/places	Get places near location
GET	/api/map/search	Search for places
GET	/api/map/place/:id	Get place details
POST	/api/map/collect	Collect a place
GET	/api/map/locations	Get collected places
POST	/api/map/position	Update player position
GET	/api/map/leaderboard	Get top players
GET	/api/map/status	Check Overture Maps status
Example API Calls
Login:

bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"adminpass"}'
Get Places:

bash
curl "http://localhost:5000/api/map/places?lat=40.7128&lng=-74.0060" \
  -H "Authorization: Bearer YOUR_TOKEN"
Collect Place:

bash
curl -X POST http://localhost:5000/api/map/collect \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"name":"Central Park","lat":40.7829,"lng":-73.9654,"points":15}'
🗺️ Technology Stack
Backend
Express.js - Web framework

SQLite3 - Lightweight database

JWT - Authentication

Axios - HTTP client for Overture Maps API

bcryptjs - Password hashing

Frontend
Leaflet.js - Interactive maps

OpenStreetMap - Map tiles

Overture Maps API - Place data

Vanilla JavaScript - Game logic

APIs
Overture Maps - Places, POIs, and location data

OpenStreetMap - Map tiles and base maps

🔧 Configuration
Overture Maps API Key
Visit Overture Maps

Sign up for an API key

Add the key to your .env file

Database
The application uses SQLite by default. The database file is created automatically at data/world_explorer.db.

🧪 Testing
Run the test script to verify everything is working:

bash
node test-api.js
🚨 Troubleshooting
Common Issues
Map not loading:

Check your internet connection

Verify OpenStreetMap tiles are accessible

Check browser console for errors

Overture API errors:

Verify your API key in .env

Check if you've exceeded rate limits

The app will fallback to mock data if Overture is unavailable

Database errors:

Delete data/world_explorer.db and restart

The database will be recreated automatically

Authentication issues:

Clear your browser's local storage

Verify JWT_SECRET in .env

Check that the token is being sent in headers

📦 Deployment
Deploy to Heroku
bash
# Install Heroku CLI
# Create a Procfile
echo "web: npm start" > Procfile

# Deploy
git push heroku main
Deploy to Vercel
bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
Deploy with Docker
dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
🤝 Contributing
Fork the repository

Create a feature branch (git checkout -b feature/AmazingFeature)

Commit your changes (git commit -m 'Add some AmazingFeature')

Push to the branch (git push origin feature/AmazingFeature)

Open a Pull Request

📝 License
This project is licensed under the MIT License - see the LICENSE file for details.

🙏 Acknowledgments
Overture Maps Foundation for providing the place data

OpenStreetMap for the map tiles

Leaflet for the interactive mapping library

Express.js for the web framework

📞 Support
Create an issue in the GitHub repository

Check the Overture Maps documentation

Visit the Leaflet documentation

🎯 Roadmap
□ Real-time multiplayer
□ Chat system
□ Achievements and badges
□ Mobile app version
□ Social features (friends, sharing)
□ Daily challenges
□ Custom map themes
□ Export/import collections
Built with ❤️ using Node.js, Express, and Overture Maps

Happy exploring! 🌍