const axios = require('axios');
const User = require('../models/User');
const Location = require('../models/Location');

class MapController {
    static async getPlaces(req, res) {
        try {
            const { lat, lng, radius = 2000, categories = '' } = req.query;

            if (!lat || !lng) {
                return res.status(400).json({
                    error: 'Latitude and longitude are required'
                });
            }

            // 1. Check for API Key
            if (!process.env.OVERTURE_API_KEY || process.env.OVERTURE_API_KEY === 'your_overture_api_key_here') {
                console.warn('⚠️ Overture API key not configured, using mock data');
                return res.json(MapController.getMockPlaces(parseFloat(lat), parseFloat(lng)));
            }

            try {
                // 2. Use the NEW correct API endpoint and parameters
                const response = await axios.get('https://api.overturemapsapi.com/places', {
                    params: {
                        lat: parseFloat(lat),
                        lng: parseFloat(lng),
                        radius: parseInt(radius),
                        // You can pass categories as a comma-separated string, e.g., 'restaurant,cafe'
                        categories: categories || 'restaurant,cafe,park,museum', // Default categories
                        limit: 25 // Add a limit to control the number of results
                    },
                    headers: {
                        'x-api-key': process.env.OVERTURE_API_KEY // Use the correct header
                    },
                    timeout: 10000
                });

                // 3. Process the new response format
                if (response.data && response.data.features) {
                    const places = response.data.features
                        .filter(feature => feature.properties?.name)
                        .slice(0, 25)
                        .map(feature => ({
                            id: feature.id || `place-${Date.now()}-${Math.random()}`,
                            name: feature.properties.name || 'Unnamed Location',
                            category: feature.properties.categories?.[0] || feature.properties.category || 'Unknown',
                            lat: feature.geometry.coordinates[1],
                            lng: feature.geometry.coordinates[0],
                            address: feature.properties.address || 'No address',
                            // You can extract additional info like website or social links
                            website: feature.properties.website || null,
                            social: feature.properties.social || null,
                            points: Math.floor(Math.random() * 20) + 5,
                            source: 'Overture Maps (v2)'
                        }));

                    if (places.length > 0) {
                        return res.json(places);
                    }
                }

                // If no places found, use mock data
                console.log('No places found from Overture, using mock data');
                return res.json(MapController.getMockPlaces(parseFloat(lat), parseFloat(lng)));

            } catch (apiError) {
                // 4. Improved error logging
                console.error('Overture API error details:', {
                    message: apiError.message,
                    code: apiError.code,
                    response: apiError.response?.data,
                    status: apiError.response?.status
                });

                // If API fails, use mock data
                console.warn('⚠️ Overture API failed, using mock data');
                return res.json(MapController.getMockPlaces(parseFloat(lat), parseFloat(lng)));
            }
        } catch (error) {
            console.error('Get places error:', error);
            const { lat = 40.7128, lng = -74.0060 } = req.query;
            return res.json(MapController.getMockPlaces(parseFloat(lat), parseFloat(lng)));
        }
    }

    static getMockPlaces(lat, lng) {
        const places = [
            { name: 'Central Park', category: 'Park', points: 15 },
            { name: 'City Museum', category: 'Museum', points: 20 },
            { name: 'Grand Plaza', category: 'Square', points: 10 },
            { name: 'Riverside Cafe', category: 'Cafe', points: 8 },
            { name: 'Historic Tower', category: 'Landmark', points: 25 },
            { name: 'Botanical Garden', category: 'Garden', points: 18 },
            { name: 'Art Gallery', category: 'Museum', points: 22 },
            { name: 'Coffee House', category: 'Cafe', points: 12 },
            { name: 'Library', category: 'Education', points: 15 },
            { name: 'Sports Arena', category: 'Sports', points: 20 }
        ];

        return places.map((place, index) => ({
            id: `mock-${index}`,
            ...place,
            lat: lat + (Math.random() - 0.5) * 0.03,
            lng: lng + (Math.random() - 0.5) * 0.03,
            points: place.points
        }));
    }

    static async collectPlace(req, res) {
        try {
            const userId = req.userId;
            const { name, lat, lng, points } = req.body;

            if (!name || lat === undefined || lng === undefined) {
                return res.status(400).json({
                    error: 'Place name, latitude, and longitude are required'
                });
            }

            const isCollected = await Location.isCollected(userId, parseFloat(lat), parseFloat(lng));
            if (isCollected) {
                return res.status(400).json({
                    error: 'This place has already been collected'
                });
            }

            const pointsValue = points || 10;

            const locationId = await Location.collect(
                userId,
                name,
                parseFloat(lat),
                parseFloat(lng),
                pointsValue
            );

            await User.updateScore(userId, pointsValue);
            const score = await User.getScore(userId);
            const stats = await Location.getTotalCollected(userId);

            res.json({
                success: true,
                message: `${name} collected successfully!`,
                locationId,
                points: pointsValue,
                totalScore: score,
                totalCollected: stats.count
            });
        } catch (error) {
            console.error('Collect error:', error);
            res.status(500).json({ error: 'Failed to collect place' });
        }
    }

    static async getUserLocations(req, res) {
        try {
            const userId = req.userId;
            const locations = await Location.getUserLocations(userId);
            const stats = await Location.getTotalCollected(userId);

            res.json({
                locations: locations || [],
                stats: {
                    count: stats.count || 0,
                    totalPoints: stats.totalPoints || 0
                }
            });
        } catch (error) {
            console.error('Get locations error:', error);
            res.status(500).json({ error: 'Failed to get locations' });
        }
    }

    static async updatePosition(req, res) {
        try {
            const userId = req.userId;
            const { lat, lng } = req.body;

            if (lat === undefined || lng === undefined) {
                return res.status(400).json({
                    error: 'Latitude and longitude are required'
                });
            }

            await User.updatePosition(
                userId,
                parseFloat(lat),
                parseFloat(lng)
            );

            res.json({
                success: true,
                message: 'Position updated successfully',
                position: { lat: parseFloat(lat), lng: parseFloat(lng) }
            });
        } catch (error) {
            console.error('Update position error:', error);
            res.status(500).json({ error: 'Failed to update position' });
        }
    }

    static async getLeaderboard(req, res) {
        try {
            const users = await User.getAllUsers();
            res.json(users);
        } catch (error) {
            console.error('Get leaderboard error:', error);
            res.status(500).json({ error: 'Failed to get leaderboard' });
        }
    }
}

// Export the class methods directly
module.exports = {
    getPlaces: MapController.getPlaces,
    collectPlace: MapController.collectPlace,
    getUserLocations: MapController.getUserLocations,
    updatePosition: MapController.updatePosition,
    getLeaderboard: MapController.getLeaderboard
};
