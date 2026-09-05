"""
Vercel Serverless Function Entry Point for StenoMaster REST API
"""
import sys
import os

# Add parent directory to sys.path so server, db, evaluation modules can be loaded
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.abspath(os.path.join(current_dir, '..'))
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

from server import StenoMasterHandler

# Vercel's Python runtime invokes `handler`
handler = StenoMasterHandler
