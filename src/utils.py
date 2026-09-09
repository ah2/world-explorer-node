# utils.py - Utility functions for your app

import os
import json
from datetime import datetime
import secrets
import string

def generate_jwt_secret(length=32):
    """
    Generate a secure random JWT secret
    """
    alphabet = string.ascii_letters + string.digits + string.punctuation
    return ''.join(secrets.choice(alphabet) for _ in range(length))

def validate_env_file(env_path='.env'):
    """
    Check if .env exists and JWT_SECRET is set properly
    """
    if not os.path.exists(env_path):
        return {
            'exists': False,
            'message': '.env file not found'
        }
    
    with open(env_path, 'r') as f:
        content = f.read()
    
    if 'JWT_SECRET' not in content:
        return {
            'exists': True,
            'has_jwt': False,
            'message': 'JWT_SECRET not found in .env'
        }
    
    # Extract JWT_SECRET
    for line in content.splitlines():
        if line.startswith('JWT_SECRET='):
            secret = line.split('=', 1)[1].strip()
            if secret in ['default', 'your-secret', '']:
                return {
                    'exists': True,
                    'has_jwt': True,
                    'is_default': True,
                    'message': 'JWT_SECRET is set to default value'
                }
            return {
                'exists': True,
                'has_jwt': True,
                'is_default': False,
                'message': 'JWT_SECRET is properly set'
            }
    
    return {
        'exists': True,
        'has_jwt': False,
        'message': 'JWT_SECRET not configured'
    }

def get_environment():
    """
    Get current environment
    """
    return os.getenv('FLASK_ENV', 'development')

def is_development():
    """
    Check if running in development mode
    """
    return get_environment() == 'development'

def log_request_info(request):
    """
    Log request details for debugging
    """
    return {
        'method': request.method,
        'path': request.path,
        'args': dict(request.args),
        'headers': dict(request.headers),
        'timestamp': datetime.now().isoformat()
    }

def format_response(data, status='success', message=None):
    """
    Format API response consistently
    """
    response = {
        'status': status,
        'data': data,
        'timestamp': datetime.now().isoformat()
    }
    if message:
        response['message'] = message
    return response

# Example database helper functions
class DatabaseHelper:
    @staticmethod
    def get_connection_string(db_type='postgresql'):
        """
        Build database connection string from environment variables
        """
        if db_type == 'postgresql':
            return f"postgresql://{os.getenv('DB_USER')}:{os.getenv('DB_PASSWORD')}@{os.getenv('DB_HOST')}:{os.getenv('DB_PORT')}/{os.getenv('DB_NAME')}"
        elif db_type == 'mysql':
            return f"mysql://{os.getenv('DB_USER')}:{os.getenv('DB_PASSWORD')}@{os.getenv('DB_HOST')}:{os.getenv('DB_PORT')}/{os.getenv('DB_NAME')}"
        else:
            return None

# Example: Your specific app helpers
class WorldExplorerHelpers:
    @staticmethod
    def calculate_points(distance_km, places_visited):
        """
        Calculate points based on distance and places visited
        """
        base_points = places_visited * 10
        bonus_points = int(distance_km / 100) * 5
        return base_points + bonus_points
    
    @staticmethod
    def get_leaderboard_rank(scores, current_score):
        """
        Get rank of current score in leaderboard
        """
        sorted_scores = sorted(scores, reverse=True)
        try:
            return sorted_scores.index(current_score) + 1
        except ValueError:
            return len(sorted_scores) + 1