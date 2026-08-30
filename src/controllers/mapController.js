const axios = require('axios');
const User = require('../models/User');
const Location = require('../models/Location');

class MapController {
    // Cache for categories
    static categoryCache = {
        data: null,
        timestamp: null,
        ttl: 3600000 // 1 hour
    };

    // ==================== GET PLACES WITH RETRY LOGIC ====================
    static async getPlaces(req, res) {
        try {
            const { lat, lng, radius = 2000, page = 1, limit = 20 } = req.query;

            if (!lat || !lng) {
                return res.status(400).json({ 
                    error: 'Latitude and longitude are required' 
                });
            }

            console.log(`📍 Fetching places near (${lat}, ${lng})`);

            // Check API key
            if (!process.env.OVERTURE_API_KEY || 
                process.env.OVERTURE_API_KEY === 'your_overture_api_key_here') {
                console.warn('⚠️ Overture API key not configured, using mock data');
                return res.json(MapController.getMockPlacesPaginated(
                    parseFloat(lat), 
                    parseFloat(lng), 
                    parseInt(limit),
                    parseInt(page)
                ));
            }

            // Try API with retry
            let places = [];
            let total = 0;
            let apiSuccess = false;

            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    console.log(`🔄 API attempt ${attempt}/3`);
                    
                    const response = await axios.get('https://api.overturemapsapi.com/places', {
                        params: {
                            lat: parseFloat(lat),
                            lng: parseFloat(lng),
                            radius: parseInt(radius),
                            limit: parseInt(limit),
                            offset: (parseInt(page) - 1) * parseInt(limit)
                        },
                        headers: {
                            'x-api-key': process.env.OVERTURE_API_KEY
                        },
                        timeout: 10000 // 10 second timeout
                    });

                    if (response.data) {
                        if (response.data.features) {
                            places = response.data.features
                                .filter(feature => feature.properties?.name)
                                .map(feature => MapController.processPlaceFeature(feature));
                            total = response.data.total || response.data.features.length;
                        } else if (response.data.places) {
                            places = response.data.places.map(place => 
                                MapController.processPlaceObject(place)
                            );
                            total = response.data.total || response.data.places.length;
                        }
                        apiSuccess = true;
                        console.log(`✅ API success! Found ${places.length} places`);
                        break;
                    }
                } catch (apiError) {
                    console.error(`❌ API attempt ${attempt} failed:`, apiError.code || apiError.message);
                    
                    // If it's a network error, wait before retrying
                    if (apiError.code === 'ETIMEDOUT' || apiError.code === 'ENETUNREACH') {
                        console.log(`⏳ Waiting 2 seconds before retry...`);
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    } else {
                        // For other errors, break the retry loop
                        break;
                    }
                }
            }

            // If all API attempts failed, use mock data
            if (!apiSuccess || places.length === 0) {
                console.log('📦 Using mock data instead');
                return res.json(MapController.getMockPlacesPaginated(
                    parseFloat(lat), 
                    parseFloat(lng), 
                    parseInt(limit),
                    parseInt(page)
                ));
            }

            // Get category distribution
            const categoryStats = MapController.getCategoryStats(places);

