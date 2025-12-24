#!/usr/bin/env python3
from http.server import HTTPServer, SimpleHTTPRequestHandler
import os

os.chdir('/Users/hypatia/Documents/avicenna/services/processing_server/processing_images')

class CORSRequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

PORT = 8888
print(f"Starting image server on http://localhost:{PORT}")
print(f"Serving: /Users/hypatia/Documents/avicenna/services/processing_server/processing_images")
print(f"\nAccess left_cheek.jpeg at: http://localhost:{PORT}/left_cheek.jpeg")
HTTPServer(('', PORT), CORSRequestHandler).serve_forever()
