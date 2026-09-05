"""
Vercel Serverless WSGI Application for StenoMaster
Exposes top-level `app` and `application` required by Vercel Python runtime.
"""
import io
import sys
import os

current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.abspath(os.path.join(current_dir, '..'))
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

from server import StenoMasterHandler, STATIC_DIR


def app(environ, start_response):
    method = environ.get('REQUEST_METHOD', 'GET').upper()
    path = environ.get('PATH_INFO', '/')
    qs = environ.get('QUERY_STRING', '')
    if qs:
        path = f"{path}?{qs}"

    headers = [f"{method} {path} HTTP/1.1"]
    for k, v in environ.items():
        if k.startswith('HTTP_'):
            header_name = k[5:].replace('_', '-').title()
            headers.append(f"{header_name}: {v}")
        elif k in ('CONTENT_TYPE', 'CONTENT_LENGTH') and v:
            header_name = k.replace('_', '-').title()
            headers.append(f"{header_name}: {v}")

    content_len = int(environ.get('CONTENT_LENGTH') or 0)
    body = environ['wsgi.input'].read(content_len) if content_len > 0 else b''

    raw_req = '\r\n'.join(headers).encode('utf-8') + b'\r\n\r\n' + body

    class WSGIHandler(StenoMasterHandler):
        def __init__(self, req_data):
            self.directory = STATIC_DIR
            self.rfile = io.BytesIO(req_data)
            self.wfile = io.BytesIO()
            self.client_address = ('127.0.0.1', 80)
            self.raw_requestline = self.rfile.readline()
            if self.parse_request():
                func = getattr(self, f"do_{self.command}", None)
                if func:
                    func()

    try:
        handler_instance = WSGIHandler(raw_req)
        raw_response = handler_instance.wfile.getvalue()

        if b'\r\n\r\n' in raw_response:
            head_part, body_part = raw_response.split(b'\r\n\r\n', 1)
        else:
            head_part, body_part = raw_response, b''

        lines = head_part.decode('utf-8', errors='replace').split('\r\n')
        status_line = lines[0] if lines else 'HTTP/1.1 200 OK'
        status = status_line.split(' ', 1)[1] if ' ' in status_line else '200 OK'

        resp_headers = []
        for line in lines[1:]:
            if ': ' in line:
                hk, hv = line.split(': ', 1)
                resp_headers.append((hk, hv))

        start_response(status, resp_headers)
        return [body_part]
    except Exception as e:
        err_msg = f'{{"error": "Internal server error: {str(e)}"}}'.encode('utf-8')
        start_response('500 Internal Server Error', [
            ('Content-Type', 'application/json; charset=utf-8'),
            ('Content-Length', str(len(err_msg)))
        ])
        return [err_msg]


application = app
handler = app
