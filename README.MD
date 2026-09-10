# 🌍 World Explorer - Node.js Edition

A web-based adventure game where players explore real-world locations using **Overture Maps API** and **OpenStreetMap**. Collect points by discovering and visiting places around the world!

## ✨ Features

- 🗺️ **Interactive Map** - Powered by OpenStreetMap tiles with Overture Maps data
- 🎮 **Gameplay** - Explore real-world locations and collect points
- 🏃 **Movement** - Use WASD or Arrow keys to navigate
- ⭐ **Points System** - Collect places to earn points
- 👤 **User Authentication** - Login system with JWT tokens
- 📊 **Leaderboard** - Compete with other players
- 🏆 **Collections** - Track all places you've discovered

## 📋 Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)
- Overture Maps API Key ([Get one here](https://overturemaps.org/))

## 🚀 Installation

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/world-explorer-node.git
cd world-explorer-node
```

### 2. Install dependencies

```bash
npm install
```
### 3. Configure environment variables

```bash
cp example.env .env
//Edit .env and add your OVERTURE_API_KEY
```

### 4. Start the server

```bash
npm start
```
### 4. open your browser
    Navigate to http://localhost:5000 (or the port specified in your .env)

Happy exploring! 🌎