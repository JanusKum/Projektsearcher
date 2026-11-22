"""edge-tts through the session's HTTPS proxy: point certifi at the proxy CA bundle (if present), then run the library's tts_zh.py."""
import os, sys, runpy, certifi
CA = os.environ.get('SSL_CERT_FILE') or '/root/.ccr/ca-bundle.crt'
if os.path.exists(CA): certifi.where = lambda: CA
LIB = os.environ['LIB']
sys.argv = [os.path.join(LIB, 'core/tts/tts_zh.py')] + sys.argv[1:]
runpy.run_path(sys.argv[0], run_name='__main__')
