const axios = require('axios');
const User = require('../models/User');
const Location = require('../models/Location');

class MapController {
    // Cache for categories to reduce API calls
    static categoryCache = {
        data: null,
        timestamp: null,
        ttl: 3600000 // 1 hour cache
    };

    // Get all available categories from Overture
    static async getAvailableCategories(req, res) {
        try {
            const { lat, lng, radius = 5000 } = req.query;

            if (!lat || !lng) {
                return res.status(400).json({ 
                    error: 'Latitude and longitude are required' 
                });
            }

            // Check if we have cached categories
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

            // Fetch categories from Overture
            try {
                const response = await axios.get('https://api.overturemapsapi.com/places/categories', {
                    params: {
                        lat: parseFloat(lat),
                        lng: parseFloat(lng),
                        radius: parseInt(radius)
                    },
                    headers: {
                        'x-api-key': process.env.OVERTURE_API_KEY
                    },
                    timeout: 10000
                });

                // Process the categories
                let categories = [];
                if (response.data && response.data.categories) {
                    categories = response.data.categories;
                } else if (response.data && response.data.features) {
                    // Extract unique categories from features
                    const categorySet = new Set();
                    response.data.features.forEach(feature => {
                        const props = feature.properties;
                        // Handle new taxonomy
                        if (props.taxonomy) {
                            props.taxonomy.forEach(tax => {
                                if (tax.category) categorySet.add(tax.category);
                                if (tax.subcategory) categorySet.add(tax.subcategory);
                            });
                        }
                        // Handle basic_category
                        if (props.basic_category) {
                            categorySet.add(props.basic_category);
                        }
                        // Handle deprecated categories
                        if (props.categories) {
                            const cats = props.categories.split('.');
                            cats.forEach(cat => categorySet.add(cat));
                        }
                    });
                    categories = Array.from(categorySet);
                }

                // Cache the results
                this.categoryCache.data = categories;
                this.categoryCache.timestamp = now;

                console.log(`📊 Found ${categories.length} categories in the area`);
                
                res.json({
                    categories: categories,
                    source: 'api',
                    total: categories.length,
                    sample: categories.slice(0, 10)
                });

            } catch (apiError) {
                console.error('Error fetching categories:', apiError.message);
                
                // Fallback to common categories
                const fallbackCategories = [
                    'restaurant', 'cafe', 'park', 'museum', 'shop', 
                    'hotel', 'school', 'hospital', 'bank', 'library',
                    'gym', 'pharmacy', 'bakery', 'bar', 'cinema'
                ];
                
                res.json({
                    categories: fallbackCategories,
                    source: 'fallback',
                    total: fallbackCategories.length,
                    message: 'Using fallback categories due to API error'
                });
            }
        } catch (error) {
            console.error('Get categories error:', error);
            res.status(500).json({ 
                error: 'Failed to get categories',
                fallbackCategories: ['restaurant', 'cafe', 'park', 'museum', 'shop']
            });
        }
    }

