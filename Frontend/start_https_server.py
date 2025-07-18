import http.server
import ssl
import os

# Chemin du certificat et de la clé (à générer si besoin)
CERT_FILE = 'cert.pem'
KEY_FILE = 'key.pem'

# Génération automatique du certificat si absent (nécessite openssl)
def generate_self_signed_cert():
    if not (os.path.exists(CERT_FILE) and os.path.exists(KEY_FILE)):
        print('Génération du certificat auto-signé...')
        os.system(f"openssl req -x509 -newkey rsa:2048 -keyout {KEY_FILE} -out {CERT_FILE} -days 365 -nodes -subj '/CN=localhost'")
        print('Certificat généré.')

def main():
    generate_self_signed_cert()
    server_address = ('localhost', 4443)
    handler = http.server.SimpleHTTPRequestHandler
    httpd = http.server.HTTPServer(server_address, handler)
    httpd.socket = ssl.wrap_socket(httpd.socket, certfile=CERT_FILE, keyfile=KEY_FILE, server_side=True)
    print('Serveur HTTPS sur https://localhost:4443')
    httpd.serve_forever()

if __name__ == '__main__':
    main() 