            res.json({
                success: true,
                places: places,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: total,
                    totalPages: Math.ceil(total / parseInt(limit)),
                    hasNext: (parseInt(page) * parseInt(limit)) < total,
                    hasPrevious: parseInt(page) > 1
                },
                categoryStats: categoryStats,
                source: 'Overture Maps API'
            });

        } catch (error) {
            console.error('❌ Get places error:', error.message);
            const { lat = 40.7128, lng = -74.0060, limit = 20, page = 1 } = req.query;
            return res.json(MapController.getMockPlacesPaginated(
                parseFloat(lat), 
                parseFloat(lng), 
                parseInt(limit),
                parseInt(page)
            ));
        }
    }

    // ==================== GET CATEGORIES ====================
    static async getAvailableCategories(req, res) {
        try {
            const { lat, lng, radius = 5000 } = req.query;

            if (!lat || !lng) {
                return res.status(400).json({ 
                    error: 'Latitude and longitude are required' 
                });
            }

            // Check cache
            const now = Date.now();
            if (this.categoryCache.data && 
                (now - this.categoryCache.timestamp) < this.categoryCache.ttl) {
                console.log('📦 Using cached categories');
                return res.json({
                    categories: this.categoryCache.data,
                    source: 'cache',
                    total: this.categoryCache.data.length
                });
            }

            // Try API with retry
            let categories = [];
            let apiSuccess = false;

            for (let attempt = 1; attempt <= 2; attempt++) {
                try {
                    console.log(`🔄 Category API attempt ${attempt}/2`);
                    
                    const response = await axios.get('https://api.overturemapsapi.com/places/categories', {
                        params: {
                            lat: parseFloat(lat),
                            lng: parseFloat(lng),
                            radius: parseInt(radius)
                        },
                        headers: {
                            'x-api-key': process.env.OVERTURE_API_KEY
                        },
                        timeout: 8000
                    });

                    if (response.data && response.data.categories) {
                        categories = response.data.categories;
                        apiSuccess = true;
                        console.log(`✅ Found ${categories.length} categories`);
                        break;
                    }
                } catch (apiError) {
                    console.error(`❌ Category API attempt ${attempt} failed:`, apiError.message);
                    if (attempt < 2) {
                        await new Promise(resolve => setTimeout(resolve, 1500));
                    }
                }
            }

            // Fallback categories
            if (!apiSuccess || categories.length === 0) {
                categories = [
                    'restaurant', 'cafe', 'park', 'museum', 'shop', 
                    'hotel', 'school', 'hospital', 'bank', 'library',
                    'gym', 'pharmacy', 'bakery', 'bar', 'cinema',
                    'theater', 'gallery', 'supermarket', 'clinic', 'church'
                ];
                console.log('📦 Using fallback categories');
            }

            // Cache the results
            this.categoryCache.data = categories;
            this.categoryCache.timestamp = now;

            res.json({
                categories: categories,
                source: apiSuccess ? 'api' : 'fallback',
                total: categories.length,
                sample: categories.slice(0, 10)
            });

        } catch (error) {
            console.error('❌ Get categories error:', error);
            const fallbackCategories = ['restaurant', 'cafe', 'park', 'museum', 'shop'];
            res.json({
                categories: fallbackCategories,
                source: 'fallback',
                total: fallbackCategories.length
            });
        }
    }

    // ==================== LOAD ALL PLACES ====================
    static async loadAllPlaces(req, res) {
        try {
            const { lat, lng, radius = 2000, maxPlaces = 50 } = req.query;

            if (!lat || !lng) {
                return res.status(400).json({ 
                    error: 'Latitude and longitude are required' 
                });
            }

            console.log(`🔍 Loading all places near (${lat}, ${lng})`);

            // Get categories
            const categoryResponse = await MapController.getAvailableCategoriesInternal(
                parseFloat(lat), 
                parseFloat(lng), 
                parseInt(radius)
            );

            const categories = categoryResponse.categories || [];
            console.log(`📊 Found ${categories.length} categories`);

            if (categories.length === 0) {
                return res.json({
                    success: false,
                    message: 'No categories found in this area',
                    places: [],
                    categories: []
                });
            }

            // Load places from each category
            const allPlaces = [];
            const categoryResults = {};
            let totalFetched = 0;
            const limit = 15;

            // Use top categories only
            const topCategories = categories.slice(0, 10);

            for (const category of topCategories) {
                if (totalFetched >= parseInt(maxPlaces)) {
                    break;
                }

                console.log(`📂 Loading category: ${category}`);
                
                try {
                    const response = await MapController.getPlacesPaginatedInternal(
                        parseFloat(lat),
                        parseFloat(lng),
                        parseInt(radius),
                        category,
                        1,
                        Math.min(limit, parseInt(maxPlaces) - totalFetched)
                    );

                    if (response.places && response.places.length > 0) {
                        // Avoid duplicates
                        const newPlaces = response.places.filter(place => 
                            !allPlaces.some(p => 
                                p.name === place.name && 
                                Math.abs(p.lat - place.lat) < 0.0001 &&
                                Math.abs(p.lng - place.lng) < 0.0001
                            )
                        );

                        allPlaces.push(...newPlaces);
                        totalFetched += newPlaces.length;

                        categoryResults[category] = {
                            total: response.pagination?.total || newPlaces.length,
                            loaded: newPlaces.length
                        };

                        console.log(`   ✅ Loaded ${newPlaces.length} places from ${category} (${totalFetched} total)`);
                    }
                } catch (error) {
                    console.error(`❌ Error loading category ${category}:`, error.message);
                }
            }

            res.json({
                success: true,
                summary: {
                    totalCategories: topCategories.length,
                    categoriesWithResults: Object.keys(categoryResults).length,
                    totalPlacesFound: allPlaces.length,
                    maxPlacesLimit: parseInt(maxPlaces)
                },
                categoryBreakdown: categoryResults,
                places: allPlaces,
                categories: topCategories,
                location: {
                    lat: parseFloat(lat),
                    lng: parseFloat(lng),
                    radius: parseInt(radius)
                }
            });

        } catch (error) {
            console.error('❌ Load all places error:', error);
            res.status(500).json({ 
                error: 'Failed to load all places',
                message: error.message 
            });
        }
    }

    // ==================== COLLECT PLACE ====================
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
                message: `${name} collected successfully! 🎉`,
                locationId,
                points: pointsValue,
                totalScore: score,
                totalCollected: stats.count
            });
        } catch (error) {
            console.error('❌ Collect error:', error);
            res.status(500).json({ error: 'Failed to collect place' });
        }
    }

    // ==================== GET USER LOCATIONS ====================
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
            console.error('❌ Get locations error:', error);
            res.status(500).json({ error: 'Failed to get locations' });
        }
    }

    // ==================== UPDATE POSITION ====================
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
            console.error('❌ Update position error:', error);
            res.status(500).json({ error: 'Failed to update position' });
        }
    }

    // ==================== GET LEADERBOARD ====================
    static async getLeaderboard(req, res) {
        try {
            const users = await User.getAllUsers();
            res.json(users);
        } catch (error) {
            console.error('❌ Get leaderboard error:', error);
            res.status(500).json({ error: 'Failed to get leaderboard' });
        }
    }

    // ==================== GET STATUS ====================
    static async getStatus(req, res) {
        try {
            const hasApiKey = !!process.env.OVERTURE_API_KEY && 
                             process.env.OVERTURE_API_KEY !== 'your_overture_api_key_here';
            
            let apiStatus = 'not_configured';
            let apiMessage = 'API key not configured';
            
            if (hasApiKey) {
                try {
                    await axios.get('https://api.overturemapsapi.com/places/categories', {
                        params: {
                            lat: 40.7128,
                            lng: -74.0060,
                            radius: 1000
                        },
                        headers: {
                            'x-api-key': process.env.OVERTURE_API_KEY
                        },
                        timeout: 5000
                    });
                    apiStatus = 'working';
                    apiMessage = 'API is responding';
                } catch (error) {
                    apiStatus = 'error';
                    apiMessage = error.code || error.message || 'API request failed';
                    console.log('⚠️ API status check:', apiMessage);
                }
            }

            res.json({
                service: 'World Explorer',
                apiKeyConfigured: hasApiKey,
                apiStatus: apiStatus,
                apiMessage: apiMessage,
                dataProvider: hasApiKey && apiStatus === 'working' ? 'Overture Maps' : 'Mock Data',
                status: 'Running',
                endpoints: {
                    places: '/api/map/places',
                    categories: '/api/map/categories',
                    loadAll: '/api/map/load-all',
                    collect: '/api/map/collect',
                    locations: '/api/map/locations',
                    position: '/api/map/position',
                    leaderboard: '/api/map/leaderboard'
                }
            });
        } catch (error) {
            console.error('❌ Status error:', error);
            res.status(500).json({ 
                error: 'Failed to get status',
                status: 'Error'
            });
        }
    }

    // ==================== INTERNAL HELPER METHODS ====================

    static async getAvailableCategoriesInternal(lat, lng, radius) {
        try {
            const response = await axios.get('https://api.overturemapsapi.com/places/categories', {
                params: { lat, lng, radius },
                headers: {
                    'x-api-key': process.env.OVERTURE_API_KEY
                },
                timeout: 8000
            });

            let categories = [];
            if (response.data && response.data.categories) {
                categories = response.data.categories;
            }
            return { categories };
        } catch (error) {
            console.error('❌ Error fetching categories:', error.message);
            return {
                categories: ['restaurant', 'cafe', 'park', 'museum', 'shop', 'hotel', 'bank']
            };
        }
    }

    static async getPlacesPaginatedInternal(lat, lng, radius, category, page, limit) {
        try {
            const offset = (page - 1) * limit;
            const response = await axios.get('https://api.overturemapsapi.com/places', {
                params: {
                    lat, lng, radius,
                    categories: category,
                    limit: limit,
                    offset: offset
                },
                headers: {
                    'x-api-key': process.env.OVERTURE_API_KEY
                },
                timeout: 8000
            });

            let places = [];
            let total = 0;

            if (response.data && response.data.features) {
                places = response.data.features
                    .filter(feature => feature.properties?.name)
                    .map(feature => MapController.processPlaceFeature(feature));
                total = response.data.total || response.data.features.length;
            }

            return {
                places,
                pagination: {
                    page,
                    limit,
                    total,
                    hasNext: (page * limit) < total
                }
            };
        } catch (error) {
            console.error(`❌ Error fetching places for category ${category}:`, error.message);
            return { places: [], pagination: { page, limit, total: 0, hasNext: false } };
        }
    }

    static processPlaceFeature(feature) {
        const props = feature.properties || {};
        const coords = feature.geometry?.coordinates || [0, 0];
        
        let categories = [];
        if (props.taxonomy) {
            props.taxonomy.forEach(tax => {
                if (tax.category) categories.push(tax.category);
                if (tax.subcategory) categories.push(tax.subcategory);
            });
        }
        if (props.basic_category) {
            categories.push(props.basic_category);
        }
        if (props.categories) {
            categories.push(props.categories);
        }

        return {
            id: feature.id || `place-${Date.now()}-${Math.random()}`,
            name: props.name || 'Unnamed Location',
            categories: categories.length > 0 ? categories.join(', ') : 'Unknown',
            basic_category: props.basic_category || 'Unknown',
            taxonomy: props.taxonomy || [],
            lat: coords[1] || 0,
            lng: coords[0] || 0,
            address: props.address || props.street || 'No address',
            website: props.website || null,
            phone: props.phone || null,
            social: props.social || null,
            points: Math.floor(Math.random() * 20) + 5,
            source: 'Overture Maps'
        };
    }

    static processPlaceObject(place) {
        return {
            id: place.id || `place-${Date.now()}-${Math.random()}`,
            name: place.name || 'Unnamed Location',
            categories: place.categories || 'Unknown',
            lat: place.lat || place.coordinates?.lat || 0,
            lng: place.lng || place.coordinates?.lng || 0,
            address: place.address || 'No address',
            website: place.website || null,
            phone: place.phone || null,
            points: Math.floor(Math.random() * 20) + 5,
            source: 'Overture Maps'
        };
    }

    static getCategoryStats(places) {
        const stats = {};
        places.forEach(place => {
            const categories = place.categories ? place.categories.split(',') : ['unknown'];
            categories.forEach(cat => {
                const trimmed = cat.trim();
                if (trimmed) {
                    stats[trimmed] = (stats[trimmed] || 0) + 1;
                }
            });
        });
        return stats;
    }

    // ==================== MOCK DATA ====================

    static getMockPlacesPaginated(lat, lng, limit, page) {
        console.log(`📦 Generating mock data for ${lat}, ${lng}`);
        
        const allPlaces = [
            { name: 'Central Park', category: 'park', points: 15 },
            { name: 'City Museum', category: 'museum', points: 20 },
            { name: 'Grand Plaza', category: 'plaza', points: 10 },
            { name: 'Riverside Cafe', category: 'cafe', points: 8 },
            { name: 'Historic Tower', category: 'landmark', points: 25 },
            { name: 'Botanical Gardens', category: 'garden', points: 18 },
            { name: 'Art Gallery', category: 'museum', points: 22 },
            { name: 'Coffee House', category: 'cafe', points: 12 },
            { name: 'Public Library', category: 'library', points: 15 },
            { name: 'Sports Arena', category: 'sports', points: 20 },
            { name: 'Ocean View Restaurant', category: 'restaurant', points: 15 },
            { name: 'Sunset Park', category: 'park', points: 14 },
            { name: 'Artisan Bakery', category: 'bakery', points: 9 },
            { name: 'History Museum', category: 'museum', points: 21 },
            { name: 'City Garden', category: 'garden', points: 16 },
            { name: 'Modern Library', category: 'library', points: 13 },
            { name: 'Fitness Center', category: 'gym', points: 12 },
            { name: 'Pharmacy Plus', category: 'pharmacy', points: 10 },
            { name: 'Tech Hub', category: 'coworking', points: 18 },
            { name: 'Music Hall', category: 'entertainment', points: 22 }
        ];

        const start = (page - 1) * limit;
        const end = Math.min(start + limit, allPlaces.length);
        const paginated = allPlaces.slice(start, end);

        return {
            places: paginated.map((place, index) => ({
                id: `mock-${Date.now()}-${index}`,
                name: place.name,
                categories: place.category,
                lat: lat + (Math.random() - 0.5) * 0.015,
                lng: lng + (Math.random() - 0.5) * 0.015,
                address: `${Math.floor(Math.random() * 1000)} Main St`,
                points: place.points,
                source: 'Mock Data',
                website: `https://example.com/${place.name.toLowerCase().replace(/\s/g, '')}`
            })),
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: allPlaces.length,
                totalPages: Math.ceil(allPlaces.length / limit),
                hasNext: end < allPlaces.length,
                hasPrevious: page > 1
            },
            categoryStats: {
                park: 2, museum: 3, cafe: 2, restaurant: 1,
                library: 2, garden: 2, bakery: 1, gym: 1
            }
        };
    }

    // ==================== PAGINATED PLACES ALIAS ====================
    static async getPlacesPaginated(req, res) {
        return MapController.getPlaces(req, res);
    }
}

// ==================== EXPORT ====================
module.exports = {
    getPlaces: MapController.getPlaces,
    getPlacesPaginated: MapController.getPlacesPaginated,
    getAvailableCategories: MapController.getAvailableCategories,
    loadAllPlaces: MapController.loadAllPlaces,
    collectPlace: MapController.collectPlace,
    getUserLocations: MapController.getUserLocations,
    updatePosition: MapController.updatePosition,
    getLeaderboard: MapController.getLeaderboard,
    getStatus: MapController.getStatus
};