    // Get places with pagination
    static async getPlacesPaginated(req, res) {
        try {
            const { 
                lat, 
                lng, 
                radius = 2000, 
                categories = '', 
                page = 1, 
                limit = 20,
                has_contact = ''
            } = req.query;

            if (!lat || !lng) {
                return res.status(400).json({ 
                    error: 'Latitude and longitude are required' 
                });
            }

            const offset = (parseInt(page) - 1) * parseInt(limit);

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

            try {
                // Build query parameters
                const params = {
                    lat: parseFloat(lat),
                    lng: parseFloat(lng),
                    radius: parseInt(radius),
                    limit: parseInt(limit),
                    offset: offset
                };

                if (categories) {
                    params.categories = categories;
                }
                if (has_contact) {
                    params.has_contact = has_contact;
                }

                // Make API request
                const response = await axios.get('https://api.overturemapsapi.com/places', {
                    params: params,
                    headers: {
                        'x-api-key': process.env.OVERTURE_API_KEY
                    },
                    timeout: 10000
                });

                // Process places
                let places = [];
                let total = 0;

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
                    filters: {
                        categories: categories || 'all',
                        radius: radius,
                        has_contact: has_contact || 'any'
                    }
                });

            } catch (apiError) {
                console.error('Overture API error:', {
                    message: apiError.message,
                    code: apiError.code,
                    response: apiError.response?.data,
                    status: apiError.response?.status
                });

                return res.json(MapController.getMockPlacesPaginated(
                    parseFloat(lat), 
                    parseFloat(lng), 
                    parseInt(limit),
                    parseInt(page)
                ));
            }
        } catch (error) {
            console.error('Get places error:', error);
            const { lat = 40.7128, lng = -74.0060, limit = 20, page = 1 } = req.query;
            return res.json(MapController.getMockPlacesPaginated(
                parseFloat(lat), 
                parseFloat(lng), 
                parseInt(limit),
                parseInt(page)
            ));
        }
    }

    // Load all places by discovering categories and paginating through them
    static async loadAllPlaces(req, res) {
        try {
            const { lat, lng, radius = 2000, maxPlaces = 100 } = req.query;

            if (!lat || !lng) {
                return res.status(400).json({ 
                    error: 'Latitude and longitude are required' 
                });
            }

            console.log(`🔍 Discovering categories near (${lat}, ${lng})...`);

            // Step 1: Get all available categories in the area
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

            // Step 2: Load places from each category with pagination
            const allPlaces = [];
            const categoryResults = {};
            let totalFetched = 0;
            let page = 1;
            const limit = 20;

            // Shuffle categories for better distribution
            const shuffledCategories = MapController.shuffleArray(categories);

            for (const category of shuffledCategories) {
                if (totalFetched >= parseInt(maxPlaces)) {
                    console.log(`✅ Reached maximum places limit (${maxPlaces})`);
                    break;
                }

                console.log(`📂 Loading places for category: ${category}`);

                try {
                    let hasMore = true;
                    let categoryPage = 1;

                    while (hasMore && totalFetched < parseInt(maxPlaces)) {
                        const response = await MapController.getPlacesPaginatedInternal(
                            parseFloat(lat),
                            parseFloat(lng),
                            parseInt(radius),
                            category,
                            categoryPage,
                            Math.min(limit, parseInt(maxPlaces) - totalFetched)
                        );

                        if (response.places && response.places.length > 0) {
                            const newPlaces = response.places.filter(place => 
                                !allPlaces.some(p => 
                                    p.name === place.name && 
                                    Math.abs(p.lat - place.lat) < 0.0001 &&
                                    Math.abs(p.lng - place.lng) < 0.0001
                                )
                            );

                            allPlaces.push(...newPlaces);
                            totalFetched += newPlaces.length;

                            if (!categoryResults[category]) {
                                categoryResults[category] = {
                                    total: 0,
                                    loaded: 0
                                };
                            }
                            categoryResults[category].total = response.pagination?.total || newPlaces.length;
                            categoryResults[category].loaded += newPlaces.length;

                            console.log(`   ✅ Loaded ${newPlaces.length} places from ${category} (${totalFetched} total)`);

                            hasMore = response.pagination?.hasNext || false;
                            categoryPage++;
                        } else {
                            hasMore = false;
                        }
                    }
                } catch (error) {
                    console.error(`❌ Error loading category ${category}:`, error.message);
                }
            }

            res.json({
                success: true,
                summary: {
                    totalCategories: categories.length,
                    categoriesWithResults: Object.keys(categoryResults).length,
                    totalPlacesFound: allPlaces.length,
                    maxPlacesLimit: parseInt(maxPlaces)
                },
                categoryBreakdown: categoryResults,
                places: allPlaces,
                categories: categories,
                location: {
                    lat: parseFloat(lat),
                    lng: parseFloat(lng),
                    radius: parseInt(radius)
                }
            });

        } catch (error) {
            console.error('Load all places error:', error);
            res.status(500).json({ 
                error: 'Failed to load all places',
                message: error.message 
            });
        }
    }

    // ==================== COLLECTION METHODS ====================

    // Collect a place
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
            console.error('Collect error:', error);
            res.status(500).json({ error: 'Failed to collect place' });
        }
    }

    // Get user's collected locations
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

    // Update player position
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

    // Get leaderboard
    static async getLeaderboard(req, res) {
        try {
            const users = await User.getAllUsers();
            res.json(users);
        } catch (error) {
            console.error('Get leaderboard error:', error);
            res.status(500).json({ error: 'Failed to get leaderboard' });
        }
    }

    // Get Overture API status
    static async getStatus(req, res) {
        try {
            const hasApiKey = !!process.env.OVERTURE_API_KEY && 
                             process.env.OVERTURE_API_KEY !== 'your_overture_api_key_here';
            
            let apiStatus = 'not_configured';
            let apiMessage = 'API key not configured';
            
            if (hasApiKey) {
                try {
                    const response = await axios.get('https://api.overturemapsapi.com/places/categories', {
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
                    apiMessage = error.message || 'API request failed';
                }
            }

            res.json({
                service: 'Overture Maps',
                apiKeyConfigured: hasApiKey,
                apiStatus: apiStatus,
                apiMessage: apiMessage,
                mapTileProvider: 'OpenStreetMap',
                dataProvider: hasApiKey ? 'Overture Maps (with fallback to mock data)' : 'Mock Data Only',
                status: 'Running',
                endpoints: {
                    places: '/api/map/places',
                    placesPaginated: '/api/map/places/paginated',
                    categories: '/api/map/categories',
                    loadAll: '/api/map/load-all',
                    collect: '/api/map/collect',
                    locations: '/api/map/locations',
                    position: '/api/map/position',
                    leaderboard: '/api/map/leaderboard'
                }
            });
        } catch (error) {
            console.error('Status error:', error);
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
                timeout: 10000
            });

            let categories = [];
            if (response.data && response.data.categories) {
                categories = response.data.categories;
            }
            return { categories };
        } catch (error) {
            console.error('Error fetching categories:', error.message);
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
                timeout: 10000
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
            console.error(`Error fetching places for category ${category}:`, error.message);
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
            categories: categories.join(', '),
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

    static shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    // ==================== MOCK DATA METHODS ====================

    static getMockPlacesPaginated(lat, lng, limit, page) {
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
            { name: 'Ocean View', category: 'restaurant', points: 15 },
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
        const end = start + limit;
        const paginated = allPlaces.slice(start, end);

        return {
            places: paginated.map((place, index) => ({
                id: `mock-${Date.now()}-${index}`,
                name: place.name,
                categories: place.category,
                lat: lat + (Math.random() - 0.5) * 0.02,
                lng: lng + (Math.random() - 0.5) * 0.02,
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
                park: 2,
                museum: 3,
                cafe: 2,
                restaurant: 1,
                library: 2,
                garden: 2,
                bakery: 1,
                gym: 1,
                pharmacy: 1
            }
        };
    }

    // Legacy getPlaces method - kept for backward compatibility
    static async getPlaces(req, res) {
        return MapController.getPlacesPaginated(req, res);
    }
}

// ==================== EXPORT ALL METHODS ====================
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