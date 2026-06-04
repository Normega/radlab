"""
RADlab parallel port server
Accepts POST /send from trigger-tester.html and writes to the parallel port
via inpout32.dll / inpoutx64.dll.

Requirements:
    pip install flask flask-cors

Place in the same folder as:
    inpout32.dll    (32-bit)
    inpoutx64.dll   (64-bit — preferred on modern Windows)

Run:
    python parallel_server.py

Server listens on localhost:8765.
"""

import ctypes
import os
import sys
import threading
import time

from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # allow requests from file:// or localhost HTML

PORT = 8765

# ── DLL loading ────────────────────────────────────────────────────────────────
dll = None
dll_name = None

def load_dll():
    global dll, dll_name
    base = os.path.dirname(os.path.abspath(__file__))
    candidates = [
        ('inpoutx64.dll', True),   # 64-bit preferred
        ('inpout32.dll',  False),
    ]
    for name, is64 in candidates:
        path = os.path.join(base, name)
        if not os.path.exists(path):
            continue
        try:
            lib = ctypes.WinDLL(path)
            # Both DLLs export Out32(short PortAddress, short data)
            lib.Out32.argtypes = [ctypes.c_short, ctypes.c_short]
            lib.Out32.restype  = None
            dll      = lib
            dll_name = name
            print(f"[ok]  Loaded {name}")
            return True
        except Exception as e:
            print(f"[err] Failed to load {name}: {e}")
    print("[err] No inpout DLL found — place inpoutx64.dll or inpout32.dll in the same folder.")
    return False


# ── Routes ─────────────────────────────────────────────────────────────────────
@app.route('/status', methods=['GET'])
def status():
    return jsonify({'ok': True, 'dll': dll is not None, 'dll_name': dll_name})


@app.route('/send', methods=['POST'])
def send():
    """
    Body: { "address": 0xDFF8, "value": 16, "zero_delay": 20 }
    zero_delay is optional; if present, sends value=0 after that many ms.
    """
    data = request.get_json(force=True)

    if dll is None:
        return jsonify({'ok': False, 'error': 'DLL not loaded'}), 500

    try:
        address    = int(data.get('address', 0xDFF8))
        value      = int(data.get('value',   0))
        zero_delay = data.get('zero_delay')   # ms, optional

        value   = max(0, min(255, value))
        address = max(0, min(0xFFFF, address))

        dll.Out32(ctypes.c_short(address), ctypes.c_short(value))

        if zero_delay is not None and value != 0:
            delay_s = float(zero_delay) / 1000.0
            def _clear():
                time.sleep(delay_s)
                dll.Out32(ctypes.c_short(address), ctypes.c_short(0))
            threading.Thread(target=_clear, daemon=True).start()

        return jsonify({'ok': True, 'address': address, 'value': value})

    except Exception as e:
        return jsonify({'ok': False, 'error': str(e)}), 500


# ── Main ───────────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    if sys.platform != 'win32':
        print("[warn] This server is Windows-only (inpout DLL requirement).")

    load_dll()

    print(f"\nParallel port server running at http://localhost:{PORT}")
    print("Keep this window open while using trigger-tester.html\n")

    app.run(host='127.0.0.1', port=PORT, debug=False)
