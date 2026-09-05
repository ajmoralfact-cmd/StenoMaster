"""
Root Entry Point for Vercel Python Runtime
"""
import sys
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from api.index import app, application, handler

__all__ = ['app', 'application', 'handler']
